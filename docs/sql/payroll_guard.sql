-- ═══════════════════════════════════════════════════════════════════════════
-- payroll_guard.sql — قفل المسير المعتمد + الاعتماد للمالك فقط (PR-A من docs/design/payroll_pipeline.md)
-- الحالة: **طُبِّق 2026-10-13** (migration payroll_guard، بأمر المالك؛ تحقّق: العمودان، الحارسان، السياسة، الحالات كما هي، 9 أسطر)
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   اليوم: سياسة RLS تسمح لأي محرّر رواتب (has_perm('payroll', true)) بالاعتماد وبتعديل مسير معتمد وحذف أسطره،
--   والبايكر يقرأ أسطره حتى من المسودة (payroll_lines_self بلا شرط حالة). لا trigger على جدولَي المسير.
--   هذا الملف:
--     1) يضيف approved_by وapproved_at على payroll_runs.
--     2) payroll_runs_guard: الانتقال من draft إلى غيرها (أو الإدراج بغيرها) للمالك فقط، ويملأ approved_by/approved_at؛
--        المسير غير draft لا يُعدَّل ولا يُحذف من الواجهة لأحد (ولا للمالك): التصحيح لاحقاً بسطر تسوية عبر دالة (PR-C).
--     3) payroll_lines_guard: لا إدراج ولا تعديل ولا حذف لأسطر مسير غير draft.
--     4) payroll_lines_self: البايكر يرى أسطره من مسير غير draft فقط.
--   الاستثناء: الأدوار غير anon/authenticated (المالك من SQL Editor، service_role، أو داخل دالة security definer)
--   — على نمط _guard_is_test في test_sandbox.sql — حتى يمكن ترحيل يوليو ودوال الدفع في PR-C.
--   الاستثناء يشمل كل دالة security definer: اليوم لا دالة تكتب في جدولَي المسير (office_brief تقرأ فقط)، ودوال PR-C تفحص بنفسها.
--   الحالات الحالية: 2026-06 = final، 2026-07 = approved ⇒ كلاهما يُقفَل فور التطبيق (مقصود).
--
-- الترتيب: يُطبَّق هذا الملف قبل دمج PR-A (الواجهة تخفي الأزرار، والقاعدة تفرض).
-- لا drop ولا delete فيه ⇒ يمكن تطبيقه عبر الأداة أو SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ التنفيذ (آمن لإعادة التشغيل) ═══
begin;

-- 1) الأعمدة
alter table public.payroll_runs add column if not exists approved_by uuid;
alter table public.payroll_runs add column if not exists approved_at timestamptz;

-- 2) حارس المسير
create or replace function public.payroll_runs_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if current_user not in ('anon', 'authenticated') then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'المسير معتمد ومقفل — لا يُحذف' using errcode = '42501'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    raise exception 'المسير معتمد ومقفل — التصحيح بسطر تسوية فقط' using errcode = '42501';
  end if;
  if coalesce(new.status, 'draft') <> 'draft' then
    if not public.is_owner() then raise exception 'اعتماد المسير للمالك فقط' using errcode = '42501'; end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
  else
    -- المسودة لا تحمل بيانات اعتماد من الواجهة
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end $$;
create or replace trigger trg_payroll_runs_guard before insert or update or delete on public.payroll_runs
  for each row execute function public.payroll_runs_guard();

-- 3) هل المسير غير مسودة؟ (security definer: البايكر لا يقرأ payroll_runs بـRLS؛ تكشف «منشور/لا» فقط)
create or replace function public.payroll_run_locked(p_run uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select status <> 'draft' from public.payroll_runs where id = p_run), false)
$$;
revoke all on function public.payroll_run_locked(uuid) from public, anon;
grant execute on function public.payroll_run_locked(uuid) to authenticated;

create or replace function public.payroll_lines_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if current_user not in ('anon', 'authenticated') then return coalesce(new, old); end if;
  if (tg_op <> 'INSERT' and public.payroll_run_locked(old.run_id))
     or (tg_op <> 'DELETE' and public.payroll_run_locked(new.run_id)) then
    raise exception 'المسير معتمد ومقفل — لا تعديل على أسطره' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create or replace trigger trg_payroll_lines_guard before insert or update or delete on public.payroll_lines
  for each row execute function public.payroll_lines_guard();
revoke all on function public.payroll_runs_guard(), public.payroll_lines_guard() from public, anon, authenticated;

-- 4) البايكر يرى أسطر المسير غير المسودة فقط
alter policy payroll_lines_self on public.payroll_lines
  using (my_biker_id() is not null and role = 'biker' and btrim(coalesce(biker_id, '')) = my_biker_id()
         and public.payroll_run_locked(run_id));

commit;

-- ═══ التحقق ═══
-- أ) الأعمدة والـtriggers
-- select column_name from information_schema.columns where table_name='payroll_runs' and column_name in ('approved_by','approved_at');  -- صفّان
-- select tgrelid::regclass, tgname from pg_trigger where tgname in ('trg_payroll_runs_guard','trg_payroll_lines_guard');            -- صفّان
-- ب) السياسة
-- select qual from pg_policies where tablename='payroll_lines' and policyname='payroll_lines_self';                                -- فيها payroll_run_locked
-- ج) لم تتغيّر البيانات
-- select period, status, approved_by, approved_at from payroll_runs order by period;   -- 2026-06 final / 2026-07 approved، والعمودان null
-- select count(*) from payroll_lines;                                                   -- كما قبل التطبيق
-- د) من الواجهة (حساب غير المالك بصلاحية رواتب): «اعتماد» ⇒ «اعتماد المسير للمالك فقط»؛ وحفظ مسير يوليو ⇒ «المسير معتمد ومقفل».

-- ═══ التراجع ═══
-- begin;
-- drop trigger if exists trg_payroll_runs_guard on public.payroll_runs;
-- drop trigger if exists trg_payroll_lines_guard on public.payroll_lines;
-- alter policy payroll_lines_self on public.payroll_lines
--   using ((my_biker_id() is not null) and (role = 'biker') and (btrim(coalesce(biker_id, '')) = my_biker_id()));
-- drop function if exists public.payroll_runs_guard(), public.payroll_lines_guard(), public.payroll_run_locked(uuid);
-- alter table public.payroll_runs drop column if exists approved_by, drop column if exists approved_at;
-- commit;
