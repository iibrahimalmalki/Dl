-- ═══════════════════════════════════════════════════════════════════════════
-- payroll_run_partial.sql — السطر المدفوع جزئياً لا يُعدّ مدفوعاً بالكامل في حالة المسير (قرار المالك 2026-10-14)
-- الحالة: **لم يُطبَّق**
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   اليوم (payroll_payments.sql): payroll_run_recalc تعدّ كل سطر payment_status = 'paid' مدفوعاً، ولو كان paid_amount أقل من المكافأة.
--   القرار: السطر «مدفوع بالكامل» فقط إذا payment_status = 'paid' و paid_amount ≥ المكافأة الصافية (round(greatest(net_bonus,0),2)).
--     • كل الأسطر مدفوعة بالكامل ⇒ paid
--     • أي دفع (كامل أو جزئي) ولم تكتمل الأسطر كلها ⇒ partially_paid
--     • لا دفع ⇒ approved
--   والمشغّل trg_payroll_run_sync_status يعمل اليوم عند تغيّر payment_status فقط؛ صرف باقي سطر جزئي يبقيه 'paid' ويغيّر paid_amount وحده
--   ⇒ لا يُعاد الحساب ويبقى المسير «مدفوع جزئياً» إلى الأبد. لذا يُضاف paid_amount وnet_bonus إلى أعمدة المشغّل.
--   لا تغيير في أي بيانات ولا في record_payroll_payment (رسالتها «دفع جزئي … اكتب السبب» كما هي).
--
-- وقائع 2026-10-14 (قراءة): يونيو 4 أسطر (3 مدفوعة) · يوليو 5 أسطر (4 مدفوعة) · لا سطر مدفوع بأقل من مكافأته
--   ⇒ الحالتان تبقيان partially_paid بعد التطبيق (يُعاد الحساب في آخر الملف للتأكد، بلا تغيير متوقع).
-- بلا drop ولا delete ⇒ يُطبَّق عبر الأداة. آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.payroll_run_recalc(p_run uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare n int; f int; p int; s text; t text;
begin
  select status into s from public.payroll_runs where id = p_run;
  if s is null or s = 'draft' then return; end if;
  -- f = مدفوع بالكامل (المبلغ ≥ المكافأة الصافية) · p = فيه دفع (كامل أو جزئي)
  select count(*),
         count(*) filter (where payment_status = 'paid' and coalesce(paid_amount, 0) >= round(greatest(coalesce(net_bonus, 0), 0), 2)),
         count(*) filter (where payment_status = 'paid')
    into n, f, p from public.payroll_lines where run_id = p_run;
  t := case when n > 0 and f = n then 'paid' when p > 0 then 'partially_paid' else 'approved' end;
  update public.payroll_runs set status = t, updated_at = now() where id = p_run and status is distinct from t;
end $$;
revoke all on function public.payroll_run_recalc(uuid) from public, anon, authenticated;

-- المشغّل يعيد الحساب أيضاً عند تغيّر المبلغ المدفوع أو المكافأة (صرف باقي سطر جزئي)
create or replace trigger trg_payroll_run_sync_status after insert or delete or update of payment_status, paid_amount, net_bonus on public.payroll_lines
  for each row execute function public.payroll_run_sync_status();

-- إعادة حساب المسيرات المعتمدة الحالية (لا تغيير متوقع: لا دفع جزئي اليوم)
do $$ declare r record; begin
  for r in select id from public.payroll_runs where status <> 'draft' loop perform public.payroll_run_recalc(r.id); end loop;
end $$;

-- ═══ التحقق ═══
-- select period, status from payroll_runs order by 1;                                      -- 2026-06 partially_paid · 2026-07 partially_paid (كما قبل)
-- select pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_payroll_run_sync_status'; -- … UPDATE OF payment_status, paid_amount, net_bonus …
-- select position('paid_amount' in prosrc) > 0 from pg_proc where proname = 'payroll_run_recalc';  -- t

-- ═══ التراجع (عبر الأداة، بلا حذف) — يعيد نص payroll_payments.sql ═══
-- create or replace function public.payroll_run_recalc(p_run uuid) returns void
-- language plpgsql security definer set search_path to 'public' as $$
-- declare n int; p int; s text; t text;
-- begin
--   select status into s from public.payroll_runs where id = p_run;
--   if s is null or s = 'draft' then return; end if;
--   select count(*), count(*) filter (where payment_status = 'paid') into n, p from public.payroll_lines where run_id = p_run;
--   t := case when n > 0 and p = n then 'paid' when p > 0 then 'partially_paid' else 'approved' end;
--   update public.payroll_runs set status = t, updated_at = now() where id = p_run and status is distinct from t;
-- end $$;
-- create or replace trigger trg_payroll_run_sync_status after insert or delete or update of payment_status on public.payroll_lines
--   for each row execute function public.payroll_run_sync_status();
