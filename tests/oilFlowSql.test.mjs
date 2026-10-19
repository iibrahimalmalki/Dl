// «مسار تغيير الزيت» على Postgres محلي: docs/sql/fleet_requests.sql ثم docs/sql/oil_flow_A.sql ثم القسم B من docs/sql/oil_flow.sql
// ببيانات تطابق الإنتاج 2026-10-17 (طلبات الزيت الثلاثة). يعمل فقط مع PGTEST_PORT؛ بدونه يُتخطّى.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='oil_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
const as=(uid,sql)=>ps(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`).split('\n').pop();
const asErr=(uid,sql)=>err(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`);
const code=e=>((e||'').match(/ERROR:\s+([A-Z_]{4,})/)||[])[1]||e;

const OWNER='00000000-0000-0000-0000-00000000000a',ARIF='00000000-0000-0000-0000-000000001624',MIDUL='00000000-0000-0000-0000-000000001648',
  RAKIB='00000000-0000-0000-0000-000000001700',FA_EDIT='00000000-0000-0000-0000-0000000000e1',FA_VIEW='00000000-0000-0000-0000-0000000000e2',
  FLEET='00000000-0000-0000-0000-0000000000e3',NOBODY='00000000-0000-0000-0000-0000000000ff';
const E={a:'10000000-0000-0000-0000-000000001624',m:'10000000-0000-0000-0000-000000001648',r:'10000000-0000-0000-0000-000000001700'};
const V={a:'20000000-0000-0000-0000-000000000001',m:'20000000-0000-0000-0000-000000000002',r:'20000000-0000-0000-0000-000000000003',x:'20000000-0000-0000-0000-000000000009'};
const M={sent:'68c5f268-0000-4000-8000-000000000001',appr:'7acda5e0-0000-4000-8000-000000000002',req:'39004cb4-0000-4000-8000-000000000003'};
const PROD_ALERTS_MD5='3895b6394ef32a9903e241e9a768a6e9';   // md5 جسم fleet_alerts() في الإنتاج 2026-10-17 بلا مسافات

