// دورة حياة العهدة على Postgres محلي: docs/sql/custody_lifecycle.sql (السياسات + custody_review + الإشعارات).
// يعمل فقط مع PGTEST_PORT (مثلاً PGTEST_PORT=55432 npm test)؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='cl_test_'+process.pid;
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

const file=fs.readFileSync('docs/sql/custody_lifecycle.sql','utf8');
ps(file);ps(file);
ok('الملف يُطبَّق مرتين بلا خطأ، والمشغّل القديم أُزيل والجديد موجود',ps(`select string_agg(tgname,',' order by tgname) from pg_trigger where tgrelid='public.biker_assets'::regclass and not tgisinternal`)==='biker_assets_pending_notify');
ok('إقرار عابد القائم: baseline / declared بلا تغيير',ps(`select kind||'|'||status||'|'||jsonb_array_length(items) from biker_assets where id='30000000-0000-0000-0000-000000000001'`)==='baseline|declared|1');

// ── RLS ──
ok('البايكر يرى قطعه فقط في custody_assets (2 لميدول، لا قطعة رقيب)',as(MIDUL,`select count(*) from custody_assets`)==='2');
ok('البايكر لا يُدرج بحالة معتمدة',!!asErr(MIDUL,`insert into biker_assets(biker_employee_id,biker_name,items,status) values ('1648','Midul','[]','approved')`));
ok('البايكر لا يُدرج لغيره',!!asErr(MIDUL,`insert into biker_assets(biker_employee_id,biker_name,items,status) values ('1700','x','[]','declared')`));
const B=as(MIDUL,`insert into biker_assets(biker_employee_id,biker_name,items,status,created_at) values ('1648','Midul','[{"key":"vacuum","condition":"damaged","note":"السلك مقطوع","photo":"p1","qty":1},{"key":"water_tank","condition":"good","photo":"p2","qty":1},{"key":"floor_brush","condition":"good","photo":"p3"},{"key":"tyre_brush","condition":"poor","note":"شعر متآكل","photo":"p4"}]','declared','2026-10-09 10:00:00+00') returning id`).split('\n').pop();
ok('البايكر يُدرج تسجيله الأول بانتظار الاعتماد + إشعار للمالك',/^[0-9a-f-]{36}$/.test(B)&&ps(`select count(*) from notif_log where audience='owner' and dedupe='asset-pending-${B}'`)==='1');
ok('تسجيل أول ثانٍ وهو معلّق ⇒ مرفوض (فهرس فريد)',/biker_assets_one_baseline/.test(asErr(MIDUL,`insert into biker_assets(biker_employee_id,biker_name,items,status) values ('1648','Midul','[]','declared')`)||''));
ok('البايكر لا يعدّل الحالة مباشرة (لا صف يتأثر)',as(MIDUL,`with u as (update biker_assets set status='approved' where id='${B}' returning 1) select count(*) from u`)==='0');
ok('البايكر لا يستدعي الاعتماد',/غير مصرّح/.test(asErr(MIDUL,`select custody_review('${B}',true)`)||''));
ok('مستخدم بلا صلاحية لا يعتمد',/غير مصرّح/.test(asErr(NOBODY,`select custody_review('${B}',true)`)||''));

// ── اعتماد التسجيل الأول ──
const lines=JSON.stringify([
  {catalog_key:'vacuum',item_keys:['vacuum'],asset_id:VAC,name:'المكنسة',name_en:'Vacuum Cleaner',item_type:'tool',category:'أدوات',life_months:18,lead_days:45},
  {catalog_key:'watertank',item_keys:['water_tank'],asset_id:null,name:'خزان الماء',name_en:'Water Tank',item_type:'tool',category:'أدوات',life_months:24,lead_days:45},
  {catalog_key:'brushes',item_keys:['floor_brush','tyre_brush'],asset_id:null,name:'الفرش (إطارات/مكيّف/أرضية/صغيرة)',name_en:'Brushes set',item_type:'tool',category:'أدوات',life_months:6,lead_days:14}]);
