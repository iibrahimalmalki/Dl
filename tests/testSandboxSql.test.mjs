// «بيئة اختبار دائمة» على Postgres محلي: docs/sql/test_sandbox.sql (العلامة، الحارس، استبعاد التوزيع، بادئة الإشعارات، السجلات الثلاثة).
// يعمل فقط مع PGTEST_PORT (مثلاً PGTEST_PORT=55432 npm test)؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='ts_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
const as=(uid,sql)=>ps(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`).split('\n').pop();
const asErr=(uid,sql)=>err(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`);

const OWNER='00000000-0000-0000-0000-00000000000a',MIDUL='00000000-0000-0000-0000-000000001648',SUP='00000000-0000-0000-0000-0000000000d1',
  FLEET='00000000-0000-0000-0000-0000000000f1',ACC='0efea7d4-f215-436b-8c74-9c4f6eca1074';
const E_MIDUL='10000000-0000-0000-0000-000000001648',E_OMAR='ba6e536b-a0e0-44bd-9ae6-6b0fe86bacd9',OP='b57f396c-2d39-4fa4-a568-143585f3db14';
const V1='20000000-0000-0000-0000-000000000001',V2='20000000-0000-0000-0000-000000000002';

ps(`create database ${db}`,'postgres');
try{
ps(`do $$ begin create role anon; exception when others then null; end $$;
do $$ begin create role authenticated; exception when others then null; end $$;
create schema auth; create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('test.uid',true),'')::uuid $f$;
grant usage on schema auth to authenticated, anon;
create table public.operators (id uuid primary key);
create table public.app_users (id uuid primary key, display_name text, is_owner boolean not null default false, biker_employee_id text, active boolean not null default true,
  position text, in_daily_split boolean not null default true);
create table public.user_permissions (user_id uuid, module text, can_view boolean, can_edit boolean);
create table public.employees (id uuid primary key default gen_random_uuid(), full_name text not null, employee_id text, operator_id uuid, staff_role text, team_id uuid);
create function public.is_owner() returns boolean language sql stable security definer set search_path to 'public' as $f$ select exists(select 1 from public.app_users where id = auth.uid() and is_owner and active) $f$;
create function public.has_perm(p_module text, p_need_edit boolean default false) returns boolean language sql stable security definer set search_path to 'public' as $f$
  select public.is_owner() or exists(select 1 from public.user_permissions up join public.app_users au on au.id = up.user_id where up.user_id = auth.uid() and au.active and up.module = p_module and (up.can_view or up.can_edit) and (not p_need_edit or up.can_edit)) $f$;
create function public.my_biker_id() returns text language sql stable security definer set search_path to 'public' as $f$ select btrim(biker_employee_id) from public.app_users where id = auth.uid() and active and coalesce(biker_employee_id,'') <> '' $f$;
create function public.my_employee_uuid() returns uuid language sql stable security definer set search_path to 'public' as $f$ select e.id from public.employees e where e.employee_id = public.my_biker_id() limit 1 $f$;
create function public.my_operator_id() returns uuid language sql stable security definer set search_path to 'public' as $f$ select e.operator_id from public.employees e where e.id = public.my_employee_uuid() $f$;
create function public.daily_staff(p_edit boolean default false) returns boolean language sql stable security definer set search_path to 'public' as $f$ select public.has_perm('field_rounds', p_edit) or public.has_perm('supply', p_edit) $f$;
create table public.fleet_vehicles (id uuid primary key default gen_random_uuid(), operator_id uuid, plate text not null, plate_en text, make text, model_year int, status text not null default 'active',
  current_biker text, biker_employee_id uuid references public.employees(id), held_by uuid, active boolean not null default true, has_gps boolean not null default false, created_at timestamptz default now());
alter table public.fleet_vehicles enable row level security;
create policy fv_sel on public.fleet_vehicles for select to authenticated using (has_perm('fleet') or biker_employee_id in (select id from employees where employee_id = my_biker_id()));
create policy fv_upd on public.fleet_vehicles for update to authenticated using (has_perm('fleet', true));
create policy fv_ins on public.fleet_vehicles for insert to authenticated with check (has_perm('fleet', true));
create policy fv_self_upd on public.fleet_vehicles for update to authenticated using (biker_employee_id in (select id from employees where employee_id = my_biker_id()))
  with check (biker_employee_id in (select id from employees where employee_id = my_biker_id()));
create table public.fuel_logs (id uuid primary key default gen_random_uuid(), operator_id uuid, vehicle_id uuid references public.fleet_vehicles(id), plate text, biker_employee_id text, biker_name text,
  fuel_type text not null default 'petrol', fill_at timestamptz default now(), odometer numeric, liters numeric, amount numeric, odometer_photo_url text, receipt_photo_url text, notes text,
  status text not null default 'submitted', reviewed_by uuid, reviewed_at timestamptz, created_by uuid, created_at timestamptz default now());
create table public.audit_log (table_name text, row_id uuid, action text, actor uuid);
create function public.audit_capture() returns trigger language plpgsql security definer set search_path to 'public' as $f$
  begin insert into public.audit_log values (TG_TABLE_NAME, (to_jsonb(coalesce(NEW, OLD))->>'id')::uuid, TG_OP, auth.uid()); return coalesce(NEW, OLD); end $f$;
create table public.notifications (id uuid primary key default gen_random_uuid(), audience text, user_id uuid, category text, severity text, title text, body text, module text, entity_id text,
  dedupe_key text unique, created_at timestamptz default now());
create function public.push_notification(p_audience text, p_user uuid, p_category text, p_severity text, p_title text, p_body text, p_module text, p_entity text, p_dedupe text) returns void
  language sql security definer as $f$ insert into public.notifications(audience,user_id,category,severity,title,body,module,entity_id,dedupe_key) values (p_audience,p_user,p_category,p_severity,p_title,p_body,p_module,p_entity,p_dedupe) on conflict (dedupe_key) do nothing $f$;
create table public.renewal_docs (id uuid primary key default gen_random_uuid(), active boolean, end_date date);
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
insert into operators values ('${OP}');
insert into app_users (id,display_name,is_owner,biker_employee_id,position,in_daily_split) values ('${OWNER}','owner',true,null,null,true),('${MIDUL}','Midul',false,'1648','biker',true),
  ('${SUP}','sup',false,null,'field_sup',true),('${FLEET}','fleet',false,null,null,true),('${ACC}','12345',false,'${E_OMAR}',null,true);
insert into user_permissions values ('${SUP}','supply',true,true),('${SUP}','onboarding',true,true),('${FLEET}','fleet',true,true),('${FLEET}','employees',true,true);
insert into employees (id,full_name,employee_id,operator_id,staff_role) values ('${E_MIDUL}','Midul Hassan','1648','${OP}',null),('${E_OMAR}','عمر المالكي',null,null,'manager');
insert into fleet_vehicles (id,operator_id,plate,make,model_year,biker_employee_id) values ('${V1}','${OP}','M-1','بوكسر',2024,'${E_MIDUL}'),('${V2}','${OP}','S-2','بوكسر',2024,null);`);
// نسخ الإنتاج قبل التعديل (2026-10-12) من الملفات/القاعدة، ثم fleet_requests.sql المطبَّق
ps(`create function public.daily_team() returns table(id uuid, full_name text, employee_id text) language sql stable security definer set search_path to 'public' as $f$
  select e.id, e.full_name, e.employee_id from public.employees e join public.app_users au on btrim(au.biker_employee_id) = e.employee_id
  where au.active and au.in_daily_split and coalesce(au.position, 'biker') in ('biker', 'team_leader') and coalesce(e.staff_role, '') <> 'manager'
    and e.operator_id is not distinct from public.my_operator_id() and public.my_employee_uuid() is not null order by e.full_name $f$;
create function public.relaunch_roster() returns table(employee_id uuid, full_name text, biker_employee_id text) language sql stable security definer set search_path to 'public' as $f$
  select e.id, coalesce(au.display_name, e.full_name), btrim(au.biker_employee_id) from public.app_users au join public.employees e on e.employee_id = btrim(au.biker_employee_id)
  where au.active and coalesce(au.biker_employee_id, '') <> '' and public.has_perm('onboarding') order by 2 $f$;
revoke all on function public.daily_team(), public.relaunch_roster() from public, anon; grant execute on function public.daily_team(), public.relaunch_roster() to authenticated;`);
const fr=fs.readFileSync('docs/sql/fleet_requests.sql','utf8');
const efr=err(fr.slice(0,fr.indexOf('-- ═══ 3)')));
ok('تهيئة: fleet_requests.sql (القسمان 1 و2) يُطبَّق'+(efr?' — '+efr.slice(0,300):''),!efr);
if(efr)process.exit(1);

const file=fs.readFileSync('docs/sql/test_sandbox.sql','utf8');
const s12=file.slice(file.indexOf('-- ═══ 1)'),file.indexOf('-- ═══ 3)')),s3=file.slice(file.indexOf('-- ═══ 3)'),file.indexOf('-- ═══ تحقق'));
ok('القسمان 1 و2 بلا كلمة drop أو delete إطلاقاً (أداة MCP تتعطل عليها)',!/drop|delete/i.test(s12));
ok('الملف لا يعيد تعريف office_brief (فيها قيمة رمز ثابتة) ولا يحوي مفتاحاً',!/office_brief\s*\(/i.test(s12+s3)&&!/p_token|sk_|eyJ/.test(file));
const e1=err(s12),e2=err(s12);
ok('القسمان 1 و2 يُطبَّقان مرتين بلا خطأ'+(e1||e2?' — '+String(e1||e2).slice(0,300):''),!e1&&!e2);
if(e1||e2)process.exit(1);

// ── البنية ──
ok('is_test على الجداول الثلاثة، not null وافتراضياً false',ps(`select string_agg(table_name||':'||is_nullable||':'||column_default, ',' order by table_name) from information_schema.columns where table_schema='public' and column_name='is_test'`)
  ==='app_users:NO:false,employees:NO:false,fleet_vehicles:NO:false');
ok('لا صف تجريبي بعد القسمين 1 و2',ps(`select (select count(*) from employees where is_test)+(select count(*) from fleet_vehicles where is_test)+(select count(*) from app_users where is_test)`)==='0');
ok('دوال الاشتقاق والحارس داخلية (لا تنفيذ للمسجّل)، والدوال العامة كما كانت',
  ps(`select has_function_privilege('authenticated','public.is_test_biker(text)','execute')::text||has_function_privilege('authenticated','public._guard_is_test()','execute')::text
    ||has_function_privilege('authenticated','public.daily_team()','execute')::text||has_function_privilege('anon','public.daily_team()','execute')::text
    ||has_function_privilege('authenticated','public._fleet_notify_admins(text,text,text,text)','execute')::text`)==='falsefalsetruefalsefalse');

// ── الحارس: العلامة للمالك فقط ──
ok('الدرّاج لا يعلّم دراجته تجريبية (رغم سياسة تعديل دراجته)',/IS_TEST_OWNER_ONLY/.test(asErr(MIDUL,`update fleet_vehicles set is_test=true where id='${V1}'`)||''));
ok('والدرّاج يبقى قادراً على تعديل بقية أعمدة دراجته',!asErr(MIDUL,`update fleet_vehicles set has_gps=true where id='${V1}'`));
ok('صاحب «الأسطول» و«الموظفين» لا يغيّر العلامة ولا ينشئ صفاً تجريبياً',/IS_TEST_OWNER_ONLY/.test(asErr(FLEET,`update fleet_vehicles set is_test=true where id='${V2}'`)||'')
  &&/IS_TEST_OWNER_ONLY/.test(asErr(FLEET,`insert into fleet_vehicles (plate,is_test) values ('X',true)`)||'')&&/IS_TEST_OWNER_ONLY/.test(asErr(FLEET,`update employees set is_test=true where id='${E_MIDUL}'`)||'')
  &&!asErr(FLEET,`insert into fleet_vehicles (id,plate) values ('20000000-0000-0000-0000-0000000000aa','N-9')`));
ok('المالك يغيّر العلامة ويعيدها',!asErr(OWNER,`update fleet_vehicles set is_test=true where id='${V2}'`)&&!asErr(OWNER,`update fleet_vehicles set is_test=false where id='${V2}'`));
ps(`delete from fleet_vehicles where plate='N-9'`);

// ── التوزيع اليومي قبل السجلات: Midul وحده ──
ok('daily_team قبل السجلات: Midul فقط',as(MIDUL,`select string_agg(employee_id, ',') from daily_team()`)==='1648');

// ── القسم 3: السجلات ──
const e3=err(s3),e4=err(s3);
ok('القسم 3 يُطبَّق مرتين بلا خطأ ولا تكرار'+(e3||e4?' — '+String(e3||e4).slice(0,300):''),!e3&&!e4
  &&ps(`select count(*) from employees where employee_id='TEST01'`)==='1'&&ps(`select count(*) from fleet_vehicles where plate='TEST-0000'`)==='1');
const E_T=ps(`select id from employees where employee_id='TEST01'`);
ok('TEST01: «بايكر تجريبي»، تجريبي، المشغّل الوحيد، بلا فريق ولا دور',ps(`select full_name||'|'||is_test||'|'||operator_id||'|'||coalesce(team_id::text,'-')||'|'||coalesce(staff_role,'-') from employees where id='${E_T}'`)===`بايكر تجريبي|true|${OP}|-|-`);
ok('TEST-0000: بوكسر 2024، active، نشطة، تجريبية، مخصّصة لـ TEST01، بلا GPS',ps(`select make||'|'||model_year||'|'||status||'|'||active||'|'||is_test||'|'||biker_employee_id||'|'||has_gps||'|'||current_biker from fleet_vehicles where plate='TEST-0000'`)
  ===`بوكسر|2024|active|true|true|${E_T}|false|بايكر تجريبي (TEST01)`);
ok('الحساب: TEST01، خارج التوزيع، تجريبي، والاسم كما هو',ps(`select biker_employee_id||'|'||in_daily_split||'|'||is_test||'|'||display_name||'|'||is_owner from app_users where id='${ACC}'`)==='TEST01|false|true|12345|false');
ok('سجل «عمر المالكي» لم يُمسّ',ps(`select coalesce(employee_id,'-')||'|'||staff_role||'|'||is_test from employees where id='${E_OMAR}'`)==='-|manager|false');
ok('الحساب يرى دراجته الوهمية في البوابة',ps(`select set_config('test.uid','${ACC}',false); select plate from _fleet_my_vehicle()`).split('\n').pop()==='TEST-0000'&&as(ACC,`select public.my_employee_uuid()`)===E_T);

// ── الاستبعاد ──
ps(`update app_users set in_daily_split=true where id='${ACC}'`);  // حتى لو أُعيد إدخاله يدوياً
ok('daily_team: التجريبي لا يستلم نصيباً حتى مع in_daily_split=true (حارس is_test مستقل)، والحساب التجريبي لا يرى الفريق الحقيقي',as(MIDUL,`select string_agg(employee_id, ',') from daily_team()`)==='1648'&&as(ACC,`select count(*) from daily_team()`)==='0');
ps(`update app_users set in_daily_split=false where id='${ACC}'`);
ok('daily_split_list: لا يظهر التجريبي',as(SUP,`select string_agg(employee_id, ',') from daily_split_list()`)==='1648');
ok('set_daily_split: إدخال التجريبي ⇒ TEST_ACCOUNT، وإخراجه مسموح، وبقية الدرّاجين كما هم',/TEST_ACCOUNT/.test(asErr(SUP,`select set_daily_split('${E_T}',true)`)||'')
  &&as(SUP,`select set_daily_split('${E_T}',false)`)==='1'&&as(SUP,`select set_daily_split('${E_MIDUL}',true)`)==='1');
ok('relaunch_roster: بلا التجريبي',as(SUP,`select string_agg(biker_employee_id, ',') from relaunch_roster()`)==='1648');

// ── الإشعارات ──
const rt=as(ACC,`select request_fuel(100,'https://x/t.jpg')`),rr=as(MIDUL,`select request_fuel(9000,'https://x/r.jpg')`);
ok('طلب الدراجة التجريبية: يصل للمالك ببادئة «🧪 تجريبي — »',ps(`select title from notifications where dedupe_key='fuel-req-${rt}-owner'`)==='🧪 تجريبي — طلب وقود جديد — TEST-0000');
ok('طلب الدراجة الحقيقية بلا بادئة',ps(`select title from notifications where dedupe_key='fuel-req-${rr}-owner'`)==='طلب وقود جديد — M-1');
as(OWNER,`select transfer_fuel_request('${rt}','REF-T')`);as(OWNER,`select transfer_fuel_request('${rr}','REF-R')`);
ok('إشعار الدرّاج التجريبي ببادئة عربي + بنغالي، والحقيقي بلا بادئة',ps(`select title from notifications where dedupe_key='fuel-tr-${rt}-${ACC}'`).startsWith('🧪 تجريبي · পরীক্ষামূলক — ')
  &&!ps(`select title from notifications where dedupe_key='fuel-tr-${rr}-${MIDUL}'`).startsWith('🧪'));
const mt=as(ACC,`select request_oil_change(150,'https://x/o.jpg')`);
ok('طلب الزيت التجريبي ببادئة',ps(`select title from notifications where dedupe_key='oil-req-${mt}-owner'`).startsWith('🧪 تجريبي — '));
ps(`select daily_digest()`);
const dig=ps(`select body from notifications where category='digest'`);
ok('الملخّص اليومي يعدّ الحقيقي فقط: fleet (2) = طلب Midul + تحويله',/fleet \(2\)/.test(dig));

// ── fleet_alerts لم تُمسّ: تعمل وتعيد صفوف الدراجة الوهمية كغيرها (الشارة في الواجهة) ──
ok('fleet_alerts() تعمل للمالك',!asErr(OWNER,`select count(*) from fleet_alerts()`));

// ── القسم 3 محروس ──
ps(`insert into app_users (id,display_name,biker_employee_id) values ('00000000-0000-0000-0000-0000000000cc','x','TEST01')`);
ok('حساب آخر مرتبط بـ TEST01 ⇒ البند 3.3 يتوقف',/حساب آخر/.test(err(s3)||''));
ps(`delete from app_users where id='00000000-0000-0000-0000-0000000000cc'`);
ps(`insert into operators values (gen_random_uuid())`);
ok('أكثر من مشغّل ⇒ البند 3.1 يتوقف',/مشغّل واحد/.test(err(s3)||''));
}finally{if(!process.env.KEEPDB)ps(`drop database if exists ${db}`,'postgres');else console.log(db);}
