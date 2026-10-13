-- ═══════════════════════════════════════════════════════════════════════════
-- payroll_record_payment.sql — تسجيل دفع سطر مسير معتمد: دالة للمالك فقط (PR-C الجزء 2، البند 12 من docs/design/payroll_pipeline.md)
-- الحالة: **طُبِّق 2026-10-13** (migration payroll_record_payment، بأمر المالك؛ تحقّق: دالة واحدة security definer، anon بلا تنفيذ وauthenticated بتنفيذ، 9 أسطر والحالات وبصمة الأسطر وعدد التدقيق كما قبل التطبيق)
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   payroll_lines_guard يمنع الواجهة (anon/authenticated) من أي تعديل على أسطر مسير غير مسودة — حتى للمالك.
--   فالتسجيل يمرّ عبر هذه الدالة فقط (security definer، تتجاوز الحارس كما في payroll_guard.sql)، وهي:
--     • للمالك فقط (is_owner) — لا يكفي has_perm('payroll', true)؛ anon لا يملك تنفيذها أصلاً.
--     • تعدّل أعمدة الدفع وحدها: payment_status, paid_at, paid_amount, payment_ref, bank_fee, pay_note, base_paid, base_paid_at.
--       لا تمسّ net_bonus ولا total ولا inputs/computed — التصحيح المالي بسطر تسوية (جزء لاحق).
--     • ترفض المسير المسودة (الدفع بعد الاعتماد فقط)، وتقفل صف المسير (for update) حتى لا يتسابق دفعان على حالته.
--     • تكتب سطراً في audit_log (action = UPDATE، القديم والجديد والفاعل) عند كل تغيير فعلي — لا مشغّل تدقيق على جدولَي المسير اليوم.
--     • حالة المسير تُشتق تلقائياً بعدها (trg_payroll_run_sync_status في payroll_payments.sql).
--
--   الوسائط الاختيارية: null = «بلا تغيير» (تبقى القيمة المسجّلة)، والنص الفارغ '' يمسح المرجع أو الملاحظة.
--     هكذا يُحدَّث الأساس أو الرسوم وحدها دون فقد التاريخ والمبلغ والمرجع والملاحظة.
--   القواعد (قرار المالك 2026-10-13: paid_amount مقابل المكافأة، والأساس مسار منفصل base_paid):
--     paid      — التاريخ والمبلغ إلزاميان عند أول تسجيل (وبعده null = بلا تغيير).
--                 التاريخ من أول يوم في شهر المسير حتى اليوم (توقيت الرياض).
--                 0 ≤ المبلغ ≤ المكافأة الصافية؛ والصفر فقط إن كانت المكافأة ≤ 0 (مثل عابد). دفع جزئي ⇒ الملاحظة إلزامية.
--                 رسوم الحوالة 0–50 (على المؤسسة). المرجع اختياري (≤ 40 حرفاً)، ويُسمح بتكراره
--                 (حوالة واحدة قد تغطي أكثر من شخص — يونيو 1,662.88)؛ الرد يذكر الأسطر الأخرى بالمرجع نفسه للتنبيه.
--     deferred  — السبب في الملاحظة إلزامي (جديد أو المسجّل)، وتُفرَّغ حقول الدفع.
--     pending   — تراجع عن تسجيل سابق: سبب جديد في الملاحظة إلزامي إن كان السطر مدفوعاً/مؤجَّلاً، وتُفرَّغ حقول الدفع.
--     مع deferred/pending: إرسال تاريخ/مبلغ/مرجع/رسوم = خطأ (لا تُهمل البيانات بصمت).
--     الأساس    — p_base_paid: null = بلا تغيير · true = مدفوع (بتاريخ اختياري ضمن المدى نفسه) · false = غير مدفوع.
--                 تاريخ الأساس مع غير true = خطأ.
--
-- وقائع 2026-10-13 (قراءة): على payroll_lines المشغّلات trg_payroll_lines_guard وtrg_payroll_lines_pay_guard وtrg_payroll_run_sync_status،
--   ولا مشغّل تدقيق. audit_log أعمدته: table_name, row_id, action, actor, actor_email, changed_at, old_data, new_data — بلا قيود check.
--   سياساته: audit_sel (المالك يقرأ) — والإدراج هنا من داخل security definer كما في audit_capture.
-- بلا drop ولا delete ⇒ يُطبَّق عبر الأداة. آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.record_payroll_payment(
  p_line uuid, p_status text,
  p_paid_at date default null, p_amount numeric default null, p_ref text default null, p_fee numeric default null,
  p_note text default null, p_base_paid boolean default null, p_base_paid_at date default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  l public.payroll_lines; r public.payroll_runs;
  v_today date := (now() at time zone 'Asia/Riyadh')::date; v_start date; v_cap numeric;
  v_was_paid boolean; v_at date; v_amt numeric; v_ref text; v_fee numeric; v_note text;
  v_bp boolean; v_bpa date; v_email text; v_new public.payroll_lines; v_old jsonb; v_nj jsonb; v_run text; v_also jsonb;
begin
  if not public.is_owner() then raise exception 'تسجيل الدفع للمالك فقط' using errcode = '42501'; end if;
  select * into l from public.payroll_lines where id = p_line;
  if not found then raise exception 'سطر المسير غير موجود'; end if;
  -- قفل المسير أولاً ثم السطر: دفعان متزامنان على المسير نفسه يتتابعان فتُحسب حالته على أسطر ملتزمة
  select * into r from public.payroll_runs where id = l.run_id for update;
  select * into l from public.payroll_lines where id = p_line for update;
  if r.status = 'draft' then raise exception 'المسير مسودة — اعتمده أولاً ثم سجّل الدفع'; end if;
  if p_status is null or p_status not in ('pending', 'paid', 'deferred') then raise exception 'حالة دفع غير معروفة: %', p_status; end if;
  v_start := to_date(coalesce(l.period, r.period) || '-01', 'YYYY-MM-DD');
  v_cap := round(greatest(coalesce(l.net_bonus, 0), 0), 2);
  v_was_paid := l.payment_status = 'paid';
  -- null = بلا تغيير، '' = مسح
  v_note := case when p_note is null then l.pay_note else nullif(btrim(p_note), '') end;

  if p_status = 'paid' then
    v_at  := coalesce(p_paid_at, case when v_was_paid then l.paid_at end);
    v_amt := round(coalesce(p_amount, case when v_was_paid then l.paid_amount end), 2);
    v_ref := case when p_ref is null then case when v_was_paid then l.payment_ref end else nullif(btrim(p_ref), '') end;
    v_fee := coalesce(p_fee, case when v_was_paid then l.bank_fee end, 0);
    if v_at is null then raise exception 'تاريخ الدفع إلزامي'; end if;
    if v_at < v_start or v_at > v_today then raise exception 'تاريخ الدفع % خارج المدى (% — %)', v_at, v_start, v_today; end if;
    if v_amt is null then raise exception 'المبلغ المدفوع إلزامي'; end if;
    if v_amt < 0 or v_amt > v_cap then raise exception 'المبلغ % خارج المدى (0 — %): المكافأة الصافية %', v_amt, v_cap, l.net_bonus; end if;
    if v_amt = 0 and v_cap > 0 then raise exception 'المبلغ صفر والمكافأة % — سجّلها «مؤجَّلة» أو اتركها «بانتظار الدفع»', l.net_bonus; end if;
    if v_amt < v_cap and v_note is null then raise exception 'دفع جزئي (% من %) — اكتب السبب في الملاحظة', v_amt, v_cap; end if;
    if v_fee < 0 or v_fee > 50 then raise exception 'رسوم الحوالة % خارج المدى (0 — 50)', v_fee; end if;
    if length(v_ref) > 40 then raise exception 'مرجع الحوالة أطول من 40 حرفاً'; end if;
  else
    if p_paid_at is not null or p_amount is not null or nullif(btrim(coalesce(p_ref, '')), '') is not null or coalesce(p_fee, 0) <> 0 then
      raise exception 'لا تُرسل تاريخ/مبلغ/مرجع/رسوم مع الحالة % — اختر «مدفوعة» لتسجيل الدفع', p_status; end if;
    if p_status = 'deferred' and v_note is null then raise exception 'سبب التأجيل إلزامي في الملاحظة'; end if;
    if p_status = 'pending' and l.payment_status <> 'pending' and nullif(btrim(coalesce(p_note, '')), '') is null then
      raise exception 'سبب التراجع إلزامي في الملاحظة'; end if;
    v_at := null; v_amt := null; v_ref := null; v_fee := 0;
  end if;

  -- الأساس: null = بلا تغيير
  if p_base_paid_at is not null and p_base_paid is distinct from true then raise exception 'تاريخ صرف الأساس يُرسل مع «الأساس مدفوع» فقط'; end if;
  if p_base_paid_at is not null and (p_base_paid_at < v_start or p_base_paid_at > v_today) then
    raise exception 'تاريخ صرف الأساس % خارج المدى (% — %)', p_base_paid_at, v_start, v_today; end if;
  v_bp  := case when p_base_paid is null then l.base_paid else p_base_paid end;
  v_bpa := case when p_base_paid is null then l.base_paid_at when p_base_paid then coalesce(p_base_paid_at, l.base_paid_at) end;

  v_old := jsonb_build_object('payment_status', l.payment_status, 'paid_at', l.paid_at, 'paid_amount', l.paid_amount, 'payment_ref', l.payment_ref,
    'bank_fee', l.bank_fee, 'pay_note', l.pay_note, 'base_paid', l.base_paid, 'base_paid_at', l.base_paid_at);
  v_nj := jsonb_build_object('payment_status', p_status, 'paid_at', v_at, 'paid_amount', v_amt, 'payment_ref', v_ref,
    'bank_fee', v_fee, 'pay_note', v_note, 'base_paid', v_bp, 'base_paid_at', v_bpa);

  if v_nj is distinct from v_old then
    update public.payroll_lines set payment_status = p_status, paid_at = v_at, paid_amount = v_amt, payment_ref = v_ref,
      bank_fee = v_fee, pay_note = v_note, base_paid = v_bp, base_paid_at = v_bpa
    where id = l.id;
    select email into v_email from public.app_users where id = auth.uid();
    insert into public.audit_log (table_name, row_id, action, actor, actor_email, old_data, new_data)
    values ('payroll_lines', l.id, 'UPDATE', auth.uid(), v_email, v_old,
      v_nj || jsonb_build_object('period', coalesce(l.period, r.period), 'name', l.name, 'via', 'record_payroll_payment'));
  end if;

  -- تنبيه لا منع: أسطر أخرى بالمرجع نفسه (حوالة جماعية أو خطأ إدخال)
  if v_ref is not null then
    select jsonb_agg(coalesce(o.period, '') || ' ' || coalesce(o.name, o.biker_id, '—') order by o.period) into v_also
      from public.payroll_lines o where o.payment_ref = v_ref and o.id <> l.id;
  end if;
  select status into v_run from public.payroll_runs where id = l.run_id;
  return v_nj || jsonb_build_object('line_id', l.id, 'run_status', v_run, 'changed', v_nj is distinct from v_old, 'ref_also_on', coalesce(v_also, '[]'::jsonb));
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