ps(`create database ${db}`,'postgres');
try{
ps(`do $$ begin create role anon; exception when others then null; end $$;
do $$ begin create role authenticated; exception when others then null; end $$;
create schema auth; create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('test.uid',true),'')::uuid $f$;
grant usage on schema auth to authenticated, anon;
create schema storage; create table storage.objects (bucket_id text, name text); alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $f$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $f$;
grant usage on schema storage to authenticated, anon; grant select, insert on storage.objects to authenticated;
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
create table public.audit_log (table_name text, row_id uuid, action text, actor uuid);
create function public.audit_capture() returns trigger language plpgsql security definer set search_path to 'public' as $f$
  begin insert into public.audit_log values (TG_TABLE_NAME, (to_jsonb(coalesce(NEW, OLD))->>'id')::uuid, TG_OP, auth.uid()); return coalesce(NEW, OLD); end $f$;
create table public.notif_log (audience text, uid uuid, cat text, title text, body text, dedupe text unique);
create function public.push_notification(p_audience text, p_user uuid, p_category text, p_severity text, p_title text, p_body text, p_module text, p_entity text, p_dedupe text) returns void
  language sql security definer as $f$ insert into public.notif_log values (p_audience,p_user,p_category,p_title,p_body,p_dedupe) on conflict (dedupe) do nothing $f$;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
insert into app_users values ('${OWNER}',true,null,true),('${ARIF}',false,'1624',true),('${MIDUL}',false,'1648',true),('${RAKIB}',false,' 1700 ',true),
  ('${FA_EDIT}',false,null,true),('${FA_VIEW}',false,null,true),('${FLEET}',false,null,true),('${NOBODY}',false,null,true);
insert into user_permissions values ('${FA_EDIT}','fleet_alerts',true,true),('${FA_VIEW}','fleet_alerts',true,false),('${FLEET}','fleet',true,true);
insert into employees values ('${E.a}','Ariful Islam','1624',null),('${E.m}','Midul Hassan','1648',null),('${E.r}','Mohamad Rakib','1700',null);
insert into fleet_vehicles values ('${V.a}',null,'5530 ق ب','${E.a}',null,true),('${V.m}',null,'5531 ق ب','${E.m}',null,true),('${V.r}',null,'5532 ق ب','${E.r}',null,true),('${V.x}',null,'9999 بلا بايكر',null,null,true);`);

const fr=fs.readFileSync('docs/sql/fleet_requests.sql','utf8');
const e0=err(fr);ok('fleet_requests.sql (المطبَّق في الإنتاج) يُطبَّق أولاً'+(e0?' — '+e0.slice(0,200):''),!e0);if(e0)process.exit(1);
ok('fleet_alerts() في fleet_requests.sql مطابقة لجسمها في الإنتاج 2026-10-17 (md5 بلا مسافات)',ps(`select md5(regexp_replace(prosrc,'\\s+','','g')) from pg_proc where proname='fleet_alerts'`)===PROD_ALERTS_MD5);

// ── بيانات الإنتاج 2026-10-17 (UTC) ──
ps(`insert into maintenance_requests (id,vehicle_id,plate,biker_employee_id,biker_name,status,odometer,odometer_photo_url,requested_at,sent_at,sent_channel,done_at,done_odometer,done_odometer_photo_url,done_proof_url,sweater_tech_name,approved_at) values
 ('${M.sent}','${V.a}','5530 ق ب','1624','Ariful Islam','sent',13692,'u','2026-10-13 17:12:22+00','2026-10-15 15:20:42+00','whatsapp',null,null,null,null,null,null),
 ('${M.appr}','${V.m}','5531 ق ب','1648','Midul Hassan','approved',8396,'u','2026-10-13 18:24:04+00',null,null,'2026-10-13 18:25:19+00',8396,'o','p','t','2026-10-15 15:20:14+00'),
 ('${M.req}','${V.m}','5531 ق ب','1648','Midul Hassan','requested',8549,'u','2026-10-16 21:39:06+00',null,null,null,null,null,null,null,null);`);

const A=fs.readFileSync('docs/sql/oil_flow_A.sql','utf8');
const W=fs.readFileSync('docs/sql/oil_flow.sql','utf8');
const iB=W.indexOf('═══ B)');
const B=W.slice(W.indexOf('\n',iB)+1,W.indexOf('-- ═══ تحقق بالقراءة بعد B'));
ok('oil_flow_A.sql: أوامر حقيقية (begin … commit) فيها drop constraint، والملف الرئيسي يشير إليه',/^begin;$/m.test(A)&&/^commit;$/m.test(A)&&/^alter table public\.maintenance_requests drop constraint/m.test(A)&&W.includes('docs/sql/oil_flow_A.sql'));
ok('القسم B بلا drop ولا delete ولا truncate (عبر الأداة)، وبلا تعديل بيانات',!/\b(drop|delete|truncate)\b/i.test(B)&&!/^\s*update /m.test(B.replace(/^.*update public\.maintenance_requests set.*$/gm,'')));
ok('قبل A: «cancelled» مرفوضة بقيد الحالة القديم',/check constraint/.test(err(`update maintenance_requests set status='cancelled' where id='${M.req}'`)||''));
const eA=err(A),eA2=err(A);ok('oil_flow_A.sql يُطبَّق مرتين بلا خطأ'+(eA||eA2?' — '+String(eA||eA2).slice(0,300):''),!eA&&!eA2);
ok('استعلام تحقق A يعطي true | true | 3',ps(A.slice(A.indexOf('═══ التحقق')).split('\n').slice(1).join('\n'))==='t|t|3');
const up=(u,path)=>asErr(u,`insert into storage.objects values ('field-evidence','${path}')`);
ok('سياسة رفع صور الإدارة: محرّر fleet_alerts يرفع تحت fleet-admin/ فقط، والعرض فقط وغيره لا',!up(FA_EDIT,'fleet-admin/oil/x/1.jpg')&&/row-level security/.test(up(FA_EDIT,'biker-portal/x/1.jpg')||'')
  &&/row-level security/.test(up(FA_VIEW,'fleet-admin/oil/x/1.jpg')||'')&&/row-level security/.test(up(FLEET,'fleet-admin/oil/x/1.jpg')||''));
const eB=err(B);ok('القسم B يُطبَّق بلا خطأ'+(eB?' — '+eB.slice(0,400):''),!eB);if(eA||eB)process.exit(1);
const eB2=err(B);ok('القسم B آمن لإعادة التشغيل'+(eB2?' — '+eB2.slice(0,200):''),!eB2);
ok('بعد B: الصفوف الثلاثة كما هي (sent/approved/requested، المصدر biker، بلا رفض)',ps(`select string_agg(status||':'||source||':'||jsonb_array_length(exec_rejections), ',' order by requested_at) from maintenance_requests`)==='sent:biker:0,approved:biker:0,requested:biker:0');
ok('fleet_alerts() بعد B: الفرق عن الإنتاج خمسة أسطر فقط (الملغاة، ونص المتابعة، وترتيب آخر تغيير بالتنفيذ)',(()=>{const s=ps(`select prosrc from pg_proc where proname='fleet_alerts'`);return (s.match(/status <> 'cancelled'/g)||[]).length===4&&s.includes('قيد المتابعة مع سويتر')&&!s.includes('أُرسل لسويتر')&&s.includes("order by coalesce(m.done_at, m.requested_at) desc limit 1) last_oil")&&!s.includes('order by m.approved_at desc');})());

// ── الصلاحيات ──
ok('الجديدة للمسجّل لا لـ anon، و_oil_since داخلية، والقديمتان مسحوبتان',ps(`select string_agg(x::text,',') from (values
  (has_function_privilege('authenticated','public.request_oil_change(numeric,text,text)','execute')),(has_function_privilege('anon','public.request_oil_change(numeric,text,text)','execute')),
  (has_function_privilege('authenticated','public.request_oil_change(numeric,text)','execute')),(has_function_privilege('authenticated','public.send_oil_to_sweater(uuid,text,timestamp with time zone)','execute')),
  (has_function_privilege('authenticated','public._oil_since(uuid,numeric,timestamp with time zone)','execute')),(has_function_privilege('anon','public.cancel_oil_request(uuid,text)','execute')),
  (has_function_privilege('authenticated','public.admin_add_oil_change(uuid,numeric,text,boolean,timestamp with time zone,text,text,text)','execute'))) t(x)`)==='true,false,false,false,false,false,true');
ok('الدوال السبع security definer',ps(`select count(*) from pg_proc where proname in ('request_oil_change','confirm_oil_change','reject_oil_execution','cancel_oil_request','admin_add_oil_change','_oil_since') and prosecdef`)==='7');
ok('request_oil_change القديمة: المسجّل ⇒ permission denied (التنفيذ مسحوب)، وبلا قيد الصلاحية ⇒ USE_NEW_OIL_REQUEST',/permission denied for function/.test(asErr(MIDUL,`select request_oil_change(1,'u')`)||'')&&code(err(`select request_oil_change(1,'u')`))==='USE_NEW_OIL_REQUEST'
  &&/permission denied for function/.test(asErr(OWNER,`select send_oil_to_sweater('${M.req}','whatsapp')`)||''));
ok('الكتابة المباشرة في maintenance_requests ممنوعة على المسجّل حتى المالك (إدراج وتعديل)',/row-level security|permission denied/.test(asErr(OWNER,`insert into maintenance_requests (vehicle_id,biker_employee_id,odometer,odometer_photo_url) values ('${V.a}','1624',1,'u')`)||'')
  &&/permission denied/.test(asErr(OWNER,`update maintenance_requests set status='cancelled' where id='${M.req}'`)||''));
for(const [who,u] of [['عرض فقط',FA_VIEW],['وحدة الأسطول (لا fleet_alerts)',FLEET],['بايكر',MIDUL],['بلا صلاحية',NOBODY]]){
  ok(`${who}: الإضافة والإلغاء ورفض التنفيذ ⇒ FORBIDDEN`,code(asErr(u,`select cancel_oil_request('${M.req}','x')`))==='FORBIDDEN'&&code(asErr(u,`select reject_oil_execution('${M.req}','x')`))==='FORBIDDEN'
    &&code(asErr(u,`select admin_add_oil_change('${V.m}',9000,'o')`))==='FORBIDDEN');
}
ok('عرض فقط: الاعتماد ⇒ FORBIDDEN (approve_oil_change كما هي)',code(asErr(FA_VIEW,`select approve_oil_change('${M.req}')`))==='FORBIDDEN');

// ── ١) الطلب: لقطة سويتر إلزامية + العدّاد وصورته؛ المسافة والأيام منذ آخر تغيير معتمد ──
const reqE=(u,odo,ph,shot)=>code(asErr(u,`select request_oil_change(${odo},${ph},${shot})`));
ok('بلا لقطة طلب سويتر ⇒ SHOT_REQUIRED',reqE(RAKIB,30000,"'o'",'null')==='SHOT_REQUIRED'&&reqE(RAKIB,30000,"'o'","'  '")==='SHOT_REQUIRED');
ok('بلا صورة العدّاد ⇒ PHOTO_REQUIRED، وبلا عدّاد ⇒ ODOMETER_REQUIRED',reqE(RAKIB,30000,'null',"'s'")==='PHOTO_REQUIRED'&&reqE(RAKIB,'null',"'o'","'s'")==='ODOMETER_REQUIRED');
ok('غير البايكر ⇒ NOT_A_BIKER',reqE(FA_EDIT,1,"'o'","'s'")==='NOT_A_BIKER');
ps(`update fleet_alert_settings set value=2000 where key='oil_interval_km' and vehicle_id is null`);
const n0=ps(`select count(*) from notif_log`);
const mid=as(MIDUL,`select request_oil_change(9100,'https://x/o.jpg','https://x/s.jpg')`);
ok('طلب ميدول: يُقبل بلقطة سويتر، المصدر biker، والحالة requested',ps(`select status||'|'||source||'|'||request_shot_url from maintenance_requests where id='${mid}'`)==='requested|biker|https://x/s.jpg');
ok('٨) المسافة منذ آخر تغيير معتمد: 9100 − 8396 = 704 كم، والحدّ 2000 محفوظ',ps(`select since_km||'|'||interval_km||'|'||(since_days>=3) from maintenance_requests where id='${mid}'`)==='704|2000|true');
ok('٨) إشعار الإدارة «⚠️ زيت مبكر» مع الكيلومترات والأيام والحد',(()=>{const t=ps(`select title||' / '||body from notif_log where dedupe='oil-req-${mid}-owner'`);return t.startsWith('⚠️ زيت مبكر — 5531 ق ب')&&t.includes('704 كم و')&&t.includes('يوم منذ آخر تغيير معتمد')&&t.includes('(الحد 2000 كم)');})()&&Number(ps(`select count(*) from notif_log`))>Number(n0));
const ark=as(ARIF,`select request_oil_change(13900,'o','s')`);
ok('٨) بلا تغيير معتمد سابق (عريف) ⇒ عنوان عادي و«لا تغيير معتمد سابق»، والمسافة فارغة',ps(`select title||' / '||body from notif_log where dedupe='oil-req-${ark}-owner'`).startsWith('طلب تغيير زيت — 5530 ق ب')
  &&ps(`select body from notif_log where dedupe='oil-req-${ark}-owner'`).includes('لا تغيير معتمد سابق')&&ps(`select since_km is null from maintenance_requests where id='${ark}'`)==='t');
ps(`update maintenance_requests set requested_at=requested_at - interval '30 days' where id='${M.appr}'`);
const mid2=as(MIDUL,`select request_oil_change(10500,'o','s')`);
ok('٨) مسافة ≥ الحد (2104 كم) ⇒ عنوان عادي بلا «مبكر»',ps(`select title from notif_log where dedupe='oil-req-${mid2}-owner'`)==='طلب تغيير زيت — 5531 ق ب'&&ps(`select since_km from maintenance_requests where id='${mid2}'`)==='2104');
ps(`update maintenance_requests set requested_at=requested_at + interval '30 days' where id='${M.appr}'`);

// ── ٢) و ٣) تحديث التنفيذ ──
const conf=(u,id,odo,shot="'https://x/p.jpg'",tech='null')=>asErr(u,`select confirm_oil_change('${id}',${odo},'https://x/o2.jpg',${shot},${tech})`);
ok('٣) في نفس دقيقة رفع الطلب ⇒ SAME_MINUTE',code(conf(MIDUL,mid,9110))==='SAME_MINUTE');
ps(`update maintenance_requests set requested_at=now()-interval '59 seconds' where id='${mid}'`);
ok('٣) بعد 59 ثانية (ولو تغيّرت دقيقة الساعة) ⇒ SAME_MINUTE',code(conf(MIDUL,mid,9110))==='SAME_MINUTE');
ps(`update maintenance_requests set requested_at=now()-interval '2 minutes' where id in ('${mid}','${mid2}','${ark}')`);
ok('٣) عدّاد أقل من عدّاد الطلب ⇒ ODOMETER_BELOW_REQUEST',code(conf(MIDUL,mid,9099))==='ODOMETER_BELOW_REQUEST');
ok('٢) بلا لقطة التنفيذ من سويتر ⇒ SHOT_REQUIRED',code(conf(MIDUL,mid,9110,'null'))==='SHOT_REQUIRED');
ok('٢) اسم فني أطول من 120 ⇒ TECH_NAME_TOO_LONG',code(conf(MIDUL,mid,9110,"'p'",`'${'x'.repeat(121)}'`))==='TECH_NAME_TOO_LONG');
ok('بايكر آخر ⇒ NOT_FOUND',code(conf(RAKIB,mid,9110))==='NOT_FOUND');
ok('٢) اسم الفني اختياري: يُقبل بلا اسم، والعدّاد يساوي عدّاد الطلب مقبول',!conf(MIDUL,mid,9100)&&ps(`select status||'|'||done_odometer||'|'||(sweater_tech_name is null) from maintenance_requests where id='${mid}'`)==='done|9100|true');
ok('إشعار «نُفّذ» للإدارة',ps(`select count(*) from notif_log where dedupe='oil-done-${mid}-0-owner'`)==='1');
ok('تأكيد ثانٍ ⇒ ALREADY_DONE',code(conf(MIDUL,mid,9100))==='ALREADY_DONE');
ok('الطلب القديم sent (عريف 68c5f268) يُؤكَّد بالقواعد الجديدة',!conf(ARIF,M.sent,13700,"'p'","' أحمد '")&&ps(`select status||'|'||sweater_tech_name from maintenance_requests where id='${M.sent}'`)==='done|أحمد');

// ── ٥) المراجعة: رفض التنفيذ بسبب ⇒ يعود «قيد المتابعة» ويُحفظ الإثبات، ثم إعادة الرفع والاعتماد ──
ok('رفض بلا سبب ⇒ REASON_REQUIRED، وسبب طويل ⇒ REASON_TOO_LONG',code(asErr(FA_EDIT,`select reject_oil_execution('${mid}','  ')`))==='REASON_REQUIRED'&&code(asErr(FA_EDIT,`select reject_oil_execution('${mid}','${'x'.repeat(501)}')`))==='REASON_TOO_LONG');
ok('رفض طلب غير منفّذ ⇒ NOT_DONE',code(asErr(FA_EDIT,`select reject_oil_execution('${mid2}','x')`))==='NOT_DONE');
ok('رفض التنفيذ: الحالة requested، السبب ظاهر، حقول التنفيذ فارغة، والإثبات المرفوض في exec_rejections',!asErr(FA_EDIT,`select reject_oil_execution('${mid}','اللقطة غير واضحة')`)
  &&ps(`select status||'|'||exec_reject_reason||'|'||(done_at is null and done_odometer is null and done_proof_url is null)||'|'||(exec_rejections->0->>'odometer')||'|'||(exec_rejections->0->>'proof_url')||'|'||(exec_rejected_by='${FA_EDIT}') from maintenance_requests where id='${mid}'`)
    ==='requested|اللقطة غير واضحة|true|9100|https://x/p.jpg|true');
ok('إشعار البايكر بالرفض: العنوان بالعربي والبنغالي، والسبب كما كُتب مع جملة بلغتين',(()=>{const t=ps(`select title||' / '||body from notif_log where dedupe like 'oil-rej-${mid}-0-%'`);return t.includes('أعد رفع إثبات تغيير الزيت')&&t.includes('তেল পরিবর্তনের প্রমাণ')&&t.includes('اللقطة غير واضحة')&&t.includes('আবার আপলোড করুন');})());
ok('البايكر يرى سبب الرفض في صفّه',as(MIDUL,`select exec_reject_reason from maintenance_requests where id='${mid}'`)==='اللقطة غير واضحة');
ok('إعادة الرفع بعد الرفض تُقبل، ويُمسح السبب، وإشعار جديد للإدارة (المحاولة 1)',!conf(MIDUL,mid,9105)&&ps(`select status||'|'||coalesce(exec_reject_reason,'∅')||'|'||jsonb_array_length(exec_rejections) from maintenance_requests where id='${mid}'`)==='done|∅|1'
  &&ps(`select count(*) from notif_log where dedupe='oil-done-${mid}-1-owner'`)==='1');
ok('الاعتماد (approve_oil_change) بصلاحية التعديل',!asErr(FA_EDIT,`select approve_oil_change('${mid}','الصور سليمة')`)&&ps(`select status from maintenance_requests where id='${mid}'`)==='approved');

// ── ٧) الإلغاء بسبب ──
const nb=ps(`select count(*) from notif_log where dedupe like 'oil-cancel-%'`);
ok('إلغاء بلا سبب ⇒ REASON_REQUIRED',code(asErr(FA_EDIT,`select cancel_oil_request('${mid2}','')`))==='REASON_REQUIRED');
ok('إلغاء بسبب: الحالة cancelled، والسبب ومن ألغى ومتى والحالة السابقة محفوظة، والصف باقٍ',!asErr(FA_EDIT,`select cancel_oil_request('${mid2}','طلب مكرر')`)
  &&ps(`select status||'|'||cancel_reason||'|'||(cancelled_by='${FA_EDIT}')||'|'||(cancelled_at is not null)||'|'||cancelled_from from maintenance_requests where id='${mid2}'`)==='cancelled|طلب مكرر|true|true|requested');
ok('إلغاء طلب مفتوح يصل البايكرَ إشعاراً بلغتين بالسبب',ps(`select title||' / '||body from notif_log where dedupe like 'oil-cancel-${mid2}-%'`)==='أُلغي طلب تغيير الزيت · তেল পরিবর্তনের অনুরোধ বাতিল / طلب مكرر');
ok('إلغاء ملغى ⇒ ALREADY_CANCELLED',code(asErr(FA_EDIT,`select cancel_oil_request('${mid2}','x')`))==='ALREADY_CANCELLED');
ok('البايكر لا يؤكد طلباً ملغى ⇒ ALREADY_DONE',code(conf(MIDUL,mid2,10600))==='ALREADY_DONE');
ok('إلغاء طلب معتمد مسموح (بلا إشعار للبايكر) ويخرج من أساس «آخر تغيير معتمد»',(()=>{const nB=ps(`select count(*) from notif_log`);
  const e=asErr(OWNER,`select cancel_oil_request('${mid}','سُجّل خطأ')`);return !e&&ps(`select count(*) from notif_log`)===nB&&ps(`select km from _oil_since('${V.m}',9500,now())`)==='1104';})());

// ── ٦) الإضافة نيابة عن البايكر ──
const add=(u,args)=>asErr(u,`select admin_add_oil_change(${args})`);
ok('دراجة بلا بايكر ⇒ NO_BIKER، ودراجة غير موجودة ⇒ NOT_FOUND',code(add(FA_EDIT,`'${V.x}',100,'o'`))==='NO_BIKER'&&code(add(FA_EDIT,`'${M.req}',100,'o'`))==='NOT_FOUND');
ok('بلا صورة العدّاد ⇒ PHOTO_REQUIRED، وتاريخ مستقبلي (> دقيقتين) ⇒ BAD_DATE، وأقدم من 400 يوم ⇒ BAD_DATE، ولقطة تنفيذ لطلب مفتوح ⇒ PROOF_NEEDS_DONE، ودراجة غير نشطة ⇒ INACTIVE_VEHICLE',code(add(FA_EDIT,`'${V.r}',100,null`))==='PHOTO_REQUIRED'
  &&code(add(FA_EDIT,`'${V.r}',100,'o',false,now()+interval '3 minutes'`))==='BAD_DATE'&&code(add(FA_EDIT,`'${V.r}',100,'o',false,now(),null,'p'`))==='PROOF_NEEDS_DONE'
  &&(()=>{ps(`update fleet_vehicles set active=false where id='${V.x}'`);const e=code(add(FA_EDIT,`'${V.x}',100,'o'`));ps(`update fleet_vehicles set active=true where id='${V.x}'`);return e==='INACTIVE_VEHICLE';})()&&code(add(FA_EDIT,`'${V.r}',100,'o',false,now()-interval '401 days'`))==='BAD_DATE');
const done=as(FA_EDIT,`select admin_add_oil_change('${V.r}',29000,'https://x/o.jpg',true,'2026-10-01 09:00+03','https://x/s.jpg','https://x/p.jpg','من فاتورة سويتر')`);
ok('إضافة تغيير منفّذ: معتمد مباشرة باسم المُضيف، بتاريخ التنفيذ المُدخل، لبايكر الدراجة (رقيب «1700» بلا مسافات)',ps(`select status||'|'||source||'|'||biker_employee_id||'|'||biker_name||'|'||done_odometer||'|'||(approved_by='${FA_EDIT}')||'|'||(done_at='2026-10-01 06:00+00')||'|'||note from maintenance_requests where id='${done}'`)
  ==='approved|admin|1700|Mohamad Rakib|29000|true|true|من فاتورة سويتر');
ok('إضافة المنفّذ لا تُشعر البايكر',ps(`select count(*) from notif_log where dedupe like 'oil-add-${done}%'`)==='0');
ps(`update fleet_vehicles set held_by='${E.a}' where id='${V.r}'`);
const open=as(OWNER,`select admin_add_oil_change('${V.r}',29500,'o',false)`);
ok('إضافة طلب مفتوح: لحائز الدراجة الحالي (عريف يحوز دراجة رقيب)، والمسافة منذ التغيير المضاف 500 كم، وإشعار للبايكر بلغتين',
  ps(`select status||'|'||biker_employee_id||'|'||since_km||'|'||(since_days>=15) from maintenance_requests where id='${open}'`)==='requested|1624|500|true'
  &&ps(`select title from notif_log where dedupe like 'oil-add-${open}-%'`)==='سُجِّل لك طلب تغيير زيت · আপনার জন্য তেল পরিবর্তনের অনুরোধ নথিভুক্ত হয়েছে');
ps(`update fleet_vehicles set held_by=null where id='${V.r}'`);
ok('تاريخ قديم: المسافة تُحسب من تغيير معتمد قبله فقط (لا بعده)',(()=>{const x=as(FA_EDIT,`select admin_add_oil_change('${V.r}',28000,'o',true,'2026-09-01 09:00+03')`);return ps(`select since_km is null from maintenance_requests where id='${x}'`)==='t';})());

ok('تاريخ بعد الآن بدقيقة (هامش الساعة) يُقبل ويُقصّ إلى الآن',(()=>{const x=as(FA_EDIT,`select admin_add_oil_change('${V.r}',29600,'o',false,now()+interval '1 minute')`);return ps(`select requested_at<=now() from maintenance_requests where id='${x}'`)==='t';})());
ok('٨) عدّاد أقل من آخر تغيير معتمد ⇒ «⚠️ عدّاد أقل من آخر تغيير معتمد» لا «زيت مبكر»، بلا ذكر الحد',(()=>{const x=as(RAKIB,`select request_oil_change(28500,'o','s')`);const t=ps(`select title||' / '||body from notif_log where dedupe='oil-req-${x}-owner'`);
  return t.startsWith('⚠️ عدّاد أقل من آخر تغيير معتمد — 5532 ق ب')&&t.includes('-500 كم')&&!t.includes('الحد');})());
ok('استحقاق الزيت: تغيير قديم مُضاف لاحقاً لا يصير «آخر تغيير» (الترتيب بتاريخ التنفيذ)',(()=>{
  const v='20000000-0000-0000-0000-00000000000b';ps(`insert into fleet_vehicles values ('${v}',null,'7777 تجربة','${E.r}',null,true)`);
  as(FA_EDIT,`select admin_add_oil_change('${v}',14000,'o',true,now()-interval '7 days')`);
  as(FA_EDIT,`select admin_add_oil_change('${v}',10000,'o',true,now()-interval '90 days')`);
  ps(`insert into fuel_requests (vehicle_id,plate,biker_employee_id,odometer,odometer_photo_url,amount,status,requested_at) values ('${v}','7777 تجربة','1700',14500,'u',50,'requested',now())`);
  return as(OWNER,`select count(*) from fleet_alerts() where kind='oil_due' and vehicle_id='${v}'`)==='0';})());

// ── fleet_alerts بعد الإلغاء ──
ps(`insert into maintenance_requests (id,vehicle_id,plate,biker_employee_id,status,odometer,odometer_photo_url,requested_at) values ('${'99999999-0000-4000-8000-000000000001'}','${V.a}','5530 ق ب','1624','requested',139000,'u',now()-interval '1 day')`);
const jumps=()=>as(OWNER,`select count(*) from fleet_alerts() where ref_id='99999999-0000-4000-8000-000000000001'`);
ok('قراءة خاطئة (139000) في طلب مفتوح تطلق تنبيه عدّاد',Number(jumps())>=1);
as(OWNER,`select cancel_oil_request('99999999-0000-4000-8000-000000000001','عدّاد خطأ')`);
ok('بعد إلغائه: لا تنبيه عدّاد منه',jumps()==='0');
ok('oil_overdue بنص «قيد المتابعة مع سويتر»',(()=>{ps(`update maintenance_requests set requested_at=now()-interval '9 days' where id='${ark}'`);return as(OWNER,`select detail from fleet_alerts() where kind='oil_overdue' and ref_id='${ark}'`).startsWith('طلب تغيير زيت قيد المتابعة مع سويتر منذ 9 يوم');})());
ok('fleet_alerts بلا صلاحية ⇒ لا صفوف',as(NOBODY,`select count(*) from fleet_alerts()`)==='0');
ok('سجل التدقيق يلتقط الإلغاء ورفض التنفيذ (UPDATE)',Number(ps(`select count(*) from audit_log where table_name='maintenance_requests' and action='UPDATE'`))>=5);
}finally{ps(`drop database if exists ${db}`,'postgres');}
