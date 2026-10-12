-- ═══ «بيئة اختبار دائمة»: درّاج تجريبي TEST01 ودراجة وهمية TEST-0000 (المرحلة 2، الخطوة 1: القاعدة) ═══
-- المشروع: cnmggdrlkgsyrjxmvydv · التصميم: docs/design/test_sandbox.md (#68)
-- الحالة: **لم يُطبَّق**.
--
-- قرارات المالك 2026-10-12 (موافقة على المذكرة وتوصيات §8):
--   1) المرحلة 2 تبدأ بالحرج فقط (الرواتب، التوزيع، الأداء، مؤشرات الأسطول ولوحة المالك، الشارة).
--   2) سجلّا TEST01 وTEST-0000 يُنشآن **بعد** دمج PR الواجهة ⇒ القسم 3 يُنفَّذ بموافقة مستقلة لاحقاً.
--   3) استثناء صغير للحزمة الرئيسية (شروط is_test في لوحة المالك والبحث) يُقاس ويُذكر في PR الواجهة.
--   4) الإشعار الناتج عن نشاط تجريبي يصل ببادئة «🧪 تجريبي — » ويُستبعد من الملخّص اليومي.
--
-- ترتيب التطبيق:
--   القسمان 1 و2 (بنية + دوال، بلا بيانات) ⇒ تحقق بالقراءة ⇒ PR الواجهة ⇒ القسم 3 (السجلات الثلاثة، كل بند في معاملة محروسة)
--   ⇒ تجربة الوقود والزيت كاملة بالحساب التجريبي.
--   يُطبَّق القسمان 1 و2 قبل دمج الواجهة لأن الواجهة ستشترط `is_test = false`، والعمود يجب أن يكون موجوداً قبلها.
--
-- وقائع مقروءة من الإنتاج 2026-10-12 قبل الكتابة:
--   • لا عمود is_test في أي جدول؛ لا TEST01 في employees؛ لا لوحة TEST% في fleet_vehicles؛ مشغّل واحد في operators.
--   • الحساب 0efea7d4-… : biker_employee_id = uuid سجل «عمر المالكي» (لا employee_id نصي) ⇒ غير مرتبط فعلياً بأي درّاج اليوم؛
--     in_daily_split = true؛ is_owner = false. سجل عمر في employees لا يُمسّ هنا.
--   • fleet_vehicles: سياسة fleet_biker_self_upd تسمح للدرّاج بتعديل صف دراجته (كل الأعمدة) ⇒ بلا حارس يستطيع درّاج أن يعلّم دراجته
--     تجريبية فتخرج من المؤشرات والتنبيهات. لذلك الحارس 1.2: تغيير is_test للمالك وحده (أو من الخادم/SQL Editor بلا جلسة).
--   • employees: كتابة لمن له has_perm('employees', true)؛ app_users: المالك فقط. الحارس نفسه على الثلاثة.
--   • fleet_alerts() تحسب لكل دراجة على حدة ⇒ لا تُعدَّل. office_brief() تعدّ المسروق/الصيانة فقط والدراجة الوهمية active ⇒ لا تُعدَّل
--     (ولا تُنسخ هنا لأنها تحوي قيمة رمز ثابتة — قاعدة 5).
--   • القسمان 1 و2 بلا كلمة الحذف إطلاقاً (أداة MCP تتعطل عليها)؛ التراجع آخر الملف يشغّله المالك من SQL Editor.

-- ═══ 1) الأعمدة والحارس ═══

-- 1.1 العلامة: مصدر الحقيقة الوحيد. جداول الحركات تُشتق منها (لا عمود فيها).
alter table public.employees      add column if not exists is_test boolean not null default false;
alter table public.fleet_vehicles add column if not exists is_test boolean not null default false;
alter table public.app_users      add column if not exists is_test boolean not null default false;

