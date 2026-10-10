-- حذف جداول ليست من مشروع دلو ورغوة (بقايا مشاريع أخرى في القاعدة نفسها). بند الأمان 11.1 في handoff.md.
-- الحالة: **لم يُطبَّق** — يُشغَّل من SQL Editor بعد موافقة المالك (أداة Supabase تنتهي مهلتها على أي أمر فيه drop).
--
-- النسخة الاحتياطية (أُخذت 10/10/2026 قبل هذا الملف): restore.sql + data.json — 17 جدولاً، 31 صفاً.
--   جُرِّبت الاستعادة على قاعدة فارغة: كل الصفوف والسياسات رجعت، وإعادة التشغيل آمنة.
--
-- لماذا الحذف آمن لدلو ورغوة (تحقّق 10/10/2026، قراءة فقط):
--   - لا يقرأها ولا يكتبها أي ملف في src أو supabase أو scripts.
--   - لا يعتمد عليها أي جدول أو view أو دالة من دلو ورغوة (تطابقات «diagnostics» في mark_daily_shared و set_daily_split
--     و set_user_permissions هي جملة plpgsql «get diagnostics» وليست الجدول).
--   - لا مشغّل على auth.users يكتب فيها، ولا وظيفة cron، ولا نشر realtime.
--   - المفاتيح الأجنبية الداخلة إليها كلها من جداول محذوفة معها (diagnostics و subscriptions من مشروع المستشارين).
-- الخطر الذي يُغلقه: entities و records و attachments و webapp_files و webapp_hex_chunks مفتوحة للزوار قراءةً وكتابةً وحذفاً.
--
-- الجداول (17):
--   البلديات/المياه: entities (10)، records (10)، attachments (0)
--   المستشارون: consultant_profiles (1)، organization_profiles (1)، platform_settings (3)، consultant_services (0)،
--               diagnosis_assessments (0)، reviews (0)، payments (0)، diagnostics (0)، subscriptions (0)
--   المقترحات: submissions (0)، votes (0)، inspirers_count (1)
--   ملف الويب: webapp_files (1)، webapp_hex_chunks (4)
-- لا يُحذف: الدالة update_updated_at (قد تستخدمها جداول أخرى)، ولا أي جدول من دلو ورغوة.

-- ═══ 0) تحقّق قبل (قراءة فقط) — المتوقع العدد في التعليق أعلاه ═══
-- select 'entities',count(*) from public.entities union all select 'records',count(*) from public.records
-- union all select 'platform_settings',count(*) from public.platform_settings union all select 'webapp_hex_chunks',count(*) from public.webapp_hex_chunks
-- union all select 'consultant_profiles',count(*) from public.consultant_profiles union all select 'organization_profiles',count(*) from public.organization_profiles
-- union all select 'inspirers_count',count(*) from public.inspirers_count union all select 'webapp_files',count(*) from public.webapp_files;

-- ═══ 1) الحذف — معاملة واحدة؛ يتوقف ولا يحذف شيئاً إن تغيّر عدد صفوف أي جدول عن النسخة الاحتياطية ═══
begin;
do $$
declare
  expected jsonb := '{"entities":10,"records":10,"attachments":0,"consultant_profiles":1,"organization_profiles":1,
    "platform_settings":3,"consultant_services":0,"diagnosis_assessments":0,"reviews":0,"payments":0,"diagnostics":0,
    "subscriptions":0,"submissions":0,"votes":0,"inspirers_count":1,"webapp_files":1,"webapp_hex_chunks":4}';
  k text; n bigint;
begin
  for k in select jsonb_object_keys(expected) loop
    if to_regclass('public.'||k) is null then continue; end if;  -- محذوف سابقاً
    execute format('select count(*) from public.%I', k) into n;
    if n <> (expected->>k)::bigint then
      raise exception 'الجدول % فيه % صفاً والنسخة الاحتياطية % — توقّف بلا حذف. خذ نسخة جديدة أولاً.', k, n, expected->>k;
    end if;
  end loop;
end $$;

-- الأبناء قبل الآباء؛ restrict (الافتراضي) ⇒ يفشل ولا يحذف شيئاً لو ظهر اعتماد غير متوقع
drop table if exists public.votes;
drop table if exists public.submissions;
drop table if exists public.inspirers_count;
drop table if exists public.webapp_hex_chunks;
drop table if exists public.webapp_files;
drop table if exists public.attachments;
drop table if exists public.records;
drop table if exists public.entities;
drop table if exists public.payments;
drop table if exists public.subscriptions;
drop table if exists public.diagnostics;
drop table if exists public.reviews;
drop table if exists public.diagnosis_assessments;
drop table if exists public.consultant_services;
drop table if exists public.consultant_profiles;
drop table if exists public.organization_profiles;
drop table if exists public.platform_settings;
commit;

-- ═══ 2) تحقّق بعد (قراءة فقط) ═══
-- (أ) المتوقع: 0 — لا شيء من الجداول الـ 17 باقٍ:
select count(*) as remaining from unnest(array['entities','records','attachments','consultant_profiles','organization_profiles',
  'platform_settings','consultant_services','diagnosis_assessments','reviews','payments','diagnostics','subscriptions',
  'submissions','votes','inspirers_count','webapp_files','webapp_hex_chunks']) t where to_regclass('public.'||t) is not null;
-- (ب) المتوقع: لا صفوف — لا سياسة مفتوحة للزوار (using true مع كتابة) باقية في public:
select tablename, policyname, cmd from pg_policies
  where schemaname = 'public' and qual = 'true' and cmd in ('ALL','INSERT','UPDATE','DELETE') and 'public' = any(roles);
-- (ج) دلو ورغوة سليم: الصفحة الرئيسية وصفحة التسوية تفتحان كالمعتاد.

-- ═══ 3) التراجع ═══
-- شغّل restore.sql من النسخة الاحتياطية (10/10/2026) في SQL Editor — يعيد الجداول الـ 17 وبياناتها وسياساتها ومشغّلاتها.
