// طلبات الوقود والزيت و«تنبيهات الأسطول» على Postgres محلي: docs/sql/fleet_requests.sql (الجداول + RLS + الدوال + fleet_alerts + علامة legacy).
// يعمل فقط مع PGTEST_PORT (مثلاً PGTEST_PORT=55432 npm test)؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='fr_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
// بصفة مستخدم مسجّل أو زائر (RLS والصلاحيات)
const as=(uid,sql,role='authenticated')=>ps(`begin; set local role ${role}; select set_config('test.uid','${uid}',true); ${sql}; commit;`).split('\n').pop();
const asErr=(uid,sql,role='authenticated')=>err(`begin; set local role ${role}; select set_config('test.uid','${uid}',true); ${sql}; commit;`);

const OWNER='00000000-0000-0000-0000-00000000000a',MIDUL='00000000-0000-0000-0000-000000001648',ABED='00000000-0000-0000-0000-000000000ab0',
  FA_EDIT='00000000-0000-0000-0000-0000000000e1',FA_VIEW='00000000-0000-0000-0000-0000000000e2',FLEET='00000000-0000-0000-0000-0000000000f1',
  NOBODY='00000000-0000-0000-0000-0000000000ff',NOBIKE='00000000-0000-0000-0000-000000000b0b';
const E_MIDUL='10000000-0000-0000-0000-000000001648',E_ABED='10000000-0000-0000-0000-000000000ab0',E_NOBIKE='10000000-0000-0000-0000-000000000b0b';
const V1='20000000-0000-0000-0000-000000000001',V2='20000000-0000-0000-0000-000000000002',V3='20000000-0000-0000-0000-000000000003',
  V4='20000000-0000-0000-0000-000000000004',V5='20000000-0000-0000-0000-000000000005',V6='20000000-0000-0000-0000-000000000006';

