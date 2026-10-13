-- ═══════════════════════════════════════════════════════════════════════════
-- payroll_payments.sql — حالات المسير والدفع لكل سطر (PR-C، البنود 11 و12 من docs/design/payroll_pipeline.md)
-- الحالة: **لم يُطبَّق**
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   1) حالات المسير: draft → approved → partially_paid / paid. يونيو «final» يُوحَّد إلى approved (لا قيد check اليوم).
--   2) أعمدة الدفع على السطر (قرار المالك 2026-10-13: paid_amount مقابل المكافأة، والأساس مسار منفصل):
--        payment_status  pending | paid | deferred      (المؤجَّل لا يُعدّ مدفوعاً)
--        paid_at · paid_amount · payment_ref · bank_fee (مصروف على المؤسسة — لا يدخل total ولا net_bonus)
--        base_paid (null = غير مسجّل · true/false) · base_paid_at · pay_note (ملاحظة الدفع للسطر)
--   3) حالة المسير تُشتق تلقائياً من أسطره عند تغيّر payment_status (trigger security definer لأن الحارس يقفل المسير):
--        كل الأسطر paid ⇒ paid · بعضها paid ⇒ partially_paid · لا شيء ⇒ approved. المسودة لا تُمسّ.
--   تسجيل الدفع اليوم من SQL Editor/الأداة فقط (الحارس payroll_lines_guard يمنع الواجهة)؛ واجهة الدفع للمالك في PR لاحق.
--
-- وقائع 2026-10-13: payroll_runs بلا قيود check؛ الحالات: 2026-06 final · 2026-07 approved. لا أعمدة دفع على payroll_lines.
-- لا drop ولا delete ⇒ يُطبَّق عبر الأداة. آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 1) أعمدة الدفع ═══
alter table public.payroll_lines add column if not exists payment_status text not null default 'pending';
alter table public.payroll_lines add column if not exists paid_at date;
alter table public.payroll_lines add column if not exists paid_amount numeric;
alter table public.payroll_lines add column if not exists payment_ref text;
alter table public.payroll_lines add column if not exists bank_fee numeric not null default 0;
alter table public.payroll_lines add column if not exists base_paid boolean;
alter table public.payroll_lines add column if not exists base_paid_at date;
alter table public.payroll_lines add column if not exists pay_note text;
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'payroll_lines_payment_status_ck') then
    alter table public.payroll_lines add constraint payroll_lines_payment_status_ck check (payment_status in ('pending', 'paid', 'deferred'));
  end if;
end $c$;

-- ═══ 2) توحيد final ⇒ approved ثم قيد الحالات ═══
-- (المالك من الأداة: current_user ليس authenticated ⇒ الحارس يسمح)
update public.payroll_runs set status = 'approved', updated_at = now() where status = 'final';
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'payroll_runs_status_ck') then
    alter table public.payroll_runs add constraint payroll_runs_status_ck check (status in ('draft', 'approved', 'partially_paid', 'paid'));
  end if;
end $c$;

-- ═══ 3) اشتقاق حالة المسير من الأسطر ═══
create or replace function public.payroll_run_sync_status() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare r uuid := coalesce(new.run_id, old.run_id); n int; p int; s text;
begin
  select status into s from public.payroll_runs where id = r;
  if s is null or s = 'draft' then return null; end if;
  select count(*), count(*) filter (where payment_status = 'paid') into n, p from public.payroll_lines where run_id = r;
  update public.payroll_runs
     set status = case when n > 0 and p = n then 'paid' when p > 0 then 'partially_paid' else 'approved' end,
         updated_at = now()
   where id = r and status is distinct from case when n > 0 and p = n then 'paid' when p > 0 then 'partially_paid' else 'approved' end;
  return null;
end $$;
revoke all on function public.payroll_run_sync_status() from public, anon, authenticated;
create or replace trigger trg_payroll_run_sync_status after update of payment_status on public.payroll_lines
  for each row execute function public.payroll_run_sync_status();

-- ═══ التحقق ═══
-- select period, status from payroll_runs order by period;                          -- 2026-06 approved · 2026-07 approved (قبل الترحيل)
-- select count(*) from information_schema.columns where table_name='payroll_lines'
--   and column_name in ('payment_status','paid_at','paid_amount','payment_ref','bank_fee','base_paid','base_paid_at','pay_note');  -- 8
-- select payment_status, count(*) from payroll_lines group by 1;                     -- كلها pending

-- ═══ التراجع (SQL Editor) ═══
-- begin;
-- drop trigger if exists trg_payroll_run_sync_status on public.payroll_lines;
-- drop function if exists public.payroll_run_sync_status();
-- alter table public.payroll_runs drop constraint if exists payroll_runs_status_ck;
-- update public.payroll_runs set status = 'final' where id = 'ee06d014-ed5a-4e82-8513-fc041188a116';
-- alter table public.payroll_lines drop constraint if exists payroll_lines_payment_status_ck,
--   drop column if exists payment_status, drop column if exists paid_at, drop column if exists paid_amount, drop column if exists payment_ref,
--   drop column if exists bank_fee, drop column if exists base_paid, drop column if exists base_paid_at, drop column if exists pay_note;
-- commit;
