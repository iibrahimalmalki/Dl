-- ═══════════════════════════════════════════════════════════════════════════
-- users_activity_ex.sql — «آخر نشاط» و«آخر تسجيل في البوابة» في صفحة المستخدمين (طلب المالك 2026-10-14)
-- الحالة: **لم يُطبَّق**
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   دالة قراءة فقط للمالك: admin_users_activity_ex() ⇒ صف لكل مستخدم في app_users:
--     • last_sign_in_at — آخر دخول (auth.users)، كما في admin_users_activity() القائمة (users_admin.sql) دون تغييرها.
--     • last_active_at — آخر نشاط = أحدث تحديث لجلسة المستخدم في auth.sessions:
--         coalesce(refreshed_at, updated_at, created_at) — refreshed_at (توقيت UTC بلا منطقة) يتجدّد مع كل تجديد للرمز أثناء الاستعمال؛
--         الجلسة التي لم تُجدَّد بعد (refreshed_at فارغ) تُحسب بوقت إنشائها/تحديثها.
--         لا جلسة (خرج أو حُذفت جلساته) ⇒ null ⇒ الواجهة: «لا جلسة نشطة».
--         وقائع 2026-10-14: not_after فارغ في كل الجلسات (لا انتهاء مضبوط)، فـ«نشطة» = موجودة.
--     • portal_last_at / portal_last_kind — للبايكر فقط (app_users.biker_employee_id غير فارغ): أحدث ما سجّله بنفسه في البوابة:
--         bike_handovers.created_at (استلام دراجة direction='receive'، وغيره تسليم) · biker_assets.created_at (إقرار عهدة؛ kind='update' تحديث حالة)
--         · fuel_requests.requested_at (طلب وقود) · support_tickets.created_at (دعم)
--         · fuel_logs.created_at (تعبئة وقود) · maintenance_requests.requested_at و done_at (طلب وتأكيد تغيير زيت)
--         · daily_deliveries.created_at (استلام يومي من المندوب) و daily_shares.confirmed_at (تأكيد حصته اليومية) — قرار المالك 2026-10-14.
--       portal_last_kind: bike_receive · bike_return · custody · custody_update · fuel · support · fuel_fill · oil · daily
--         (الواجهة تترجمها — src/usersLib.js PORTAL_KIND).
--       المطابقة بحساب البايكر نفسه (created_by / user_id = app_users.id) لا بالاسم ولا برقم البايكر — فما أدخله المشرف
--       نيابة عنه لا يُحسب نشاطاً له في البوابة (وقائع 2026-10-14: 3 من 9 استلامات، و7 من 10 تعبئات وقود (مستوردة/إدارية) بحساب غير البايكر).
--       استثناءان موثّقان: تأكيد الزيت (لا عمود حساب له) يُنسب لصاحب الطلب لأن confirm_oil_change لا يقبله إلا منه؛
--       والاستلام اليومي يحفظ الموظف (employees.id) لا الحساب، وسياسات الكتابة تقصره على الموظف نفسه ⇒ يُربط بحسابه بالهوية الموثّقة.
--   الصلاحية: المالك فقط (غيره ⇒ 42501 «owner only»)، security definer لقراءة auth.*، وبلا تنفيذ لـ anon.
--   دالة جديدة لا تعديل لـ admin_users_activity(): تغيير أعمدة الإرجاع يحتاج حذف الدالة، والأداة لا تشغّل الحذف.
-- الترتيب: تُطبَّق قبل دمج PR الواجهة (الواجهة تقرأ الجديدة، وعند غيابها تعود إلى admin_users_activity ولا يظهر السطران).
-- بلا drop ولا delete ولا truncate ⇒ يُطبَّق عبر الأداة. آمن لإعادة التشغيل. لا يكتب شيئاً.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_users_activity_ex()
returns table (user_id uuid, last_sign_in_at timestamptz, last_active_at timestamptz, portal_last_at timestamptz, portal_last_kind text)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  if not public.is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  return query
  with s as (
    select se.user_id as uid, max(coalesce(se.refreshed_at at time zone 'UTC', se.updated_at, se.created_at)) as at
      from auth.sessions se group by se.user_id),
  p as (
    select x.uid, x.at, x.kind, row_number() over (partition by x.uid order by x.at desc) as rn
      from (select h.created_by as uid, h.created_at as at,
                   case when h.direction = 'receive' then 'bike_receive' else 'bike_return' end::text as kind from public.bike_handovers h
            union all select b.created_by, b.created_at, case when b.kind = 'update' then 'custody_update' else 'custody' end from public.biker_assets b
            union all select f.created_by, f.requested_at, 'fuel' from public.fuel_requests f
            union all select t.user_id, t.created_at, 'support' from public.support_tickets t
            -- تعبئة وقود: add_fuel_fill تكتب created_by = حساب البايكر؛ ما أدخلته الإدارة (ومنه المستورد legacy) بحسابها فلا يُحسب
            union all select l.created_by, l.created_at, 'fuel_fill' from public.fuel_logs l
            -- تغيير زيت: الطلب (request_oil_change ⇒ created_by = البايكر) والتأكيد (confirm_oil_change ⇒ done_at، يقبله البايكر صاحب الطلب وحده)
            union all select m.created_by, m.requested_at, 'oil' from public.maintenance_requests m
            union all select m.created_by, m.done_at, 'oil' from public.maintenance_requests m where m.done_at is not null
            -- استلام يومي: الجدولان يحفظان الموظف لا الحساب، وسياساتهما لا تقبل الكتابة إلا من الموظف نفسه
            -- (received_by / employee_id = my_employee_uuid()) ⇒ الحساب بالهوية الموثّقة نفسها: app_users.biker_employee_id = employees.employee_id
            union all select a.id, d.created_at, 'daily' from public.daily_deliveries d
              join public.employees e on e.id = d.received_by join public.app_users a on btrim(a.biker_employee_id) = e.employee_id
            union all select a.id, sh.confirmed_at, 'daily' from public.daily_shares sh
              join public.employees e on e.id = sh.employee_id join public.app_users a on btrim(a.biker_employee_id) = e.employee_id
             where sh.status in ('confirmed', 'short') and sh.confirmed_at is not null) x
     where x.uid is not null and x.at is not null)
  select au.id, u.last_sign_in_at, s.at,
         case when nullif(btrim(au.biker_employee_id), '') is not null then p.at end,
         case when nullif(btrim(au.biker_employee_id), '') is not null then p.kind end
    from public.app_users au
    left join auth.users u on u.id = au.id
    left join s on s.uid = au.id
    left join p on p.uid = au.id and p.rn = 1;
end $$;
revoke all on function public.admin_users_activity_ex() from public, anon;
grant execute on function public.admin_users_activity_ex() to authenticated;
comment on function public.admin_users_activity_ex() is 'صفحة المستخدمين (المالك فقط): آخر دخول، آخر نشاط (auth.sessions)، وآخر تسجيل للبايكر في البوابة — قراءة فقط';

-- ═══ التحقق (قراءة فقط) ═══
-- select p.prosecdef, has_function_privilege('anon', p.oid, 'execute') anon_exec, has_function_privilege('authenticated', p.oid, 'execute') auth_exec
--   from pg_proc p where p.proname = 'admin_users_activity_ex';                                   -- true · false · true
-- غير المالك ⇒ «owner only» (يُختبر محلياً: tests/usersActivityExSql.test.mjs).

-- ═══ التراجع ═══
-- عبر الأداة (بلا حذف): revoke execute on function public.admin_users_activity_ex() from authenticated;  (الواجهة تعود للدالة القديمة)
-- من SQL Editor (كامل): drop function if exists public.admin_users_activity_ex();
