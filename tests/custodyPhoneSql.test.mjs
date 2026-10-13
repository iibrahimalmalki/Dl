// «الجوال» في العهدة على Postgres محلي: docs/sql/custody_phone.sql (IMEI + المواصفات + الفهرس الفريد + custody_review) فوق custody_lifecycle.sql.
// يعمل فقط مع PGTEST_PORT (مثلاً PGTEST_PORT=55432 npm test)؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='cp_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
// تشغيل بصفة مستخدم مسجّل (RLS)
const as=(uid,sql)=>ps(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`).split('\n').pop(); // السطر الأول نتيجة set_config
const asErr=(uid,sql)=>err(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`);

const OWNER='00000000-0000-0000-0000-00000000000a',MIDUL='00000000-0000-0000-0000-000000001648',ABED='00000000-0000-0000-0000-000000000ab0',
  SUP='00000000-0000-0000-0000-00000000005b',NOBODY='00000000-0000-0000-0000-0000000000ff';
const E_MIDUL='10000000-0000-0000-0000-000000001648',E_ABED='10000000-0000-0000-0000-000000000ab0';
const VAC='20000000-0000-0000-0000-000000000001',HELM='20000000-0000-0000-0000-000000000002',RAKIB_VAC='20000000-0000-0000-0000-000000000003';