-- 1.2 الحارس: إنشاء صف تجريبي أو تغيير العلامة للمالك فقط، وهوية الموظف التجريبي (employee_id) ثابتة ولا يأخذها صف آخر
--     (كل الاستبعاد يمرّ عبر هذا الرقم: is_test_biker وmy_employee_uuid وربط daily_team).
--     الدالة بصلاحية المستدعي (لا security definer) ليكون current_user هو دور الطلب: anon/authenticated من الواجهة ⇒ يُفحص؛
--     أي دور آخر (postgres من SQL Editor، service_role، أو داخل دالة security definer موثوقة) ⇒ مسموح.
create or replace function public._guard_is_test() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_owner() then return new; end if;
  if (tg_op = 'INSERT' and new.is_test) or (tg_op = 'UPDATE' and new.is_test is distinct from old.is_test) then
    raise exception 'IS_TEST_OWNER_ONLY' using errcode = '42501';
  end if;
  if tg_table_name = 'employees' then
    if tg_op = 'UPDATE' and old.is_test and new.employee_id is distinct from old.employee_id then
      raise exception 'IS_TEST_OWNER_ONLY' using errcode = '42501';
    end if;
    if (tg_op = 'INSERT' or new.employee_id is distinct from old.employee_id) and public.is_test_biker(new.employee_id) then
      raise exception 'IS_TEST_OWNER_ONLY' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create or replace trigger trg_guard_is_test before insert or update of is_test, employee_id on public.employees
  for each row execute function public._guard_is_test();
create or replace trigger trg_guard_is_test before insert or update of is_test on public.fleet_vehicles
  for each row execute function public._guard_is_test();
create or replace trigger trg_guard_is_test before insert or update of is_test on public.app_users
  for each row execute function public._guard_is_test();