ok('سطر ناقص لصنف ⇒ يُرفض الاعتماد ولا يتغيّر شيء',/بلا سطر كتالوج/.test(asErr(SUP,`select custody_review('${B}',true,null,null,'${JSON.stringify(JSON.parse(lines).slice(0,2))}'::jsonb)`)||'')&&ps(`select status from biker_assets where id='${B}'`)==='declared');
ok('ربط قطعة لا تخص البايكر ⇒ يُرفض',/ليست قطعة نشطة/.test(asErr(SUP,`select custody_review('${B}',true,null,null,'${lines.replace(VAC,RAKIB_VAC)}'::jsonb)`)||''));
const res=JSON.parse(as(SUP,`select custody_review('${B}',true,null,null,'${lines}'::jsonb)::text`).split('\n').pop());
ok('اعتماد (صلاحية الإمداد): قطعة مربوطة + قطعتان جديدتان + طلب استبدال',res.status==='approved'&&res.linked===1&&res.created===2&&!!res.request_id);
ok('القطعة المربوطة لم يتغيّر تاريخها، وصارت مستحقة مع رقم الطلب',ps(`select start_date||'|'||status||'|'||(reorder_request_id='${res.request_id}') from custody_assets where id='${VAC}'`)==='2026-08-07|due|true');
ok('قطعة جديدة: source=declaration، البداية = تاريخ الإقرار، النهاية من العمر الافتراضي',ps(`select source||'|'||start_date||'|'||end_date||'|'||employee_id from custody_assets where name='خزان الماء'`)===`declaration|2026-10-09|2028-10-09|${E_MIDUL}`);
ok('الفرش (صنفان) ⇒ قطعة واحدة، والسيئة ضمن طلب الاستبدال',ps(`select count(*) from custody_assets where name like 'الفرش%'`)==='1'&&ps(`select status from custody_assets where name like 'الفرش%'`)==='due');
ok('طلب واحد بصنفين (المكنسة التالفة + الفرش السيئة) مع الصورة والملاحظة',ps(`select jsonb_array_length(items)||'|'||(items->0->>'photo')||'|'||(items->0->>'note')||'|'||sweater_id from supply_requests where id='${res.request_id}'`)==='2|p1|السلك مقطوع|1648');
ok('الإقرار: معتمد + أصنافه مربوطة بالقطع + إشعار للبايكر',ps(`select status||'|'||approved_start||'|'||(select count(*) from jsonb_array_elements(items) e where e ? 'asset_id') from biker_assets where id='${B}'`)==='approved|2026-10-09|4'&&ps(`select count(*) from notif_log where audience='user' and uid='${MIDUL}' and dedupe='asset-rev-${B}'`)==='1');
ok('لا اعتماد مرتين',/سبقت مراجعة/.test(asErr(SUP,`select custody_review('${B}',true,null,null,'${lines}'::jsonb)`)||''));
ok('تسجيل أول جديد بعد الاعتماد ⇒ مرفوض',!!asErr(MIDUL,`insert into biker_assets(biker_employee_id,biker_name,items,status) values ('1648','Midul','[]','declared')`));