ps(`create database ${db}`,'postgres');
try{
ps(`do $$ begin create role anon; exception when others then null; end $$;
do $$ begin create role authenticated; exception when others then null; end $$;
create schema auth; create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('test.uid',true),'')::uuid $f$;
grant usage on schema auth to authenticated, anon;
create table public.app_users (id uuid primary key, is_owner boolean not null default false, biker_employee_id text, active boolean not null default true);
create table public.user_permissions (user_id uuid, module text, can_view boolean, can_edit boolean);
create table public.employees (id uuid primary key, full_name text, employee_id text, operator_id uuid);
create function public.is_owner() returns boolean language sql stable security definer set search_path to 'public' as $f$ select exists(select 1 from public.app_users where id = auth.uid() and is_owner and active) $f$;
create function public.has_perm(p_module text, p_need_edit boolean default false) returns boolean language sql stable security definer set search_path to 'public' as $f$
  select public.is_owner() or exists(select 1 from public.user_permissions up join public.app_users au on au.id = up.user_id where up.user_id = auth.uid() and au.active and up.module = p_module and (up.can_view or up.can_edit) and (not p_need_edit or up.can_edit)) $f$;
create function public.my_biker_id() returns text language sql stable security definer set search_path to 'public' as $f$ select btrim(biker_employee_id) from public.app_users where id = auth.uid() and active and coalesce(biker_employee_id,'') <> '' $f$;
create function public.my_employee_uuid() returns uuid language sql stable security definer set search_path to 'public' as $f$ select e.id from public.employees e where e.employee_id = public.my_biker_id() limit 1 $f$;
create table public.fleet_vehicles (id uuid primary key, operator_id uuid, plate text, biker_employee_id uuid references public.employees(id), held_by uuid, active boolean, created_at timestamptz default now());
create table public.fuel_logs (id uuid primary key default gen_random_uuid(), operator_id uuid, vehicle_id uuid references public.fleet_vehicles(id), plate text, biker_employee_id text, biker_name text,
  fuel_type text not null default 'petrol', fill_at timestamptz default now(), odometer numeric, liters numeric, amount numeric, odometer_photo_url text, receipt_photo_url text, notes text,
  status text not null default 'submitted', reviewed_by uuid, reviewed_at timestamptz, created_by uuid, created_at timestamptz default now());
alter table public.fuel_logs enable row level security;
create policy fl_sel on public.fuel_logs for select using ((biker_employee_id = my_biker_id()) or has_perm('fleet'));
create policy fl_ins on public.fuel_logs for insert with check ((biker_employee_id = my_biker_id()) or has_perm('fleet', true));
create table public.audit_log (table_name text, row_id uuid, action text, actor uuid);
create function public.audit_capture() returns trigger language plpgsql security definer set search_path to 'public' as $f$
  begin insert into public.audit_log values (TG_TABLE_NAME, (to_jsonb(coalesce(NEW, OLD))->>'id')::uuid, TG_OP, auth.uid()); return coalesce(NEW, OLD); end $f$;
create table public.notif_log (audience text, uid uuid, cat text, title text, body text, dedupe text unique);
create function public.push_notification(p_audience text, p_user uuid, p_category text, p_severity text, p_title text, p_body text, p_module text, p_entity text, p_dedupe text) returns void
  language sql security definer as $f$ insert into public.notif_log values (p_audience,p_user,p_category,p_title,p_body,p_dedupe) on conflict (dedupe) do nothing $f$;
-- صلاحيات Supabase الافتراضية: كل جدول جديد مفتوح لـ anon و authenticated (الملف يجب أن يسحبها)
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
insert into app_users values ('${OWNER}',true,null,true),('${MIDUL}',false,'1648',true),('${ABED}',false,'2637651411',true),('${FA_EDIT}',false,null,true),
  ('${FA_VIEW}',false,null,true),('${FLEET}',false,null,true),('${NOBODY}',false,null,true),('${NOBIKE}',false,'9999',true);
insert into user_permissions values ('${FA_EDIT}','fleet_alerts',true,true),('${FA_VIEW}','fleet_alerts',true,false),('${FLEET}','fleet',true,true);
insert into employees values ('${E_MIDUL}','Midul Hassan','1648',null),('${E_ABED}','Abed mia','2637651411',null),('${E_NOBIKE}','No Bike','9999',null);
insert into fleet_vehicles values ('${V1}',null,'M-1','${E_MIDUL}',null,true),('${V2}',null,'A-2','${E_ABED}',null,true),
  ('${V3}',null,'T-3',null,null,true),('${V4}',null,'T-4',null,null,true),('${V5}',null,'T-5',null,null,true),('${V6}',null,'T-6',null,null,true);
-- التاريخ اليدوي: 7 صفوف مدفوعة بلا عدّاد ولا مركبة + صف عابد التجريبي
insert into fuel_logs (biker_employee_id,biker_name,fuel_type,fill_at,amount,status) select '1648','Midul Hassan','بنزين','2026-09-03'::timestamptz + (i||' days')::interval,50,'paid' from generate_series(1,7) i;
insert into fuel_logs (vehicle_id,plate,biker_employee_id,fuel_type,fill_at,odometer,amount,status) values ('${V2}','A-2','2637651411','petrol','2026-10-04',24,0,'submitted');`);

const file=fs.readFileSync('docs/sql/fleet_requests.sql','utf8');
const e1=err(file),e2=err(file);
ok('الملف يُطبَّق مرتين بلا خطأ'+(e1||e2?' — '+String(e1||e2).slice(0,300):''),!e1&&!e2);
if(e1||e2)process.exit(1);
const s12=file.slice(file.indexOf('═══ 1)'),file.indexOf('═══ 3)'));
ok('القسمان 1 و2 بلا كلمة drop أو delete إطلاقاً (أداة MCP تتعطل عليها)',!/drop|delete/i.test(s12));

// ── البنية والصلاحيات ──
ok('الجداول الثلاثة + عمودا fuel_logs',ps(`select count(*) from information_schema.tables where table_name in ('fuel_requests','maintenance_requests','fleet_alert_settings')`)==='3'
  &&ps(`select count(*) from information_schema.columns where table_name='fuel_logs' and column_name in ('request_id','legacy')`)==='2');
ok('RLS مفعّل على الجداول الثلاثة',ps(`select bool_and(relrowsecurity) from pg_class where relname in ('fuel_requests','maintenance_requests','fleet_alert_settings')`)==='t');
ok('الحدود الافتراضية التسعة كما وافق المالك',ps(`select string_agg(key||'='||value, ',' order by key) from fleet_alert_settings where vehicle_id is null`)===
  'fill_gap_hours=12,fill_gap_km=150,fuel_low_pct=25,fuel_min_km_per_50=600,fuel_price_91=2.18,odo_max_km_per_day=400,oil_exec_days=5,oil_interval_km=2000,receipt_grace_days=5');
ok('الدوال الثلاث عشرة security definer',ps(`select count(*)||'/'||count(*) filter (where prosecdef) from pg_proc where proname in ('request_fuel','add_fuel_fill','request_oil_change','confirm_oil_change','transfer_fuel_request','send_oil_to_sweater','approve_oil_change','set_fleet_alert_setting','fleet_alerts','_fleet_my_vehicle','_fleet_setting','_fleet_notify_admins','_fleet_notify_biker')`)==='13/13');
ok('anon: لا قراءة لـ fuel_logs ولا fuel_requests، ولا تنفيذ request_fuel',ps(`select has_table_privilege('anon','public.fuel_logs','select')::text||has_table_privilege('anon','public.fuel_requests','select')::text||has_function_privilege('anon','public.request_fuel(numeric,text,numeric)','execute')::text`)==='falsefalsefalse');
ok('المسجّل: قراءة فقط على الجداول الجديدة، ولا تنفيذ للدوال المساعدة',ps(`select has_table_privilege('authenticated','public.fuel_requests','select')::text||has_table_privilege('authenticated','public.fuel_requests','insert')::text||has_table_privilege('authenticated','public.maintenance_requests','update')::text||has_function_privilege('authenticated','public._fleet_notify_admins(text,text,text,text)','execute')::text`)==='truefalsefalsefalse');
ok('الكتابة المباشرة في fuel_requests مرفوضة حتى للمالك (عبر الدوال فقط)',/permission denied/.test(asErr(OWNER,`insert into fuel_requests (vehicle_id,biker_employee_id,odometer,odometer_photo_url) values ('${V1}','1648',1,'x')`)||''));

ok('الدرّاج لا يكتب legacy ولا request_id مباشرة، والإدراج القديم (بلا العمودين) يبقى يعمل',
  /permission denied/.test(asErr(MIDUL,`insert into fuel_logs (biker_employee_id,odometer,amount,legacy) values ('1648',1,1,true)`)||'')
  &&/permission denied/.test(asErr(MIDUL,`update fuel_logs set legacy=true where biker_employee_id='1648'`)||'')
  &&!asErr(MIDUL,`insert into fuel_logs (biker_employee_id,odometer,amount,fill_at,notes) values ('1648',1,1,'2026-09-01','old-screen')`));
ps(`delete from fuel_logs where notes='old-screen'`);
ok('صاحب fleet_alerts (بلا «الأسطول») يقرأ التعبئات التي تشير إليها التنبيهات',as(FA_VIEW,`select count(*) from fuel_logs`)===ps(`select count(*) from fuel_logs`)&&as(NOBODY,`select count(*) from fuel_logs`)==='0');

// ── طلب الوقود ──
const r1=as(MIDUL,`select request_fuel(10000,'https://x/odo1.jpg')`);
ok('الدرّاج يطلب: الدراجة والهوية من القاعدة، 50﷼ افتراضياً، الحالة «مطلوب»',ps(`select vehicle_id||'|'||plate||'|'||biker_employee_id||'|'||biker_name||'|'||amount||'|'||status from fuel_requests where id='${r1}'`)===`${V1}|M-1|1648|Midul Hassan|50|requested`);
ok('إشعار «طلب وقود جديد» للمالك ولصاحب fleet_alerts تعديل فقط (لا للعرض فقط)',ps(`select string_agg(audience||':'||coalesce(uid::text,'-'), ',' order by audience) from notif_log where dedupe like 'fuel-req-${r1}%'`)===`owner:-,user:${FA_EDIT}`);
ok('بلا دراجة ⇒ NO_BIKE، وغير درّاج ⇒ NOT_A_BIKER',/NO_BIKE/.test(asErr(NOBIKE,`select request_fuel(1,'u')`)||'')&&/NOT_A_BIKER/.test(asErr(FA_EDIT,`select request_fuel(1,'u')`)||''));
ok('الرفض فقط لنقص الحقول: صورة ⇒ PHOTO_REQUIRED، مبلغ 0 ⇒ AMOUNT_REQUIRED، عدّاد ⇒ ODOMETER_REQUIRED',
  /PHOTO_REQUIRED/.test(asErr(MIDUL,`select request_fuel(1,'  ')`)||'')&&/AMOUNT_REQUIRED/.test(asErr(MIDUL,`select request_fuel(1,'u',0)`)||'')&&/ODOMETER_REQUIRED/.test(asErr(MIDUL,`select request_fuel(null,'u')`)||''));
ok('لا منع: طلب ثانٍ بعد 5 كم يُقبل',!!as(MIDUL,`select request_fuel(10005,'https://x/odo2.jpg')`));
ok('الدرّاج يرى طلباته فقط',as(MIDUL,`select count(*) from fuel_requests`)==='2'&&as(ABED,`select count(*) from fuel_requests`)==='0'&&as(NOBODY,`select count(*) from fuel_requests`)==='0');
ok('صاحب fleet_alerts (عرض) يرى الكل',as(FA_VIEW,`select count(*) from fuel_requests`)==='2');

// ── التحويل ──
ok('التحويل: عرض فقط ⇒ FORBIDDEN، والدرّاج ⇒ FORBIDDEN',/FORBIDDEN/.test(asErr(FA_VIEW,`select transfer_fuel_request('${r1}','REF')`)||'')&&/FORBIDDEN/.test(asErr(MIDUL,`select transfer_fuel_request('${r1}','REF')`)||''));
ok('التحويل بلا مرجع ⇒ REF_REQUIRED، وبتاريخ مستقبلي أو قبل الطلب ⇒ BAD_DATE',/REF_REQUIRED/.test(asErr(FA_EDIT,`select transfer_fuel_request('${r1}',' ')`)||'')
  &&/BAD_DATE/.test(asErr(FA_EDIT,`select transfer_fuel_request('${r1}','X',now()+interval '30 days')`)||'')&&/BAD_DATE/.test(asErr(FA_EDIT,`select transfer_fuel_request('${r1}','X',now()-interval '30 days')`)||''));
as(FA_EDIT,`select transfer_fuel_request('${r1}','9112102600000001')`);
ok('حُوِّل: المرجع ومن حوّل، وإشعار حالة للدرّاج نفسه',ps(`select status||'|'||transfer_ref||'|'||transferred_by from fuel_requests where id='${r1}'`)===`transferred|9112102600000001|${FA_EDIT}`
  &&ps(`select count(*) from notif_log where dedupe='fuel-tr-${r1}-${MIDUL}' and audience='user' and uid='${MIDUL}'`)==='1');
ok('تحويل مرتين ⇒ NOT_REQUESTED',/NOT_REQUESTED/.test(asErr(OWNER,`select transfer_fuel_request('${r1}','X')`)||''));

// ── التعبئات ──
const f1=as(MIDUL,`select add_fuel_fill(10010,25,11,'https://x/o.jpg','https://x/r.jpg')`);
ok('التعبئة تُربط بآخر طلب محوَّل، بنزين، بلا legacy',ps(`select request_id||'|'||fuel_type||'|'||legacy||'|'||vehicle_id from fuel_logs where id='${f1}'`)===`${r1}|petrol|false|${V1}`);
ok('التعبئة بلا فاتورة ⇒ PHOTO_REQUIRED، ولترات سالبة ⇒ BAD_LITERS',/PHOTO_REQUIRED/.test(asErr(MIDUL,`select add_fuel_fill(10010,25,null,'https://x/o.jpg','')`)||'')
  &&/BAD_LITERS/.test(asErr(MIDUL,`select add_fuel_fill(10010,25,-11,'https://x/o.jpg','https://x/r.jpg')`)||''));
const r3=as(MIDUL,`select request_fuel(10600,'https://x/odo3.jpg')`);
ok('الطلب التالي يغلق المحوَّل السابق تلقائياً، ويبقى «المطلوب» غير المحوَّل كما هو',ps(`select string_agg(status, ',' order by requested_at) from fuel_requests where vehicle_id='${V1}'`)==='closed,requested,requested'&&!!r3);
ok('بعد إغلاق الطلب المحوَّل بطلب أحدث لم يُحوَّل، التعبئة تُربط بآخر تحويل (المال المصروف)',ps(`select request_id from fuel_logs where id='${as(MIDUL,`select add_fuel_fill(10650,20,null,'https://x/o.jpg','https://x/r.jpg')`)}'`)===r1);
ok('تعبئة بلا أي تحويل للدراجة تُقبل (request_id فارغ)',ps(`select request_id is null from fuel_logs where id='${as(ABED,`select add_fuel_fill(30,20,null,'https://x/o.jpg','https://x/r.jpg')`)}'`)==='t');

// ── الحيازة المؤقتة: الطلب على الدراجة التي يحوزها الآن ──
ps(`update fleet_vehicles set held_by='${E_ABED}' where id='${V1}'`);
ok('حائز مؤقت ⇒ الطلب على الدراجة المحوزة، وصاحبها الأصلي بلا دراجة',ps(`select vehicle_id from fuel_requests where id='${as(ABED,`select request_fuel(10700,'https://x/h.jpg')`)}'`)===V1&&/NO_BIKE/.test(asErr(MIDUL,`select request_fuel(1,'u')`)||''));
ps(`update fleet_vehicles set held_by=null where id='${V1}'`);

// ── تغيير الزيت ──
const m1=as(MIDUL,`select request_oil_change(10800,'https://x/oil.jpg')`);
ok('طلب زيت: «مطلوب» + إشعار للإدارة',ps(`select status||'|'||kind from maintenance_requests where id='${m1}'`)==='requested|oil_change'&&ps(`select count(*) from notif_log where dedupe like 'oil-req-${m1}%'`)==='2');
ok('أُرسل لسويتر: قناة غير صالحة ⇒ CHANNEL_REQUIRED، وعرض فقط ⇒ FORBIDDEN',/CHANNEL_REQUIRED/.test(asErr(FA_EDIT,`select send_oil_to_sweater('${m1}','sms')`)||'')&&/FORBIDDEN/.test(asErr(FA_VIEW,`select send_oil_to_sweater('${m1}','whatsapp')`)||''));
as(FA_EDIT,`select send_oil_to_sweater('${m1}','whatsapp')`);
ok('أُرسل: الحالة والقناة، وإشعار حالة للدرّاج',ps(`select status||'|'||sent_channel from maintenance_requests where id='${m1}'`)==='sent|whatsapp'&&ps(`select count(*) from notif_log where dedupe='oil-sent-${m1}-${MIDUL}'`)==='1');
ok('تأكيد التنفيذ: درّاج آخر ⇒ NOT_FOUND، بلا اسم مسؤول سويتر ⇒ TECH_NAME_REQUIRED، بلا إثبات ⇒ PHOTO_REQUIRED',
  /NOT_FOUND/.test(asErr(ABED,`select confirm_oil_change('${m1}',10810,'a','b','X')`)||'')&&/TECH_NAME_REQUIRED/.test(asErr(MIDUL,`select confirm_oil_change('${m1}',10810,'a','b',' ')`)||'')
  &&/PHOTO_REQUIRED/.test(asErr(MIDUL,`select confirm_oil_change('${m1}',10810,'a','','X')`)||''));
as(MIDUL,`select confirm_oil_change('${m1}',10810,'https://x/o2.jpg','https://x/sticker.jpg','Rashed')`);
ok('نُفّذ: العدّاد والإثبات والاسم محفوظة',ps(`select status||'|'||done_odometer||'|'||sweater_tech_name from maintenance_requests where id='${m1}'`)==='done|10810|Rashed');
ok('الاعتماد: عرض فقط ⇒ FORBIDDEN، ثم «معتمد» ويراه صاحب «الأسطول» في سجل الدراجة',/FORBIDDEN/.test(asErr(FA_VIEW,`select approve_oil_change('${m1}')`)||'')
  &&as(OWNER,`select approve_oil_change('${m1}','ok')`)==='t'&&as(FLEET,`select string_agg(status,',') from maintenance_requests where vehicle_id='${V1}'`)==='approved');
ok('الدرّاج لا يرى طلبات زيت غيره',as(ABED,`select count(*) from maintenance_requests`)==='0');

// ── الحدود ──
ok('ضبط الحدّ: عرض فقط ⇒ FORBIDDEN، مفتاح غير معروف ⇒ BAD_KEY، صفر أو نسبة ≥ 100 ⇒ BAD_VALUE',/FORBIDDEN/.test(asErr(FA_VIEW,`select set_fleet_alert_setting('fill_gap_km',100)`)||'')&&/BAD_KEY/.test(asErr(FA_EDIT,`select set_fleet_alert_setting('x',1)`)||'')
  &&/BAD_VALUE/.test(asErr(FA_EDIT,`select set_fleet_alert_setting('receipt_grace_days',0)`)||'')&&/BAD_VALUE/.test(asErr(FA_EDIT,`select set_fleet_alert_setting('fuel_low_pct',150)`)||''));
as(FA_EDIT,`select set_fleet_alert_setting('fill_gap_km',150)`);
ok('ضبط الحد العام مرة ثانية يحدّث الصف نفسه (upsert بلا تكرار)',ps(`select count(*)||':'||max(value) from fleet_alert_settings where key='fill_gap_km'`)==='1:150');
as(FA_EDIT,`select set_fleet_alert_setting('oil_interval_km',3000,'${V4}')`);
ok('تجاوز لدراجة يغلب العام، وتفريغه يعيدها للعام',ps(`select _fleet_setting('oil_interval_km','${V4}')||','||_fleet_setting('oil_interval_km','${V3}')`)==='3000,2000'
  &&as(FA_EDIT,`select set_fleet_alert_setting('oil_interval_km',null,'${V4}')`)==='t'&&ps(`select _fleet_setting('oil_interval_km','${V4}')`)==='2000');

// ── التنبيهات: سيناريوهات على دراجات T-3..T-6 (بيانات مباشرة كمالك القاعدة) ──
ps(`insert into fuel_requests (vehicle_id,plate,biker_employee_id,odometer,odometer_photo_url,requested_at,status,transferred_at) values
  ('${V3}','T-3','x',0,'u',now()-interval '40 days','closed',now()-interval '40 days'),('${V3}','T-3','x',900,'u',now()-interval '30 days','closed',now()-interval '30 days'),
  ('${V3}','T-3','x',1800,'u',now()-interval '20 days','closed',now()-interval '20 days'),('${V3}','T-3','x',2700,'u',now()-interval '10 days','closed',now()-interval '10 days'),
  ('${V3}','T-3','x',3000,'u',now()-interval '1 day','transferred',now()-interval '1 day'),
  ('${V4}','T-4','x',100,'u',now()-interval '20 days','closed',now()-interval '20 days'),('${V4}','T-4','x',600,'u',now()-interval '10 days','transferred',now()-interval '10 days');
-- تعبئة مرتبطة بكل تحويل (+5 كم بعد ساعة) ⇒ لا «بلا فواتير» ولا «بلا طلب»
insert into fuel_logs (vehicle_id,plate,biker_employee_id,fill_at,odometer,amount,request_id)
  select vehicle_id,plate,'x',requested_at+interval '1 hour',odometer+5,50,id from fuel_requests where plate in ('T-3','T-4');
-- مكرر غير محوَّل على T-3 بعد 5 كم: لا يدخل حساب الاستهلاك
insert into fuel_requests (vehicle_id,plate,biker_employee_id,odometer,odometer_photo_url,requested_at) values ('${V3}','T-3','x',3010,'u',now()-interval '12 hours');
insert into fuel_requests (vehicle_id,plate,biker_employee_id,odometer,odometer_photo_url,requested_at) values
  ('${V6}','T-6','x',8000,'u',now()-interval '5 days'),('${V6}','T-6','x',7000,'u',now()-interval '4 days');
-- طلب حُوِّل ثم أُغلق بطلب أحدث، ولا فاتورة له ⇒ يبقى «بلا فواتير»
insert into fuel_requests (vehicle_id,plate,biker_employee_id,odometer,odometer_photo_url,requested_at,status,transfer_ref,transferred_at,closed_at) values
  ('${V6}','T-6','x',7500,'u',now()-interval '8 days','closed','R6',now()-interval '7 days',now()-interval '5 days');
insert into fuel_requests (vehicle_id,plate,biker_employee_id,odometer,odometer_photo_url,requested_at,status,transfer_ref,transferred_at) values
  ('${V5}','T-5','x',4990,'u',now()-interval '7 days','transferred','R5',now()-interval '6 days');
insert into fuel_logs (vehicle_id,plate,biker_employee_id,fill_at,odometer,amount) values
  ('${V5}','T-5','x',now()-interval '2 days',5000,25),('${V5}','T-5','x',now()-interval '1 day',5050,25),('${V6}','T-6','x',now()-interval '3 days',9500,25);
insert into fuel_logs (vehicle_id,plate,biker_employee_id,fill_at,odometer,amount,legacy) values ('${V5}','T-5','x',now()-interval '1 hour',10,50,true);
insert into maintenance_requests (vehicle_id,plate,biker_employee_id,odometer,odometer_photo_url,requested_at,status,done_odometer,done_at,approved_at) values
  ('${V3}','T-3','x',950,'u',now()-interval '26 days','approved',960,now()-interval '25 days',now()-interval '25 days');
insert into maintenance_requests (vehicle_id,plate,biker_employee_id,odometer,odometer_photo_url,requested_at) values ('${V4}','T-4','x',650,'u',now()-interval '6 days');`);
const A=as(FA_VIEW,`select string_agg(plate||':'||kind, ',' order by plate, kind) from fleet_alerts() where plate like 'T-%'`);
const has=k=>A.split(',').includes(k);
ok('استهلاك عالٍ بعد 3 فترات: 300 كم مقابل متوسط 900 (حد 675) ⇒ «فحص صيانة مقترح»',has('T-3:high_consumption')
  &&as(FA_VIEW,`select value||'/'||threshold from fleet_alerts() where plate='T-3' and kind='high_consumption'`)==='300/675');
ok('استهلاك عالٍ قبل 3 فترات: 500 كم < 600 (الحد المطلق)',has('T-4:high_consumption'));
ok('تعبئتان متقاربتان (50 كم)',has('T-5:close_fills'));
ok('حُوِّل منذ 6 أيام بلا فاتورة (المهلة 5)، ويبقى ظاهراً بعد إغلاق الطلب بطلب أحدث',has('T-5:no_receipts')&&has('T-6:no_receipts')&&!has('T-3:no_receipts')&&!has('T-4:no_receipts'));
ok('تعبئة بلا طلب',has('T-5:fill_without_request')&&has('T-6:fill_without_request'));
ok('عدّاد أقل من السابق (7000 بعد 8000)',has('T-6:odometer_backwards'));
ok('قفزة عدّاد (2500 كم في يوم)',has('T-6:odometer_jump'));
ok('صف legacy (عدّاد 10) لا يطلق «عدّاد أقل»',!has('T-5:odometer_backwards'));
ok('استحقاق الزيت: 3010 − 960 ≥ 2000',has('T-3:oil_due'));
ok('طلبات غير محوَّلة (مكررة بعد 5 كم) لا تطلق «استهلاك عالٍ»',!A.split(',').some(k=>k==='M-1:high_consumption')&&as(FA_VIEW,`select count(*) from fleet_alerts() where plate='M-1' and kind='high_consumption'`)==='0');
ok('صف واحد لكل (نوع، مرجع) في التنبيهات',as(FA_VIEW,`select count(*) = count(distinct (kind, ref_table, ref_id)) from fleet_alerts()`)==='t');
ok('طلب زيت مطلوب منذ 6 أيام (المهلة 5) ⇒ لم يُنفَّذ، ولا «مستحق» مع طلب مفتوح',has('T-4:oil_overdue')&&!has('T-4:oil_due'));
ok('لا تنبيهات زائفة: 12 تنبيهاً بالضبط على T-3..T-6 — '+A,A.split(',').length===12);
ok('fleet_alerts لغير صاحب الصلاحية ⇒ لا صفوف (حتى للدرّاج)',as(NOBODY,`select count(*) from fleet_alerts()`)==='0'&&as(MIDUL,`select count(*) from fleet_alerts()`)==='0');
ok('التنبيهات لكل دراجة: لا عمود درّاج في النتيجة',(()=>{const c=ps(`select array_to_string(proargnames, ',') from pg_proc where proname='fleet_alerts'`);return c.includes('vehicle_id')&&!/biker/.test(c);})());

// ── القسم 3: علامة legacy (معاملة محروسة بعدد الصفوف) ──
const leg=file.split('\n').filter(l=>/^-- (do \$\$|  update public\.fuel_logs set legacy|  where status = 'paid'|  get diagnostics|  if n <> 7|end \$\$;)/.test(l)).map(l=>l.replace(/^-- /,'')).join('\n');
ok('القسم 3 يعلّم الصفوف السبعة المدفوعة فقط (لا صف عابد التجريبي)',!err(leg)&&ps(`select count(*) from fuel_logs where legacy and status='paid' and vehicle_id is null`)==='7'&&ps(`select legacy from fuel_logs where amount=0`)==='f');
ok('إعادة تشغيل القسم 3 ترفض (0 ≠ 7) ولا تغيّر شيئاً',/المتوقع 7/.test(err(leg)||'')&&ps(`select count(*) from fuel_logs where legacy`)==='8');
}finally{ps(`drop database if exists ${db}`,'postgres');}
