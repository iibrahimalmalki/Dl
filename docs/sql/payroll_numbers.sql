-- ═══════════════════════════════════════════════════════════════════════════
-- payroll_numbers.sql — بنية PR-B «صحة الأرقام» (docs/design/payroll_pipeline.md §2 و§7)
-- الحالة: **لم يُطبَّق**
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   1) ops_biker_month: عمود tips (إكراميات الشهر من ملف tips)، والتقييم بلا تقريب (كان numeric(4,2) فيُقرَّب 3.995 ⇒ 4.00 قبل الشريحة).
--   2) employees.start_date: تاريخ المباشرة (تعريف «البايكر النشط» في المسير). الفارغ = مباشر مع تنبيه في المسير.
--   3) staff_role: البايكرز الأربعة الحقيقيون 'biker' (كانوا null)، وسلمان المالكي 'supervisor' (كان manager).
--      الواجهة في هذا الـPR تعامل manager وsupervisor معاً كإدارة (isManagerial) فلا يظهر سلمان في قوائم البايكرز.
--   4) report_uploads: صف واحد لكل (مشغّل، شهر، نوع) — الإقفال يعمل upsert بدل insert.
--   5) ops_daily: عمود operator_id ومفتاح (operator_id, day) بدل day وحده.
--   6) complaint_pct يُعاد حسابه كلما تغيّر الصافي (إعادة الإقفال تغيّر net_washes ولا تكتب complaint_pct؛
--      sync_approved_complaints يحدّثه فقط عند تغيّر قرارات التذاكر).
--
-- وقائع مقروءة من الإنتاج 2026-10-13:
--   • ops_biker_month.rating = numeric(4,2)؛ لا عمود tips. لا view يعتمد على ops_biker_month.
--   • employees: لا عمود تاريخ مباشرة؛ البايكرز 1624/1648/1700/2637651411 بلا staff_role؛ سلمان (80d65b02…) manager؛ TEST01 biker (لا يُمسّ).
--   • report_uploads: تكرار واحد (يوليو maintenance ×2)؛ لا مفتاح فريد.
--   • ops_daily: 259 صفاً، المفتاح الأساسي ops_daily_pkey على day؛ مشغّل واحد فقط (b57f396c…).
--
-- الترتيب: الأقسام 1–3 و5-أ عبر الأداة (لا حذف فيها). القسمان 4 و5-ب فيهما delete/drop ⇒ يشغّلهما المالك من SQL Editor.
--          ثم دمج PR-B. (الإقفال الشهري الجديد يحتاج القسمين 4 و5 قبل أول حفظ، والمسير يحتاج 1 و2.)
-- كل قسم معاملة مستقلة؛ أقسام البيانات تتراجع إن تأثّر غير العدد المتوقع.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 1) ops_biker_month: الإكراميات والتقييم الكامل ═══
begin;
alter table public.ops_biker_month add column if not exists tips numeric;
alter table public.ops_biker_month alter column rating type numeric;
commit;

-- ═══ 2) employees.start_date ═══
begin;
alter table public.employees add column if not exists start_date date;
commit;

-- ═══ 3) staff_role (بيانات — معاملة لكل بند مع فحص العدد) ═══
-- 3-أ البايكرز الأربعة (بالمعرّف لا بالاسم)
do $$ declare n int; begin
  update public.employees set staff_role = 'biker'
   where id in ('e5d45ef0-0f7c-4c87-8c33-6c9d44dfa2a2',  -- Ariful Islam 1624
                '47793dbb-f84f-495c-9458-1d8ac9a277aa',  -- Midul Hassan 1648
                '6bc2d2be-3c7c-40d2-85fd-e7a0e290ec08',  -- Mohamad Rakib 1700
                'f3bb50ed-86f4-468f-a2d9-1eaf5369d859')  -- Abed mia 2637651411
     and staff_role is distinct from 'biker' and not is_test;
  get diagnostics n = row_count;
  if n not in (0, 4) then raise exception 'staff_role biker: تأثّر % صفوف بدل 4 — تراجع', n; end if;
end $$;
-- 3-ب المشرف
do $$ declare n int; begin
  update public.employees set staff_role = 'supervisor'
   where id = '80d65b02-9428-4484-8b27-ffb0ad8a96a8' and full_name = 'سلمان المالكي' and staff_role = 'manager';
  get diagnostics n = row_count;
  if n not in (0, 1) then raise exception 'staff_role supervisor: تأثّر % صفوف بدل 1 — تراجع', n; end if;