ps(`create database ${db}`,'postgres');
try{
ps(`do $$ begin create role anon; exception when others then null; end $$;
do $$ begin create role authenticated; exception when others then null; end $$;
create schema auth; create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('test.uid',true),'')::uuid $f$;
grant usage on schema auth to authenticated, anon;
create table public.app_users (id uuid primary key, is_owner boolean not null default false, biker_employee_id text, active boolean not null default true);
create table public.user_permissions (user_id uuid, module text, can_view boolean, can_edit boolean);
create table public.employees (id uuid primary key, full_name text not null, employee_id text);
create function public.is_owner() returns boolean language sql stable security definer set search_path to 'public' as $f$ select exists(select 1 from public.app_users where id = auth.uid() and is_owner and active) $f$;
create function public.has_perm(p_module text, p_need_edit boolean default false) returns boolean language sql stable security definer set search_path to 'public' as $f$
  select public.is_owner() or exists(select 1 from public.user_permissions up join public.app_users au on au.id = up.user_id where up.user_id = auth.uid() and au.active and up.module = p_module and (up.can_view or up.can_edit) and (not p_need_edit or up.can_edit)) $f$;
create function public.my_biker_id() returns text language sql stable security definer set search_path to 'public' as $f$ select btrim(biker_employee_id) from public.app_users where id = auth.uid() and active and coalesce(biker_employee_id,'') <> '' $f$;
create function public.my_employee_uuid() returns uuid language sql stable security definer set search_path to 'public' as $f$ select e.id from public.employees e where e.employee_id = public.my_biker_id() limit 1 $f$;
create table public.custody_assets (id uuid primary key default gen_random_uuid(), operator_id uuid, employee_id uuid, biker_name text, sweater_id text, item_type text not null, category text, name text not null, name_en text,
  start_date date not null, life_months numeric not null, end_date date, lead_days int not null, cost numeric, status text not null default 'active', source text, round_id uuid, reorder_request_id uuid, notes text, created_at timestamptz not null default now(), created_by uuid);
alter table public.custody_assets enable row level security;
create policy ca_sel on public.custody_assets for select using (has_perm('supply') or has_perm('field_rounds'));
create policy ca_wr on public.custody_assets for all using (has_perm('supply', true) or has_perm('field_rounds', true)) with check (has_perm('supply', true) or has_perm('field_rounds', true));
create table public.supply_requests (id uuid primary key default gen_random_uuid(), seq bigint generated always as identity, ref text, operator_id uuid, round_id uuid, biker_name text, sweater_id text, requesting_dept text,
  items jsonb not null default '[]', status text not null default 'open', sla_hours int not null default 24, created_at timestamptz not null default now(), notes text, created_by uuid);
create table public.biker_assets (id uuid primary key default gen_random_uuid(), operator_id uuid, biker_employee_id text, biker_name text, items jsonb default '[]', pledge_accepted boolean default false, notes text, status text default 'submitted', created_by uuid, created_at timestamptz default now());
alter table public.biker_assets enable row level security;
create policy biker_assets_ins on public.biker_assets for insert to authenticated with check ((biker_employee_id = my_biker_id()) or is_owner() or has_perm('fleet', true));
create policy biker_assets_sel on public.biker_assets for select to authenticated using ((biker_employee_id = my_biker_id()) or is_owner() or has_perm('fleet', false));
create policy biker_assets_upd on public.biker_assets for all to authenticated using (is_owner() or has_perm('fleet', true)) with check (is_owner() or has_perm('fleet', true));
create function public.biker_assets_replace() returns trigger language plpgsql as $f$ begin return new; end $f$;
create trigger biker_assets_replace before insert on public.biker_assets for each row execute function public.biker_assets_replace();
create table public.notif_log (audience text, uid uuid, title text, body text, dedupe text);
create function public.push_notification(p_audience text, p_user uuid, p_category text, p_severity text, p_title text, p_body text, p_module text, p_entity text, p_dedupe text) returns void language sql security definer as $f$ insert into public.notif_log values (p_audience,p_user,p_title,p_body,p_dedupe) $f$;
grant select, insert, update, delete on all tables in schema public to authenticated;
insert into app_users values ('${OWNER}',true,null,true),('${MIDUL}',false,'1648',true),('${ABED}',false,'2637651411',true),('${SUP}',false,null,true),('${NOBODY}',false,null,true);
insert into user_permissions values ('${SUP}','supply',true,true);
insert into employees values ('${E_MIDUL}','Midul Hassan','1648'),('${E_ABED}','Abed mia','2637651411'),('10000000-0000-0000-0000-000000001700','Mohamad Rakib','1700');
insert into custody_assets (id,employee_id,biker_name,sweater_id,item_type,category,name,name_en,start_date,life_months,lead_days,end_date,source) values
 ('${VAC}','${E_MIDUL}','Midul Hassan','1648','tool','أدوات','المكنسة','Vacuum Cleaner','2026-08-07',18,45,'2028-02-07','round'),
 ('${HELM}','${E_MIDUL}','Midul Hassan','1648','safety','معدات حماية','الخوذة','Helmet','2026-08-07',24,60,'2028-08-07','round'),
 ('${RAKIB_VAC}','10000000-0000-0000-0000-000000001700','Mohamad Rakib','1700','tool','أدوات','المكنسة','Vacuum Cleaner','2026-08-05',18,45,'2028-02-05','round');
-- إقرار عابد القائم (قبل الملف)
insert into biker_assets (id,biker_employee_id,biker_name,items,pledge_accepted,status,created_at) values ('30000000-0000-0000-0000-000000000001','2637651411','Abed mia','[{"key":"helmet","condition":"good","qty":1}]',true,'declared','2026-10-03 16:23:05+00');`);


ps(fs.readFileSync('docs/sql/custody_lifecycle.sql','utf8'));
const file=fs.readFileSync('docs/sql/custody_phone.sql','utf8');
const s12=file.slice(file.indexOf('-- ═══ 1)'),file.indexOf('-- ═══ تحقق'));
ok('القسمان 1 و2 بلا كلمة drop أو delete (أداة MCP تتعطل عليها)',!/drop|delete/i.test(s12));
const e1=err(s12),e2=err(s12);
ok('الملف يُطبَّق مرتين بلا خطأ'+(e1||e2?' — '+String(e1||e2).slice(0,300):''),!e1&&!e2);
if(e1||e2)process.exit(1);

// ── البنية ──
ok('العمودان: serial_no نص اختياري، وspecs jsonb إلزامي افتراضه {}',ps(`select string_agg(column_name||':'||data_type||':'||is_nullable, ',' order by column_name) from information_schema.columns where table_name='custody_assets' and column_name in ('serial_no','specs')`)==='serial_no:text:YES,specs:jsonb:NO');
ok('القطع القائمة بلا تغيير (3 قطع، بلا رقم ولا مواصفات)',ps(`select count(*)||'|'||count(serial_no)||'|'||count(*) filter (where specs<>'{}') from custody_assets`)==='3|0|0');
ok('_imei_ok: صالح، خطأ Luhn، طول ناقص، أحرف، فارغ',ps(`select _imei_ok('490154203237518')::text||_imei_ok('490154203237519')::text||_imei_ok('49015420323751')::text||_imei_ok('49015420323751a')::text||coalesce(_imei_ok(null)::text,'null')`)==='truefalsefalsefalsefalse');
ok('anon بلا صلاحية على custody_assets، والمسجّل كما هو',ps(`select has_table_privilege('anon','public.custody_assets','select')::text||has_table_privilege('authenticated','public.custody_assets','select')::text`)==='falsetrue');

// ── الإدارة: تسجيل جوال مباشرة (مسار البايكر المسجَّل سابقاً) ──
const ins=(imei,extra='')=>`insert into custody_assets (employee_id,biker_name,sweater_id,item_type,category,name,name_en,start_date,life_months,lead_days,end_date,source,serial_no,specs${extra?','+extra.split('|')[0]:''}) values ('${E_MIDUL}','Midul Hassan','1648','device','أجهزة','الجوال','Mobile Phone','2026-10-12',24,45,'2028-10-12','manual',${imei===null?'null':`'${imei}'`},'{"brand_model":"Samsung A15","acc":{"charger":true,"holder":true,"case":false}}'${extra?','+extra.split('|')[1]:''}) returning id`;
ok('الإدارة: جوال بلا IMEI أو بـIMEI غير صالح ⇒ يُرفض (قيد الجدول)',/custody_assets_device_imei_ck/.test(asErr(SUP,ins(null))||'')&&/custody_assets_device_imei_ck/.test(asErr(SUP,ins('490154203237519'))||''));
const P1=as(SUP,ins('490154203237518'));
ok('الإدارة: جوال بـIMEI صالح يُحفظ بمواصفاته',/^[0-9a-f-]{36}$/.test(P1)&&ps(`select serial_no||'|'||(specs->>'brand_model')||'|'||(specs->'acc'->>'holder') from custody_assets where id='${P1}'`)==='490154203237518|Samsung A15|true');
ok('IMEI نفسه لجهاز نشط آخر ⇒ مرفوض بالفهرس الفريد',/custody_assets_active_device_serial/.test(asErr(SUP,ins('490154203237518'))||''));
ok('_imei_digits يوحّد الأرقام البنغالية والعربية ويحذف المسافات والشرطات',ps(`select _imei_digits('৪৯০১৫৪ ২০৩-২৩৭৫১৮')||'|'||_imei_digits('٤٩٠١٥٤٢٠٣٢٣٧٥١٨')||'|'||coalesce(_imei_digits('  '),'null')`)==='490154203237518|490154203237518|null');
ps(`update custody_assets set status='replaced' where id='${P1}'`);
const P2=as(SUP,ins('490154203237518'));
ok('بعد استبدال الجهاز القديم يتحرّر رقمه ويُسجَّل لجهاز جديد',/^[0-9a-f-]{36}$/.test(P2));
ok('القيد لا يمسّ الأصناف الأخرى (أداة بلا رقم تُحفظ)',!asErr(SUP,`insert into custody_assets (employee_id,item_type,name,start_date,life_months,lead_days) values ('${E_ABED}','tool','مسدس الماء','2026-10-12',12,30)`));

// ── البايكر: تسجيل أول فيه جوال ⇒ الاعتماد ينسخ IMEI والمواصفات ──
const phoneItem=(imei)=>`{"key":"phone","condition":"good","photo":"pp","qty":1,"phone":{"brand_model":"Redmi 13","imei":"${imei}","sim":"0551234567","acc":{"charger":true,"holder":false,"case":true}}}`;
const RAKIB='00000000-0000-0000-0000-000000001700';
ps(`insert into app_users values ('${RAKIB}',false,'1700',true)`);
const line=JSON.stringify([{catalog_key:'phone',item_keys:['phone'],asset_id:null,name:'الجوال',name_en:'Mobile Phone',item_type:'device',category:'أجهزة',life_months:24,lead_days:45}]);
const B1=as(RAKIB,`insert into biker_assets(biker_employee_id,biker_name,items,status,created_at) values ('1700','Mohamad Rakib','[${phoneItem('490154203237518')}]','declared','2026-10-12') returning id`).split('\n').pop();
ok('اعتماد جوال بـIMEI مستخدم لجهاز نشط ⇒ IMEI_DUPLICATE ولا يتغيّر شيء',/IMEI_DUPLICATE/.test(asErr(SUP,`select custody_review('${B1}',true,null,null,'${line}'::jsonb)`)||'')&&ps(`select status from biker_assets where id='${B1}'`)==='declared'&&ps(`select count(*) from custody_assets where sweater_id='1700' and item_type='device'`)==='0');
ps(`update biker_assets set items='[${phoneItem('35209900176148')}]' where id='${B1}'`);
ok('IMEI ناقص في الإقرار ⇒ IMEI_INVALID',/IMEI_INVALID/.test(asErr(SUP,`select custody_review('${B1}',true,null,null,'${line}'::jsonb)`)||''));
ps(`update biker_assets set items='[{"key":"phone","condition":"good","photo":"pp","qty":1}]' where id='${B1}'`);
ok('جوال بلا بيانات phone في الإقرار ⇒ IMEI_INVALID',/IMEI_INVALID/.test(asErr(SUP,`select custody_review('${B1}',true,null,null,'${line}'::jsonb)`)||''));
// IMEI بأرقام بنغالية + مفاتيح زائدة في phone ⇒ يُوحَّد الرقم، وتُحفظ المواصفات المسموحة فقط
ps(`update biker_assets set items='[{"key":"phone","condition":"good","photo":"pp","qty":1,"phone":{"brand_model":"Redmi 13","imei":"৩৫২০৯৯০০১৭৬১৪৮১","sim":"055-123 4567","acc":{"charger":true,"holder":"yes","case":true},"junk":"x"}}]' where id='${B1}'`);
const r=JSON.parse(as(SUP,`select custody_review('${B1}',true,null,null,'${line}'::jsonb)::text`).split('\n').pop());
ok('اعتماد جوال صالح: قطعة device بـIMEI والمواصفات (بلا تكرار IMEI داخل specs)',r.status==='approved'&&r.created===1
  &&ps(`select item_type||'|'||serial_no||'|'||(specs->>'brand_model')||'|'||(specs->>'sim')||'|'||(specs->'acc'->>'case')||'|'||(specs ? 'imei')||'|'||life_months||'|'||end_date from custody_assets where sweater_id='1700' and item_type='device'`)==='device|352099001761481|Redmi 13|0551234567|true|false|24|2028-10-12');
ok('المواصفات قائمة بيضاء: لا مفاتيح زائدة، والقيم غير المنطقية للملحقات = false',ps(`select specs::text from custody_assets where sweater_id='1700' and item_type='device'`)==='{"acc": {"case": true, "holder": false, "charger": true}, "sim": "0551234567", "brand_model": "Redmi 13"}');
ok('البايكر يرى جواله في قطعه (RLS كما هي)',as(RAKIB,`select count(*) from custody_assets where item_type='device'`)==='1');

// ── جوال سجّلته الإدارة ثم أقرّه البايكر في تسجيله الأول (ربط asset_id) ──
const ABED_P=as(SUP,`insert into custody_assets (employee_id,biker_name,sweater_id,item_type,category,name,name_en,start_date,life_months,lead_days,source,serial_no) values ('${E_ABED}','Abed mia','2637651411','device','أجهزة','الجوال','Mobile Phone','2026-10-12',24,45,'manual','356938035643809') returning id`);
const BA='30000000-0000-0000-0000-000000000001';
ps(`update biker_assets set items='[{"key":"helmet","condition":"good","qty":1},{"key":"phone","condition":"good","photo":"pp","qty":1,"phone":{"imei":"490154203237518"}}]' where id='${BA}'`);
const lnk=(id)=>`[{"catalog_key":"helmet","item_keys":["helmet"],"asset_id":null,"name":"الخوذة","name_en":"Helmet","item_type":"safety","category":"معدات حماية","life_months":24,"lead_days":60},{"catalog_key":"phone","item_keys":["phone"],"asset_id":"${id}","name":"الجوال","name_en":"Mobile Phone","item_type":"device","category":"أجهزة","life_months":24,"lead_days":45}]`;
ok('IMEI المُقَرّ يخالف جهاز الإدارة ⇒ IMEI_MISMATCH ولا يتغيّر شيء',/IMEI_MISMATCH/.test(asErr(OWNER,`select custody_review('${BA}',true,null,'2026-10-05','${lnk(ABED_P)}'::jsonb)`)||'')&&ps(`select status from biker_assets where id='${BA}'`)==='declared');
ps(`update biker_assets set items='[{"key":"helmet","condition":"good","qty":1},{"key":"phone","condition":"good","photo":"pp","qty":1,"phone":{"imei":"356938035643809"}}]' where id='${BA}'`);

// ── أصناف أخرى بلا تغيير في السلوك ──
const r4=JSON.parse(as(OWNER,`select custody_review('${BA}',true,null,'2026-10-05','${lnk(ABED_P)}'::jsonb)::text`).split('\n').pop());
ok('IMEI مطابق ⇒ الجوال مربوط بقطعة الإدارة (لا قطعة جديدة)',r4.linked===1&&ps(`select count(*) from custody_assets where employee_id='${E_ABED}' and item_type='device'`)==='1');
ok('صنف غير الجوال (الخوذة لعابد): كما كان، serial_no فارغ وspecs {}',r4.created===1&&ps(`select coalesce(serial_no,'-')||'|'||specs::text||'|'||start_date from custody_assets where employee_id='${E_ABED}' and item_type='safety'`)==='-|{}|2026-10-05');
ok('anon لا يملك تنفيذ custody_review، والمسجّل يملك',ps(`select has_function_privilege('anon','public.custody_review(uuid,boolean,text,date,jsonb)','execute')::text||has_function_privilege('authenticated','public.custody_review(uuid,boolean,text,date,jsonb)','execute')::text`)==='falsetrue');
}finally{ps(`drop database if exists ${db}`,'postgres');}
