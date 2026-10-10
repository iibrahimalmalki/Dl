// طلب الاستبدال التلقائي: المشغّل biker_assets_replace (docs/sql/custody_replacement.sql) على Postgres محلي.
// يعمل فقط مع PGTEST_PORT (مثلاً PGTEST_PORT=55432 npm test)؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='cr_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8'}).trim();
ps(`create database ${db}`,'postgres');
try{
ps(`do $$ begin create role anon; exception when others then null; end $$;
do $$ begin create role authenticated; exception when others then null; end $$;
create table public.biker_assets (id uuid default gen_random_uuid() primary key, operator_id uuid, biker_employee_id text, biker_name text, items jsonb default '[]', pledge_accepted boolean default false, notes text, status text default 'submitted', created_by uuid, created_at timestamptz default now());
create table public.supply_requests (id uuid default gen_random_uuid() primary key, seq bigint generated always as identity, ref text, operator_id uuid, round_id uuid, biker_name text, sweater_id text, requesting_dept text, items jsonb not null default '[]', status text not null default 'open', sla_hours int not null default 24, created_at timestamptz not null default now(), notes text, created_by uuid);
create table public.notif_log (audience text, cat text, title text, body text, module text, dedupe text);
create function public.push_notification(p_audience text, p_user uuid, p_category text, p_severity text, p_title text, p_body text, p_module text, p_entity text, p_dedupe text) returns void language sql as $f$ insert into public.notif_log values (p_audience,p_category,p_title,p_body,p_module,p_dedupe) $f$;`);
const file=fs.readFileSync('docs/sql/custody_replacement.sql','utf8');
ps(file);ps(file); // إعادة التشغيل آمنة

ps(`insert into biker_assets(biker_employee_id,biker_name,items) values ('1700','Rakib','[{"key":"vacuum","name_ar":"المكنسة","condition":"good","photo":"u1","qty":1}]')`);
ok('كل الأصناف جيدة ⇒ لا طلب ولا إشعار',ps('select count(*) from supply_requests')==='0'&&ps('select count(*) from notif_log')==='0');

ps(`insert into biker_assets(biker_employee_id,biker_name,items) values ('1648','Midul','[{"key":"vacuum","name_ar":"المكنسة","condition":"damaged","photo":"u2","qty":1,"note":"السلك مقطوع"},{"key":"glass","name_ar":"منظّف الزجاج","condition":"poor","photo":"u3","qty":2,"note":"رأس البخاخ مكسور"},{"key":"towels","name_ar":"مناشف","condition":"good","photo":"u4","qty":4}]')`);
ok('تالف + سيئ + جيد ⇒ طلب واحد فيه صنفان',ps('select count(*) from supply_requests')==='1'&&ps('select jsonb_array_length(items) from supply_requests')==='2');
ok('الطلب: البايكر والرقم والحالة open والمرجع DW-1648-YYYYMMDD-A####',ps(`select biker_name||'|'||sweater_id||'|'||status||'|'||(ref ~ '^DW-1648-[0-9]{8}-A[0-9]{4}$') from supply_requests`)==='Midul|1648|open|true');
ok('بنود الطلب: الاسم والملاحظة والصورة والكمية والحالة',ps(`select items->0->>'ar'||'|'||(items->0->>'note')||'|'||(items->0->>'photo')||'|'||(items->1->>'qty')||'|'||(items->1->>'status_ar') from supply_requests`)==='المكنسة|السلك مقطوع|u2|2|سيئ — استبدال');
ok('الإقرار: الصنفان مربوطان بالطلب (replace_ref + المعرّف)، والجيد بلا ربط',ps(`select (select count(*) from jsonb_array_elements(items) e where e->>'replace_request_id' = (select id::text from supply_requests))||'|'||(items->2 ? 'replace_ref') from biker_assets where biker_name='Midul'`)==='2|false');
ok('إشعار للمالك في فئة «الإمداد» يفتح طلبات الإمداد',ps(`select audience||'|'||cat||'|'||module||'|'||(body like '%المكنسة، منظّف الزجاج%') from notif_log`)==='owner|supply|supply_requests|true');
ps(`insert into biker_assets(biker_employee_id,biker_name,items) values ('1624','Ariful','{}')`);
ok('items ليست مصفوفة ⇒ يُحفظ بلا طلب ولا خطأ',ps('select count(*) from supply_requests')==='1'&&ps(`select count(*) from biker_assets where biker_name='Ariful'`)==='1');
ok('المستخدم المسجّل لا يملك تنفيذ الدالة مباشرة',ps(`select has_function_privilege('authenticated','public.biker_assets_replace()','execute')`)==='f');
}finally{ps(`drop database if exists ${db}`,'postgres');}
