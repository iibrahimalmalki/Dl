-- ═══════════════════════════════════════════════════════════════════════════
-- payroll_record_payment.sql — تسجيل دفع سطر مسير معتمد: دالة للمالك فقط (PR-C الجزء 2، البند 12 من docs/design/payroll_pipeline.md)
-- الحالة: **لم يُطبَّق**
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   payroll_lines_guard يمنع الواجهة (anon/authenticated) من أي تعديل على أسطر مسير غير مسودة — حتى للمالك.
--   فالتسجيل يمرّ عبر هذه الدالة فقط (security definer، تتجاوز الحارس كما في payroll_guard.sql)، وهي:
--     • للمالك فقط (is_owner)؛ anon لا يملك تنفيذها أصلاً.
--     • تعدّل أعمدة الدفع وحدها: payment_status, paid_at, paid_amount, payment_ref, bank_fee, pay_note, base_paid, base_paid_at.
--       لا تمسّ net_bonus ولا total ولا inputs/computed — التصحيح المالي بسطر تسوية (جزء لاحق).
--     • ترفض المسير المسودة (الدفع بعد الاعتماد فقط).
--     • تكتب سطراً في audit_log (القديم والجديد والفاعل) لكل تسجيل — لا مشغّل تدقيق على جدولَي المسير اليوم.
--     • حالة المسير تُشتق تلقائياً بعدها (trg_payroll_run_sync_status في payroll_payments.sql).
--
--   القواعد (قرار المالك 2026-10-13: paid_amount مقابل المكافأة، والأساس مسار منفصل base_paid):
--     paid      — تاريخ الدفع إلزامي: من أول يوم في شهر المسير حتى اليوم (توقيت الرياض).
--                 المبلغ إلزامي: 0 ≤ المبلغ ≤ المكافأة الصافية؛ والصفر فقط إن كانت المكافأة ≤ 0 (مثل عابد).
--                 دفع جزئي (أقل من المكافأة) ⇒ الملاحظة إلزامية.
--                 رسوم الحوالة 0–50 (على المؤسسة). المرجع اختياري (≤ 40 حرفاً)، ولا يُكرَّر لشخص آخر.
--     deferred  — الملاحظة (السبب) إلزامية، وتُفرَّغ حقول الدفع.
--     pending   — تراجع عن تسجيل سابق: الملاحظة (سبب التراجع) إلزامية إن كان السطر مدفوعاً/مؤجَّلاً، وتُفرَّغ حقول الدفع.
--     الأساس    — p_base_paid: null = بلا تغيير · true = مدفوع (بتاريخ اختياري ضمن المدى نفسه) · false = غير مدفوع (يُفرَّغ التاريخ).
--
-- وقائع 2026-10-13 (قراءة): على payroll_lines المشغّلات trg_payroll_lines_guard وtrg_payroll_lines_pay_guard وtrg_payroll_run_sync_status،
--   ولا مشغّل تدقيق. audit_log أعمدته: table_name, row_id, action, actor, actor_email, changed_at, old_data, new_data.
-- بلا drop ولا delete ⇒ يُطبَّق عبر الأداة. آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.record_payroll_payment(
  p_line uuid, p_status text,
  p_paid_at date default null, p_amount numeric default null, p_ref text default null, p_fee numeric default null,
  p_note text default null, p_base_paid boolean default null, p_base_paid_at date default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  l public.payroll_lines; r public.payroll_runs;
  v_today date := (now() at time zone 'Asia/Riyadh')::date; v_start date;
  v_ref text := nullif(btrim(coalesce(p_ref, '')), ''); v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_amt numeric; v_fee numeric := coalesce(p_fee, 0); v_cap numeric; v_other text;
  v_bp boolean; v_bpa date; v_email text; v_new public.payroll_lines; v_run text;
begin
  if not public.is_owner() then raise exception 'تسجيل الدفع للمالك فقط' using errcode = '42501'; end if;
  select * into l from public.payroll_lines where id = p_line for update;
  if not found then raise exception 'سطر المسير غير موجود'; end if;
  select * into r from public.payroll_runs where id = l.run_id;
  if r.status = 'draft' then raise exception 'المسير مسودة — اعتمده أولاً ثم سجّل الدفع'; end if;
  if p_status is null or p_status not in ('pending', 'paid', 'deferred') then raise exception 'حالة دفع غير معروفة: %', p_status; end if;
  v_start := to_date(coalesce(l.period, r.period) || '-01', 'YYYY-MM-DD');
  v_cap := greatest(coalesce(l.net_bonus, 0), 0);

  if p_status = 'paid' then
    if p_paid_at is null then raise exception 'تاريخ الدفع إلزامي'; end if;
    if p_paid_at < v_start or p_paid_at > v_today then
      raise exception 'تاريخ الدفع % خارج المدى (% — %)', p_paid_at, v_start, v_today; end if;
    if p_amount is null then raise exception 'المبلغ المدفوع إلزامي'; end if;
    v_amt := round(p_amount, 2);
    if v_amt < 0 or v_amt > v_cap then raise exception 'المبلغ % خارج المدى (0 — %): المكافأة الصافية %', v_amt, v_cap, l.net_bonus; end if;
    if v_amt = 0 and v_cap > 0 then raise exception 'المبلغ صفر والمكافأة % — سجّلها «مؤجَّلة» أو اتركها «بانتظار الدفع»', l.net_bonus; end if;
    if v_amt < v_cap and v_note is null then raise exception 'دفع جزئي (% من %) — اكتب السبب في الملاحظة', v_amt, v_cap; end if;
    if v_fee < 0 or v_fee > 50 then raise exception 'رسوم الحوالة % خارج المدى (0 — 50)', v_fee; end if;
    if v_ref is not null then
      if length(v_ref) > 40 then raise exception 'مرجع الحوالة أطول من 40 حرفاً'; end if;
      -- المرجع نفسه لشخص آخر = خطأ إدخال (الحوالة لشخص واحد)
      select coalesce(o.name, o.biker_id, '—') into v_other from public.payroll_lines o
       where o.payment_ref = v_ref and o.id <> l.id
         -- نفس الشخص = نفس سجل الموظف أو نفس رقم البايكر
         and not coalesce(o.employee_id = l.employee_id, false) and not coalesce(btrim(o.biker_id) = btrim(l.biker_id), false)
       limit 1;
      if v_other is not null then raise exception 'المرجع % مسجّل لـ% — تأكد من الرقم', v_ref, v_other; end if;
    end if;
  elsif p_status = 'deferred' then
    if v_note is null then raise exception 'سبب التأجيل إلزامي في الملاحظة'; end if;
  else
    if l.payment_status <> 'pending' and v_note is null then raise exception 'سبب التراجع إلزامي في الملاحظة'; end if;
  end if;

  -- الأساس: null = بلا تغيير
  v_bp := case when p_base_paid is null then l.base_paid else p_base_paid end;
  v_bpa := case when p_base_paid is null then l.base_paid_at when p_base_paid then coalesce(p_base_paid_at, l.base_paid_at) else null end;
  if p_base_paid and p_base_paid_at is not null and (p_base_paid_at < v_start or p_base_paid_at > v_today) then
    raise exception 'تاريخ صرف الأساس % خارج المدى (% — %)', p_base_paid_at, v_start, v_today; end if;

  update public.payroll_lines set
    payment_status = p_status,
    paid_at     = case when p_status = 'paid' then p_paid_at end,
    paid_amount = case when p_status = 'paid' then v_amt end,
    payment_ref = case when p_status = 'paid' then v_ref end,
    bank_fee    = case when p_status = 'paid' then v_fee else 0 end,
    pay_note    = v_note,
    base_paid = v_bp, base_paid_at = v_bpa
  where id = l.id returning * into v_new;

  select email into v_email from public.app_users where id = auth.uid();
  insert into public.audit_log (table_name, row_id, action, actor, actor_email, old_data, new_data)
  values ('payroll_lines', l.id, 'PAYMENT', auth.uid(), v_email,
    jsonb_build_object('payment_status', l.payment_status, 'paid_at', l.paid_at, 'paid_amount', l.paid_amount, 'payment_ref', l.payment_ref,
      'bank_fee', l.bank_fee, 'pay_note', l.pay_note, 'base_paid', l.base_paid, 'base_paid_at', l.base_paid_at),
    jsonb_build_object('payment_status', v_new.payment_status, 'paid_at', v_new.paid_at, 'paid_amount', v_new.paid_amount, 'payment_ref', v_new.payment_ref,
      'bank_fee', v_new.bank_fee, 'pay_note', v_new.pay_note, 'base_paid', v_new.base_paid, 'base_paid_at', v_new.base_paid_at,
      'period', coalesce(l.period, r.period), 'name', l.name));

  select status into v_run from public.payroll_runs where id = l.run_id;
  return jsonb_build_object('line_id', l.id, 'payment_status', v_new.payment_status, 'paid_at', v_new.paid_at, 'paid_amount', v_new.paid_amount,
    'payment_ref', v_new.payment_ref, 'bank_fee', v_new.bank_fee, 'base_paid', v_new.base_paid, 'run_status', v_run);
end $$;
revoke all on function public.record_payroll_payment(uuid, text, date, numeric, text, numeric, text, boolean, date) from public, anon;
grant execute on function public.record_payroll_payment(uuid, text, date, numeric, text, numeric, text, boolean, date) to authenticated;

-- ═══ التحقق ═══
-- select prosecdef from pg_proc where proname = 'record_payroll_payment';                                              -- t
-- select has_function_privilege('anon', 'public.record_payroll_payment(uuid,text,date,numeric,text,numeric,text,boolean,date)', 'execute'),
--        has_function_privilege('authenticated', 'public.record_payroll_payment(uuid,text,date,numeric,text,numeric,text,boolean,date)', 'execute');  -- f, t
-- select count(*) from payroll_lines;  select period, status from payroll_runs order by 1;                             -- لا تغيير في البيانات

-- ═══ التراجع ═══
-- عبر الأداة (بلا حذف): revoke execute on function public.record_payroll_payment(uuid, text, date, numeric, text, numeric, text, boolean, date) from authenticated;
-- من SQL Editor:        drop function if exists public.record_payroll_payment(uuid, text, date, numeric, text, numeric, text, boolean, date);
