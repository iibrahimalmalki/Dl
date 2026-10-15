// «آخر نشاط» و«آخر تسجيل في البوابة» على Postgres محلي (docs/sql/users_activity_ex.sql)
// يعمل فقط مع PGTEST_PORT؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='uae_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
const as=(uid,sql)=>ps(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`).split('\n').pop();
const asErr=(uid,sql)=>err(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`);
const F=fs.readFileSync(new URL('../docs/sql/users_activity_ex.sql',import.meta.url),'utf8');

const OWNER='00000000-0000-0000-0000-00000000000a',SUP='00000000-0000-0000-0000-00000000005b',B1='00000000-0000-0000-0000-000000001648',B2='00000000-0000-0000-0000-000000001700',B3='00000000-0000-0000-0000-000000001624',NEW='00000000-0000-0000-0000-0000000000ff';
ps(`create database ${db}`,'postgres');
try{
ok('الملف بلا drop ولا delete ولا truncate خارج التعليقات (أداة MCP)',!/\bdrop\b|\bdelete\b|\btruncate\b/i.test(F.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n')));
ok('الرأس: حالة «لم يُطبَّق» أو «طُبِّق YYYY-MM-DD»',/الحالة: \*\*(لم يُطبَّق|طُبِّق \d{4}-\d{2}-\d{2})\*\*/.test(F));
ps(`do $$ begin create role anon; exception when others then null; end $$;
do $$ begin create role authenticated; exception when others then null; end $$;
create schema auth; create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('test.uid',true),'')::uuid $f$;
grant usage on schema auth to authenticated, anon;
create table auth.users (id uuid primary key, last_sign_in_at timestamptz);
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz, updated_at timestamptz, refreshed_at timestamp, not_after timestamptz);
create table public.app_users (id uuid primary key, is_owner boolean not null default false, active boolean not null default true, biker_employee_id text);
create function public.is_owner() returns boolean language sql stable security definer set search_path to 'public' as $f$ select exists(select 1 from public.app_users where id = auth.uid() and is_owner and active) $f$;
create table public.bike_handovers (id uuid primary key default gen_random_uuid(), biker_employee_id text, direction text, created_by uuid, created_at timestamptz);
create table public.biker_assets (id uuid primary key default gen_random_uuid(), biker_employee_id text, kind text, created_by uuid, created_at timestamptz);
create table public.fuel_requests (id uuid primary key default gen_random_uuid(), biker_employee_id text, created_by uuid, requested_at timestamptz);
create table public.support_tickets (id uuid primary key default gen_random_uuid(), user_id uuid, biker_employee_id text, created_at timestamptz);
create table public.fuel_logs (id uuid primary key default gen_random_uuid(), biker_employee_id text, created_by uuid, created_at timestamptz, legacy boolean default false);
create table public.maintenance_requests (id uuid primary key default gen_random_uuid(), biker_employee_id text, kind text default 'oil_change', created_by uuid, requested_at timestamptz, done_at timestamptz);
create table public.employees (id uuid primary key, full_name text, employee_id text);
create table public.daily_deliveries (id uuid primary key default gen_random_uuid(), received_by uuid, created_at timestamptz);
create table public.daily_shares (id uuid primary key default gen_random_uuid(), delivery_id uuid, employee_id uuid, status text, confirmed_at timestamptz);
grant select on all tables in schema public to authenticated;
insert into public.app_users values ('${OWNER}',true,true,null),('${SUP}',false,true,null),('${B1}',false,true,'1648'),('${B2}',false,true,'1700'),('${B3}',false,true,' 1624 '),('${NEW}',false,true,'2637651411');
insert into auth.users values ('${OWNER}','2026-10-14 08:00+00'),('${SUP}','2026-10-10 08:00+00'),('${B1}','2026-10-01 08:00+00'),('${B2}',null),('${B3}','2026-09-01 08:00+00'),('${NEW}',null);
-- جلسات: المالك جلستان (الأحدث تجديداً 14/10 10:00 UTC) · المشرف جلسة لم تُجدَّد (created 12/10) · ميدول جلسة مجدّدة 13/10 · رقيب وعريف بلا جلسة
insert into auth.sessions (user_id,created_at,updated_at,refreshed_at) values
 ('${OWNER}','2026-10-01 00:00+00','2026-10-01 00:00+00','2026-10-05 00:00'),('${OWNER}','2026-10-13 00:00+00','2026-10-13 00:00+00','2026-10-14 10:00'),
 ('${SUP}','2026-10-12 09:00+00','2026-10-12 09:00+00',null),('${B1}','2026-10-01 00:00+00','2026-10-01 00:00+00','2026-10-13 18:30');
-- البوابة: ميدول طلب وقود 13/10 (الأحدث) واستلام 09/10 · المشرف أدخل استلاماً لرقيب 14/10 (لا يُحسب لرقيب) · رقيب دعم 08/10 · عريف إقرار عهدة 03/10
insert into public.fuel_requests (biker_employee_id,created_by,requested_at) values ('1648','${B1}','2026-10-13 18:22+00');
insert into public.bike_handovers (biker_employee_id,direction,created_by,created_at) values ('1648','receive','${B1}','2026-10-09 22:17+00'),('1700','receive','${SUP}','2026-10-14 07:00+00');
insert into public.support_tickets (user_id,biker_employee_id,created_at) values ('${B2}','1700','2026-10-08 20:38+00');
insert into public.biker_assets (biker_employee_id,kind,created_by,created_at) values ('1624','baseline','${B3}','2026-10-03 16:23+00');`);
ps(F);ps(F);
ok('آمن لإعادة التشغيل',true);

const rows=JSON.parse(as(OWNER,`select json_object_agg(user_id, json_build_object('in',last_sign_in_at,'act',last_active_at,'p',portal_last_at,'k',portal_last_kind)) from admin_users_activity_ex()`));
const T=x=>x&&new Date(x).toISOString();
ok('صف لكل مستخدم في app_users (6)',Object.keys(rows).length===6);
ok('آخر دخول كما في auth.users',T(rows[OWNER].in)==='2026-10-14T08:00:00.000Z'&&rows[B2].in===null);
ok('آخر نشاط = أحدث refreshed_at بين جلسات المستخدم (UTC)',T(rows[OWNER].act)==='2026-10-14T10:00:00.000Z'&&T(rows[B1].act)==='2026-10-13T18:30:00.000Z');
ok('جلسة لم تُجدَّد بعد ⇒ وقت إنشائها/تحديثها',T(rows[SUP].act)==='2026-10-12T09:00:00.000Z');
ok('لا جلسة ⇒ null («لا جلسة نشطة»)',rows[B2].act===null&&rows[B3].act===null&&rows[NEW].act===null);
ok('آخر تسجيل في البوابة: الأحدث بين الجداول الأربعة مع نوعه (ميدول: طلب وقود)',T(rows[B1].p)==='2026-10-13T18:22:00.000Z'&&rows[B1].k==='fuel');
ok('ما أدخله المشرف نيابة عن البايكر لا يُحسب له (رقيب: دعمه 08/10 لا استلام المشرف 14/10)',T(rows[B2].p)==='2026-10-08T20:38:00.000Z'&&rows[B2].k==='support');
ok('إقرار العهدة يُحسب (عريف، ورقمه بمسافات يبقى بايكراً)',T(rows[B3].p)==='2026-10-03T16:23:00.000Z'&&rows[B3].k==='custody');
ok('بايكر بلا نشاط ⇒ null',rows[NEW].p===null&&rows[NEW].k===null);
ok('غير البايكر (المشرف/المالك) ⇒ لا سطر بوابة حتى لو أدخل سجلات',rows[SUP].p===null&&rows[OWNER].p===null);
// نوع آخر تسجيل: تسليم الدراجة وتحديث حالة العهدة يُميَّزان عن الاستلام والإقرار
ps(`insert into public.bike_handovers (biker_employee_id,direction,created_by,created_at) values ('1648','return','${B1}','2026-10-14 06:00+00');
insert into public.biker_assets (biker_employee_id,kind,created_by,created_at) values ('1624','update','${B3}','2026-10-04 09:00+00');`);
const r2=JSON.parse(as(OWNER,`select json_object_agg(user_id, json_build_object('p',portal_last_at,'k',portal_last_kind)) from admin_users_activity_ex()`));
ok('تسليم الدراجة ⇒ bike_return، والاستلام ⇒ bike_receive',r2[B1].k==='bike_return'&&rows[B1].k==='fuel'&&JSON.parse(as(OWNER,`select json_agg(portal_last_kind) from admin_users_activity_ex() where user_id='${B1}'`))[0]==='bike_return');
ok('تحديث حالة العهدة ⇒ custody_update، والإقرار الأول ⇒ custody',r2[B3].k==='custody_update'&&rows[B3].k==='custody');
// قرار المالك: كل ما يسجّله البايكر بنفسه — تعبئة وقود، تغيير زيت (طلب وتأكيد)، استلام يومي (استلام من المندوب وتأكيد حصته)
const E1='10000000-0000-0000-0000-000000001648',E2='10000000-0000-0000-0000-000000001700',E4='10000000-0000-0000-0000-000000002637';
const kindOf=uid=>JSON.parse(as(OWNER,`select json_build_object('p',portal_last_at,'k',portal_last_kind) from admin_users_activity_ex() where user_id='${uid}'`));
ps(`insert into public.employees values ('${E1}','Midul','1648'),('${E2}','Rakib','1700'),('${E4}','Abed','2637651411');
insert into public.fuel_logs (biker_employee_id,created_by,created_at,legacy) values ('2637651411','${SUP}','2026-10-15 09:00+00',true);`);
ok('تعبئة وقود أدخلتها الإدارة (مستوردة) لا تُحسب للبايكر',kindOf(NEW).k===null);
ps(`insert into public.fuel_logs (biker_employee_id,created_by,created_at) values ('2637651411','${NEW}','2026-10-10 09:00+00');`);
ok('تعبئة وقود بحسابه ⇒ fuel_fill',kindOf(NEW).k==='fuel_fill'&&T(kindOf(NEW).p)==='2026-10-10T09:00:00.000Z');
ps(`insert into public.maintenance_requests (biker_employee_id,created_by,requested_at,done_at) values ('2637651411','${NEW}','2026-10-11 09:00+00',null);`);
ok('طلب تغيير زيت ⇒ oil',kindOf(NEW).k==='oil'&&T(kindOf(NEW).p)==='2026-10-11T09:00:00.000Z');
ps(`update public.maintenance_requests set done_at='2026-10-12 09:00+00' where created_by='${NEW}';`);
ok('تأكيد تغيير الزيت (done_at) ⇒ oil بوقت التأكيد',kindOf(NEW).k==='oil'&&T(kindOf(NEW).p)==='2026-10-12T09:00:00.000Z');
const D1='40000000-0000-0000-0000-000000000001';
ps(`insert into public.daily_deliveries values ('${D1}','${E4}','2026-10-13 07:00+00');`);
ok('استلام يومي من المندوب (received_by = موظفه) ⇒ daily',kindOf(NEW).k==='daily'&&T(kindOf(NEW).p)==='2026-10-13T07:00:00.000Z');
ps(`insert into public.daily_shares (delivery_id,employee_id,status,confirmed_at) values ('${D1}','${E4}','pending',null),('${D1}','${E4}','confirmed','2026-10-13 08:00+00');`);
ok('تأكيد حصته اليومية ⇒ daily بوقت التأكيد، والحصة المعلّقة لا تُحسب',kindOf(NEW).k==='daily'&&T(kindOf(NEW).p)==='2026-10-13T08:00:00.000Z');
ps(`insert into public.daily_deliveries (received_by,created_at) values ('${E2}','2026-10-16 07:00+00');`);
ok('الاستلام اليومي يُنسب لحساب الموظف نفسه فقط (رقيب، لا عابد)',kindOf(B2).k==='daily'&&T(kindOf(B2).p)==='2026-10-16T07:00:00.000Z'&&T(kindOf(NEW).p)==='2026-10-13T08:00:00.000Z');
ok('غير المالك ⇒ «owner only»',(asErr(SUP,`select count(*) from admin_users_activity_ex()`)||'').includes('owner only')&&(asErr(B1,`select count(*) from admin_users_activity_ex()`)||'').includes('owner only'));
ok('anon بلا تنفيذ، و authenticated بتنفيذ، و security definer',ps(`select has_function_privilege('anon','public.admin_users_activity_ex()','execute')`)==='f'&&ps(`select has_function_privilege('authenticated','public.admin_users_activity_ex()','execute')`)==='t'&&ps(`select prosecdef from pg_proc where proname='admin_users_activity_ex'`)==='t');
ok('قراءة فقط: لا تغيير في الجداول بعد الاستدعاء',ps(`select (select count(*) from auth.sessions)||','||(select count(*) from public.bike_handovers)`)==='4,3');
}finally{ps(`drop database if exists ${db} with (force)`,'postgres');}