// ── تحديث الحالة ──
const U1=as(MIDUL,`insert into biker_assets(kind,asset_id,biker_employee_id,biker_name,items,status) values ('update','${VAC}','1648','Midul','[{"key":"vacuum","condition":"damaged","note":"أسوأ","photo":"p5","qty":1}]','declared') returning id`).split('\n').pop();
ok('تحديث لقطعة لا تخصه ⇒ مرفوض',!!asErr(MIDUL,`insert into biker_assets(kind,asset_id,biker_employee_id,biker_name,items,status) values ('update','${RAKIB_VAC}','1648','Midul','[]','declared')`));
ok('تحديث ثانٍ للقطعة نفسها وهناك معلّق ⇒ مرفوض',/biker_assets_one_pending_update/.test(asErr(MIDUL,`insert into biker_assets(kind,asset_id,biker_employee_id,biker_name,items,status) values ('update','${VAC}','1648','Midul','[{"key":"vacuum","condition":"fair","photo":"p6"}]','declared')`)||''));
const r2=JSON.parse(as(OWNER,`select custody_review('${U1}',true)::text`).split('\n').pop());
ok('اعتماد تحديث تالف وللقطعة طلب مفتوح ⇒ لا طلب جديد',r2.status==='approved'&&r2.request_id===null&&ps('select count(*) from supply_requests')==='1');
ps(`update supply_requests set status='completed'`);
const U2=as(MIDUL,`insert into biker_assets(kind,asset_id,biker_employee_id,biker_name,items,status) values ('update','${HELM}','1648','Midul','[{"key":"helmet","condition":"poor","note":"الزجاج مشروخ","photo":"p7","qty":1}]','declared') returning id`).split('\n').pop();
ok('الرفض بلا سبب ⇒ خطأ',/سبب الرفض مطلوب/.test(asErr(OWNER,`select custody_review('${U2}',false,'  ')`)||''));
ps(`begin; set local role authenticated; select set_config('test.uid','${OWNER}',true); select custody_review('${U2}',false,'الصورة غير واضحة'); commit;`);
ok('الرفض: السبب محفوظ، والقطعة بلا تغيير، وإشعار للبايكر',ps(`select status||'|'||reject_reason from biker_assets where id='${U2}'`)==='rejected|الصورة غير واضحة'&&ps(`select status||'|'||coalesce(reorder_request_id::text,'-') from custody_assets where id='${HELM}'`)==='active|-'&&/الصورة غير واضحة/.test(ps(`select body from notif_log where dedupe='asset-rev-${U2}'`)));
const U3=as(MIDUL,`insert into biker_assets(kind,asset_id,biker_employee_id,biker_name,items,status) values ('update','${HELM}','1648','Midul','[{"key":"helmet","condition":"damaged","note":"مكسورة","photo":"p8","qty":1}]','declared') returning id`).split('\n').pop();
const r3=JSON.parse(as(OWNER,`select custody_review('${U3}',true)::text`).split('\n').pop());
ok('بعد الرفض يُسمح بتحديث جديد؛ اعتماده التالف ⇒ طلب لقطعة واحدة + due',!!r3.request_id&&ps(`select jsonb_array_length(items)||'|'||(items->0->>'ar') from supply_requests where id='${r3.request_id}'`)==='1|الخوذة'&&ps(`select status from custody_assets where id='${HELM}'`)==='due');

// ── عابد: لا قطع سابقة ⇒ قطعة جديدة بتاريخ يختاره المعتمد ──
const r4=JSON.parse(as(OWNER,`select custody_review('30000000-0000-0000-0000-000000000001',true,null,'2026-10-05','[{"catalog_key":"helmet","item_keys":["helmet"],"asset_id":null,"name":"الخوذة","name_en":"Helmet","item_type":"safety","category":"معدات حماية","life_months":24,"lead_days":60}]'::jsonb)::text`).split('\n').pop());
ok('عابد: تاريخ البداية المختار 2026-10-05 بدل تاريخ الإقرار',r4.created===1&&ps(`select start_date||'|'||end_date from custody_assets where employee_id='${E_ABED}'`)==='2026-10-05|2028-10-05');

// ── بلا موظف مطابق ⇒ لا تخمين ──
ps(`insert into app_users values ('00000000-0000-0000-0000-000000000099',false,'9999',true)`);
const B9=as('00000000-0000-0000-0000-000000000099',`insert into biker_assets(biker_employee_id,biker_name,items,status) values ('9999','X','[]','declared') returning id`).split('\n').pop();
ok('رقم بايكر بلا موظف ⇒ يُرفض الاعتماد برسالة',/لا موظف برقم البايكر 9999/.test(asErr(OWNER,`select custody_review('${B9}',true,null,null,'[]'::jsonb)`)||''));
ok('anon لا يملك تنفيذ custody_review',ps(`select has_function_privilege('anon','public.custody_review(uuid,boolean,text,date,jsonb)','execute')`)==='f');
}finally{ps(`drop database if exists ${db}`,'postgres');}