-- 1.3 دوال الاشتقاق (داخلية للدوال الأخرى والحارس؛ الواجهة تقرأ العمود مباشرة)
create or replace function public.is_test_employee(p_id uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists(select 1 from public.employees e where e.id = p_id and e.is_test)
$$;
create or replace function public.is_test_biker(p_biker text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce(btrim(p_biker), '') <> '' and exists(select 1 from public.employees e where e.employee_id = btrim(p_biker) and e.is_test)
$$;
create or replace function public.is_test_vehicle(p_id uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists(select 1 from public.fleet_vehicles v where v.id = p_id and v.is_test)
$$;
revoke all on function public._guard_is_test(), public.is_test_employee(uuid), public.is_test_biker(text), public.is_test_vehicle(uuid)
  from public, anon, authenticated;
grant execute on function public.is_test_biker(text) to authenticated;  -- يستدعيها الحارس بصلاحية المستدعي؛ لا تكشف إلا «هل الرقم تجريبي»

-- ═══ 2) الدوال المعدَّلة (نسخة الإنتاج 2026-10-12 + شرط is_test فقط؛ التوقيع والصلاحيات كما هي) ═══

-- 2.1 من يستلم نصيباً من المستلزمات: التجريبي خارج التوزيع دائماً (حارس ثانٍ مستقل عن in_daily_split).
--     والحساب التجريبي نفسه لا يرى الفريق الحقيقي (قائمة فارغة) حتى لا يُسجَّل منه استلام حقيقي لدفعة المستلزمات.
create or replace function public.daily_team()
returns table(id uuid, full_name text, employee_id text)
language sql stable security definer set search_path to 'public' as $$
  select e.id, e.full_name, e.employee_id
  from public.employees e
  join public.app_users au on btrim(au.biker_employee_id) = e.employee_id
  where au.active and au.in_daily_split and coalesce(au.position, 'biker') in ('biker', 'team_leader')
    and coalesce(e.staff_role, '') <> 'manager'
    and not e.is_test and not au.is_test
    and e.operator_id is not distinct from public.my_operator_id()
    and public.my_employee_uuid() is not null
    and not public.is_test_employee(public.my_employee_uuid())
  order by e.full_name
$$;

-- 2.2 قائمة الإدارة لمن يدخل التوزيع: التجريبي لا يظهر
create or replace function public.daily_split_list()
returns table(id uuid, full_name text, employee_id text, operator_id uuid, in_daily_split boolean)
language sql stable security definer set search_path to 'public' as $$
  select e.id, e.full_name, e.employee_id, e.operator_id, au.in_daily_split
  from public.employees e
  join public.app_users au on btrim(au.biker_employee_id) = e.employee_id
  where public.daily_staff() and au.active and coalesce(au.position, 'biker') in ('biker', 'team_leader')
    and coalesce(e.staff_role, '') <> 'manager'
    and not e.is_test and not au.is_test
  order by e.full_name
$$;

-- 2.3 إدخال التجريبي في التوزيع مرفوض؛ إخراجه مسموح
create or replace function public.set_daily_split(p_employee uuid, p_on boolean) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  if not public.daily_staff(true) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_on is null then raise exception 'p_on is required'; end if;
  if p_on and exists(select 1 from public.employees e join public.app_users au on btrim(au.biker_employee_id) = e.employee_id
                     where e.id = p_employee and (e.is_test or au.is_test)) then
    raise exception 'TEST_ACCOUNT' using errcode = '22023';
  end if;
  update public.app_users au set in_daily_split = p_on
  from public.employees e
  where e.id = p_employee and btrim(au.biker_employee_id) = e.employee_id;
  get diagnostics n = row_count;
  return n;
end $$;

-- 2.4 قائمة متابعة إعادة الإطلاق: بلا التجريبي
create or replace function public.relaunch_roster()
returns table(employee_id uuid, full_name text, biker_employee_id text)
language sql stable security definer set search_path to 'public' as $$
  select e.id, coalesce(au.display_name, e.full_name), btrim(au.biker_employee_id)
  from public.app_users au join public.employees e on e.employee_id = btrim(au.biker_employee_id)
  where au.active and coalesce(au.biker_employee_id, '') <> '' and public.has_perm('onboarding')
    and not e.is_test and not au.is_test
  order by 2
$$;

-- 2.5 إشعارات الأسطول للإدارة: تصل، وبادئة «🧪 تجريبي — » إن كان الطلب لدراجة تجريبية
--     (p_entity = معرّف fuel_requests أو maintenance_requests، كما في كل المستدعين في fleet_requests.sql)
create or replace function public._fleet_notify_admins(p_title text, p_body text, p_entity text, p_dedupe text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare u record; v_title text := p_title; v_id uuid; v_vid uuid;
begin
  if p_entity ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_id := p_entity::uuid;
    select coalesce((select vehicle_id from public.fuel_requests where id = v_id), (select vehicle_id from public.maintenance_requests where id = v_id)) into v_vid;
    if public.is_test_vehicle(v_vid) then v_title := '🧪 تجريبي — ' || p_title; end if;
  end if;
  perform public.push_notification('owner', null, 'fleet', 'info', v_title, p_body, 'fleet_alerts', p_entity, p_dedupe || '-owner');
  for u in select distinct au.id from public.app_users au join public.user_permissions up on up.user_id = au.id
           where au.active and not au.is_owner and up.module = 'fleet_alerts' and up.can_edit loop
    perform public.push_notification('user', u.id, 'fleet', 'info', v_title, p_body, 'fleet_alerts', p_entity, p_dedupe || '-' || u.id);
  end loop;
end $$;

-- 2.6 إشعارات الدرّاج: البادئة بالعربي والبنغالي إن كان الدرّاج تجريبياً
create or replace function public._fleet_notify_biker(p_biker text, p_title text, p_body text, p_entity text, p_dedupe text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare u record; v_title text := p_title;
begin
  if public.is_test_biker(p_biker) then v_title := '🧪 تجريبي · পরীক্ষামূলক — ' || p_title; end if;
  for u in select id from public.app_users where active and btrim(biker_employee_id) = p_biker loop
    perform public.push_notification('user', u.id, 'fleet', 'info', v_title, p_body, 'fuel', p_entity, p_dedupe || '-' || u.id);
  end loop;
end $$;
revoke all on function public._fleet_notify_admins(text, text, text, text), public._fleet_notify_biker(text, text, text, text, text)
  from public, anon, authenticated;

-- 2.7 الملخّص اليومي: لا يعدّ الإشعارات التجريبية
create or replace function public.daily_digest() returns void
language plpgsql security definer set search_path to 'public' as $$
declare summ text; expc int;
begin
  select string_agg(category||' ('||c||')',' · ') into summ
    from (select category,count(*) c from public.notifications
          where created_at > now()-interval '24 hours' and category not in ('digest','escalation','system')
            and coalesce(title, '') not like '🧪%'
          group by category order by count(*) desc) t;
  select count(*) into expc from public.renewal_docs where active is distinct from false and end_date is not null and (end_date-current_date)<=30;
  perform push_notification('owner',null,'digest','info','📋 ملخّص اليوم',
    coalesce('أحداث آخر 24 ساعة — '||summ,'لا أحداث جديدة في آخر 24 ساعة')||case when expc>0 then ' · وثائق ضمن 30 يوماً: '||expc else '' end,
    'dashboard', null, 'digest:'||to_char((now() at time zone 'Asia/Riyadh')::date,'YYYY-MM-DD'));
end $$;

-- ═══ 3) السجلات — **لا تُنفَّذ مع 1 و2**: بموافقة مستقلة بعد دمج PR الواجهة ═══
-- كل بند (3.1، 3.2، 3.3) يُشغَّل **وحده** في استدعاء مستقل (execute_sql واحد أو تشغيل واحد في SQL Editor)، فيكون معاملة مستقلة
-- تتراجع وحدها إن تأثر غير المتوقع. لا تُلصق البنود الثلاثة معاً: تصير معاملة واحدة ويتراجع ما قبل البند الفاشل بصمت.

-- 3.1 الموظف التجريبي (بلا أي بيانات شخصية؛ لا فريق؛ المشغّل الوحيد)
do $$ declare n int; op uuid; begin
  if (select count(*) from public.operators) <> 1 then raise exception 'المتوقع مشغّل واحد بالضبط'; end if;
  select id into op from public.operators;
  insert into public.employees (full_name, employee_id, operator_id, is_test)
  select 'بايكر تجريبي', 'TEST01', op, true
  where not exists (select 1 from public.employees where employee_id = 'TEST01');
  get diagnostics n = row_count;
  if n > 1 then raise exception 'المتوقع صف واحد على الأكثر، تأثّر %', n; end if;
  if (select count(*) from public.employees where employee_id = 'TEST01' and is_test) <> 1 then
    raise exception 'TEST01 يجب أن يكون صفاً واحداً بعلامة is_test';
  end if;
end $$;

-- 3.2 الدراجة الوهمية مخصّصة له (بلا GPS ولا كاميرا ولا وثائق)
do $$ declare n int; begin
  insert into public.fleet_vehicles (operator_id, plate, plate_en, make, model_year, status, active, is_test, biker_employee_id, current_biker)
  select e.operator_id, 'TEST-0000', 'TEST-0000', 'بوكسر', 2024, 'active', true, true, e.id, 'بايكر تجريبي (TEST01)'
  from public.employees e
  where e.employee_id = 'TEST01' and e.is_test
    and not exists (select 1 from public.fleet_vehicles where plate = 'TEST-0000');
  get diagnostics n = row_count;
  if n > 1 then raise exception 'المتوقع صف واحد على الأكثر، تأثّر %', n; end if;
  if (select count(*) from public.fleet_vehicles v join public.employees e on e.id = v.biker_employee_id
      where v.plate = 'TEST-0000' and v.is_test and v.active and e.employee_id = 'TEST01') <> 1 then
    raise exception 'TEST-0000 يجب أن تكون دراجة واحدة تجريبية نشطة مخصّصة لـ TEST01';
  end if;
end $$;

-- 3.3 ربط الحساب 0efea7d4 بـ TEST01 (صف app_users فقط؛ لا مساس بسجل عمر في employees، ولا بالاسم ولا بكلمة المرور)
do $$ declare n int; begin
  if exists (select 1 from public.app_users where btrim(biker_employee_id) = 'TEST01' and id <> '0efea7d4-f215-436b-8c74-9c4f6eca1074') then
    raise exception 'حساب آخر مرتبط بـ TEST01';
  end if;
  update public.app_users set biker_employee_id = 'TEST01', in_daily_split = false, is_test = true
  where id = '0efea7d4-f215-436b-8c74-9c4f6eca1074' and not is_owner
    and btrim(coalesce(biker_employee_id, '')) in ('ba6e536b-a0e0-44bd-9ae6-6b0fe86bacd9', 'TEST01');  -- القيمة المقروءة 2026-10-12 (أو سبق تطبيقه)
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'المتوقع صف واحد بالضبط بالربط المقروء 2026-10-12، تأثّر % (تغيّر الحساب؟ اقرأه من جديد)', n; end if;
end $$;

-- ═══ تحقق بالقراءة بعد القسمين 1 و2 ═══
-- select table_name from information_schema.columns where table_schema='public' and column_name='is_test' order by 1;  -- app_users, employees, fleet_vehicles
-- select count(*) filter (where is_test) from employees; select count(*) filter (where is_test) from fleet_vehicles; select count(*) filter (where is_test) from app_users;  -- 0, 0, 0
-- select event_object_table from information_schema.triggers where trigger_name='trg_guard_is_test' group by 1 order by 1;  -- الثلاثة
-- select proname, prosecdef from pg_proc where pronamespace='public'::regnamespace and proname in
--   ('_guard_is_test','is_test_employee','is_test_biker','is_test_vehicle','daily_team','daily_split_list','set_daily_split','relaunch_roster',
--    '_fleet_notify_admins','_fleet_notify_biker','daily_digest');  -- 11، كلها t إلا _guard_is_test = f (بصلاحية المستدعي عمداً)
-- select has_function_privilege('authenticated','public.is_test_vehicle(uuid)','execute'), has_function_privilege('authenticated','public.is_test_biker(text)','execute'),
--        has_function_privilege('anon','public.is_test_biker(text)','execute'), has_function_privilege('authenticated','public._fleet_notify_admins(text,text,text,text)','execute'),
--        has_function_privilege('authenticated','public.daily_team()','execute');  -- f, t, f, f, t
-- select count(*) from notifications where title like '🧪%';  -- 0 (لا إشعار حقيقي يبدأ بالبادئة)

-- ═══ تحقق بالقراءة بعد القسم 3 ═══
-- select e.employee_id, e.full_name, e.is_test, e.team_id, e.staff_role from employees e where employee_id='TEST01';  -- TEST01، بايكر تجريبي، t، null، null
-- select plate, make, model_year, status, active, is_test, current_biker from fleet_vehicles where plate='TEST-0000';  -- بوكسر، 2024، active، t، t
-- select biker_employee_id, in_daily_split, is_test, is_owner from app_users where id='0efea7d4-f215-436b-8c74-9c4f6eca1074';  -- TEST01، f، t، f
-- select count(*) from fleet_vehicles where not is_test;  -- 6 (لم يتغيّر)
-- select full_name, employee_id, staff_role from employees where full_name = 'عمر المالكي';  -- كما كان: employee_id فارغ، manager

-- ═══ تراجع (من SQL Editor) ═══
-- (القسم 3) update public.app_users set biker_employee_id = 'ba6e536b-a0e0-44bd-9ae6-6b0fe86bacd9', in_daily_split = true, is_test = false
--             where id = '0efea7d4-f215-436b-8c74-9c4f6eca1074';   -- القيم السابقة كما قُرئت 2026-10-12
--           delete from public.fleet_vehicles where plate = 'TEST-0000' and is_test;   -- بعد حذف طلباتها/تعبئاتها التجريبية إن وُجدت
--           delete from public.employees where employee_id = 'TEST01' and is_test;
-- (القسم 2) إعادة تعريف الدوال السبع بنسخ الإنتاج المقروءة 2026-10-12 = الأجسام أعلاه بلا شروط is_test وبلا البادئة:
--           daily_team وdaily_split_list وset_daily_split في docs/sql/daily_receive.sql، relaunch_roster في launch_support.sql،
--           _fleet_notify_admins و_fleet_notify_biker في fleet_requests.sql (2.4)، وdaily_digest ليست في أي ملف فنصّها هنا:
-- create or replace function public.daily_digest() returns void language plpgsql security definer set search_path to 'public' as $f$
-- declare summ text; expc int;
-- begin
--   select string_agg(category||' ('||c||')',' · ') into summ
--     from (select category,count(*) c from public.notifications
--           where created_at > now()-interval '24 hours' and category not in ('digest','escalation','system')
--           group by category order by count(*) desc) t;
--   select count(*) into expc from public.renewal_docs where active is distinct from false and end_date is not null and (end_date-current_date)<=30;
--   perform push_notification('owner',null,'digest','info','📋 ملخّص اليوم',
--     coalesce('أحداث آخر 24 ساعة — '||summ,'لا أحداث جديدة في آخر 24 ساعة')||case when expc>0 then ' · وثائق ضمن 30 يوماً: '||expc else '' end,
--     'dashboard', null, 'digest:'||to_char((now() at time zone 'Asia/Riyadh')::date,'YYYY-MM-DD'));
-- end $f$;
-- (القسم 1) drop trigger if exists trg_guard_is_test on public.employees; drop trigger if exists trg_guard_is_test on public.fleet_vehicles;
--           drop trigger if exists trg_guard_is_test on public.app_users;
--           drop function if exists public._guard_is_test(), public.is_test_employee(uuid), public.is_test_biker(text), public.is_test_vehicle(uuid);
--           alter table public.employees drop column if exists is_test; alter table public.fleet_vehicles drop column if exists is_test;
--           alter table public.app_users drop column if exists is_test;   -- بعد إعادة الدوال، لأنها تشير إلى العمود
