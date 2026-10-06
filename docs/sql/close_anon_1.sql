-- ═══ إغلاق الوصول بلا تسجيل دخول — المرحلة 1 ═══
-- المشروع: cnmggdrlkgsyrjxmvydv · لا يُطبَّق قبل موافقة المالك الصريحة.
-- ترتيب التطبيق: يُنشر أولاً كود حذف الصفحة العامة /?employee= ثم يُطبَّق هذا الملف.
--
-- ما يغلقه:
--   employees      : emp_anon_select / emp_anon_update / emp_anon_insert (قراءة وكتابة بيانات شخصية بلا دخول)
--   notifications  : allow_all_anon — للدور public فيشمل المسجّلين أيضاً؛ القراءة يغطيها notif_read،
--                    و«مقروء/تأجيل» يكتبان في notification_reads (سياسة nr_all). كل الكتابة في الجدول من دوال security definer.
--   admin_sessions : anon_admin — لا يستعمله أي كود في المستودع؛ الجدول يبقى.
--   page_visits    : allow_public_read_visits — الإدراج العام يبقى (تسجيل زيارة صفحة الإعلان)؛
--                    visits_auth_select تُوسَّع إلى reports أو applicants.
-- الحالة قبل التطبيق مقروءة من الإنتاج 2026-10-05.

begin;

-- 1) employees
drop policy if exists emp_anon_select on public.employees;
drop policy if exists emp_anon_update on public.employees;
drop policy if exists emp_anon_insert on public.employees;
revoke all on public.employees from anon;

-- 2) notifications
drop policy if exists allow_all_anon on public.notifications;
revoke all on public.notifications from anon;

-- 3) admin_sessions
drop policy if exists anon_admin on public.admin_sessions;
revoke all on public.admin_sessions from anon;

-- 4) page_visits: الإدراج العام فقط
drop policy if exists allow_public_read_visits on public.page_visits;
revoke select, update, delete, truncate, references, trigger on public.page_visits from anon;
-- يبقى: grant insert + سياسة allow_public_insert_visits
drop policy if exists visits_auth_select on public.page_visits;
create policy visits_auth_select on public.page_visits for select to authenticated
  using (has_perm('reports') or has_perm('applicants'));

commit;

-- تحقق بعد التطبيق (يجب أن تكون كل الأسطر false/0):
-- select tablename, policyname from pg_policies where schemaname='public'
--   and policyname in ('emp_anon_select','emp_anon_update','emp_anon_insert','allow_all_anon','anon_admin','allow_public_read_visits')
--   and tablename in ('employees','notifications','admin_sessions','page_visits');
-- select table_name, privilege_type from information_schema.role_table_grants
--   where table_schema='public' and grantee='anon' and table_name in ('employees','notifications','admin_sessions','page_visits');
--   ⇒ الناتج المتوقع: page_visits INSERT فقط.


/* ═══ التراجع (ROLLBACK) — يعيد السياسات والصلاحيات كما كانت حرفياً قبل التطبيق ═══
begin;
-- employees
create policy emp_anon_select on public.employees for select to anon using (true);
create policy emp_anon_update on public.employees for update to anon using (true) with check (true);
create policy emp_anon_insert on public.employees for insert to anon with check (true);
grant insert, select, update on public.employees to anon;
-- notifications
create policy allow_all_anon on public.notifications for all to public using (true) with check (true);
grant delete, insert, references, select, trigger, truncate, update on public.notifications to anon;
-- admin_sessions
create policy anon_admin on public.admin_sessions for all to anon using (true) with check (true);
grant delete, insert, references, select, trigger, truncate, update on public.admin_sessions to anon;
-- page_visits
create policy allow_public_read_visits on public.page_visits for select to anon using (true);
grant select, update, delete, truncate, references, trigger on public.page_visits to anon;
drop policy if exists visits_auth_select on public.page_visits;
create policy visits_auth_select on public.page_visits for select to authenticated using (has_perm('reports'));
commit;
*/