end $$;

-- ═══ 4) report_uploads — يشغّله المالك من SQL Editor (فيه delete) ═══
-- begin;
-- -- يبقى أحدث صف لكل (مشغّل، شهر، نوع)؛ المتوقع حذف صف واحد (يوليو maintenance)
-- with d as (select id, row_number() over (partition by operator_id, period, kind order by uploaded_at desc, id) rn from public.report_uploads)
-- delete from public.report_uploads r using d where r.id = d.id and d.rn > 1;
-- create unique index if not exists report_uploads_op_period_kind on public.report_uploads (operator_id, period, kind);
-- commit;

-- ═══ 5) ops_daily.operator_id ═══
-- 5-أ العمود والتعبئة (عبر الأداة)
begin;
alter table public.ops_daily add column if not exists operator_id uuid references public.operators(id);
update public.ops_daily set operator_id = 'b57f396c-2d39-4fa4-a568-143585f3db14' where operator_id is null;
create unique index if not exists ops_daily_op_day on public.ops_daily (operator_id, day);
commit;
-- 5-ب المفتاح الأساسي — يشغّله المالك من SQL Editor (فيه drop)
-- begin;
-- alter table public.ops_daily drop constraint if exists ops_daily_pkey;
-- alter table public.ops_daily alter column operator_id set not null;
-- alter table public.ops_daily add constraint ops_daily_pkey primary key using index ops_daily_op_day;
-- commit;

-- ═══ 6) complaint_pct مع الصافي ═══
begin;
create or replace function public.ops_bm_complaint_pct() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' or new.net_washes is distinct from old.net_washes then
    new.complaint_pct := case when coalesce(new.net_washes, 0) > 0
      then round(coalesce(new.approved_complaints, 0)::numeric / new.net_washes * 100, 2) else 0 end;
  end if;
  return new;
end $$;
revoke all on function public.ops_bm_complaint_pct() from public, anon, authenticated;
create or replace trigger trg_ops_bm_complaint_pct before insert or update of net_washes on public.ops_biker_month
  for each row execute function public.ops_bm_complaint_pct();
commit;

-- ═══ التحقق ═══
-- select column_name, data_type, numeric_precision, numeric_scale from information_schema.columns
--  where (table_name, column_name) in (('ops_biker_month','tips'),('ops_biker_month','rating'),('employees','start_date'),('ops_daily','operator_id'));
--   -- tips numeric · rating numeric بلا دقة · start_date date · operator_id uuid
-- select employee_id, full_name, staff_role from public.employees where staff_role in ('biker','supervisor') order by 1;
--   -- 1624/1648/1700/2637651411 biker · TEST01 biker · سلمان supervisor
-- select operator_id, period, kind, count(*) from public.report_uploads group by 1,2,3 having count(*) > 1;   -- لا صفوف (بعد 4)
-- select count(*), count(operator_id) from public.ops_daily;                                                  -- 259 / 259
-- select indexdef from pg_indexes where tablename = 'ops_daily';                                              -- ops_daily_pkey على (operator_id, day) بعد 5-ب

-- ═══ التراجع (SQL Editor) ═══
-- begin;
-- drop trigger if exists trg_ops_bm_complaint_pct on public.ops_biker_month;
-- drop function if exists public.ops_bm_complaint_pct();
-- alter table public.ops_daily drop constraint if exists ops_daily_pkey;
-- alter table public.ops_daily add constraint ops_daily_pkey primary key (day);
-- drop index if exists public.ops_daily_op_day;
-- alter table public.ops_daily drop column if exists operator_id;
-- drop index if exists public.report_uploads_op_period_kind;
-- update public.employees set staff_role = 'manager' where id = '80d65b02-9428-4484-8b27-ffb0ad8a96a8';
-- update public.employees set staff_role = null where id in ('e5d45ef0-0f7c-4c87-8c33-6c9d44dfa2a2','47793dbb-f84f-495c-9458-1d8ac9a277aa','6bc2d2be-3c7c-40d2-85fd-e7a0e290ec08','f3bb50ed-86f4-468f-a2d9-1eaf5369d859');
-- alter table public.employees drop column if exists start_date;
-- alter table public.ops_biker_month alter column rating type numeric(4,2);
-- alter table public.ops_biker_month drop column if exists tips;
-- commit;
