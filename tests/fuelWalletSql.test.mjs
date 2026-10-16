// «رصيد وقود متجدد 50 ﷼» على Postgres محلي: docs/sql/fleet_requests.sql ثم docs/sql/fuel_wallet.sql (A + B) ثم docs/sql/fuel_fix_2026_10.sql
// ببيانات تطابق الإنتاج 2026-10-15 (عريف 1624، ميدول 1648، رقيب 1700، TEST01). يعمل فقط مع PGTEST_PORT؛ بدونه يُتخطّى.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='fw_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
const as=(uid,sql)=>ps(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`).split('\n').pop();
const asErr=(uid,sql)=>err(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`);
const code=e=>((e||'').match(/ERROR:\s+([A-Z_]{4,})/)||[])[1]||e;

const OWNER='00000000-0000-0000-0000-00000000000a',ARIF='00000000-0000-0000-0000-000000001624',MIDUL='00000000-0000-0000-0000-000000001648',
  RAKIB='00000000-0000-0000-0000-000000001700',TEST='00000000-0000-0000-0000-0000000000t1'.replace('t1','71'),FA_EDIT='00000000-0000-0000-0000-0000000000e1',
  FA_VIEW='00000000-0000-0000-0000-0000000000e2',NOBODY='00000000-0000-0000-0000-0000000000ff';
const E={a:'10000000-0000-0000-0000-000000001624',m:'10000000-0000-0000-0000-000000001648',r:'10000000-0000-0000-0000-000000001700',t:'10000000-0000-0000-0000-000000000071'};
const V={a:'20000000-0000-0000-0000-000000000001',m:'20000000-0000-0000-0000-000000000002',r:'20000000-0000-0000-0000-000000000003',t:'20000000-0000-0000-0000-000000000004'};
const R={keep:'5f1f85eb-a38d-4b50-8176-5d84d3562dd2',dup1:'4044c7f7-939f-4682-a6a6-dc6f309fc622',dup2:'4523405b-489a-4a1a-97e6-12c0fdb41e35',big:'01ce2212-ed5d-47dd-ab23-836a73ac9f31',
  mid:'eeaf6775-6f78-4a81-9eb8-64d8c8b150be',rak:'bcd4e008-554f-44be-b2e1-1f3d2a78682f',tst:'eb97dfac-5bf8-4b7a-a6b3-39ebdc58f7a3'};
const F={f20:'cc3c783e-0d02-48f0-b597-68cf23b839de',f15:'0c26ed61-1cc9-45e3-b1bd-6f3381baa311',ft:'f4959f5d-1ac3-42c6-85b7-3b757f952ff7'};
const BANK=(d,who)=>`التاريخ: ${d}  المبلغ: 50.58 SAR المبلغ الإجمالي للمعالجة: 50 SAR رسوم المبلغ الإجمالي للمعالجة: 0.58 SAR المبلغ الإجمالي: 50.58 SAR إلى: ${who}`;

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
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
insert into app_users values ('${OWNER}',true,null,true),('${ARIF}',false,'1624',true),('${MIDUL}',false,'1648',true),('${RAKIB}',false,' 1700 ',true),('${TEST}',false,'TEST01',true),
  ('${FA_EDIT}',false,null,true),('${FA_VIEW}',false,null,true),('${NOBODY}',false,null,true);
insert into user_permissions values ('${FA_EDIT}','fleet_alerts',true,true),('${FA_VIEW}','fleet_alerts',true,false);
insert into employees values ('${E.a}','Ariful Islam','1624',null),('${E.m}','Midul Hassan','1648',null),('${E.r}','Mohamad Rakib','1700',null),('${E.t}','بايكر تجريبي','TEST01',null);
insert into fleet_vehicles values ('${V.a}',null,'5530 ق ب','${E.a}',null,true),('${V.m}',null,'5531 ق ب','${E.m}',null,true),('${V.r}',null,'5532 ق ب','${E.r}',null,true),('${V.t}',null,'TEST-0000','${E.t}',null,true);`);

const fr=fs.readFileSync('docs/sql/fleet_requests.sql','utf8');
const e0=err(fr);ok('fleet_requests.sql (المطبَّق في الإنتاج) يُطبَّق أولاً'+(e0?' — '+e0.slice(0,200):''),!e0);if(e0)process.exit(1);

// ── بيانات الإنتاج 2026-10-15 (UTC) قبل الرصيد ──
ps(`insert into fuel_logs (biker_employee_id,biker_name,fuel_type,fill_at,amount,status,legacy) select '1624','Ariful Islam','بنزين','2026-09-03',50,'paid',true from generate_series(1,3);
insert into fuel_requests (id,vehicle_id,plate,biker_employee_id,biker_name,odometer,odometer_photo_url,amount,status,requested_at,transfer_ref,transferred_at,closed_at) values
 ('${R.tst}','${V.t}','TEST-0000','TEST01','بايكر تجريبي',1,'u',50,'transferred','2026-10-12 17:42:25+00','-','2026-10-15 15:47:22+00',null),
 ('${R.keep}','${V.a}','5530 ق ب','1624','Ariful Islam',13600,'u',50,'closed','2026-10-12 21:09:58+00','${BANK('2026/10/12 - 07:40 PM','عريف')}','2026-10-14 22:32:22+00','2026-10-15 16:50:16+00'),
 ('${R.dup1}','${V.a}','5530 ق ب','1624','Ariful Islam',13650,'u',50,'closed','2026-10-13 17:09:32+00','${BANK('2026/10/12 - 07:40 PM','عريف')}','2026-10-14 22:32:47+00','2026-10-15 16:50:16+00'),
 ('${R.dup2}','${V.a}','5530 ق ب','1624','Ariful Islam',13650,'u',50,'closed','2026-10-13 17:10:10+00','${BANK('2026/10/12 - 07:40 PM','عريف')}','2026-10-14 22:32:27+00','2026-10-15 16:50:16+00'),
 ('${R.mid}','${V.m}','5531 ق ب','1648','Midul Hassan',20000,'u',50,'transferred','2026-10-13 18:22:59+00','${BANK('2026/10/09 - 12:56 PM','ميدول')}','2026-10-14 22:30:51+00',null),
 ('${R.rak}','${V.r}','5532 ق ب','1700','Mohamad Rakib',30000,'u',50,'transferred','2026-10-15 15:25:18+00','${BANK('2026/10/15 - 06:47 PM','رقيب')}','2026-10-15 15:47:14+00',null),
 ('${R.big}','${V.a}','5530 ق ب','1624','Ariful Islam',13818,'u',5050,'requested','2026-10-15 16:50:16+00',null,null,null);
insert into fuel_logs (id,vehicle_id,plate,biker_employee_id,biker_name,fill_at,odometer,liters,amount,odometer_photo_url,receipt_photo_url,status,request_id,created_by) values
 ('${F.ft}','${V.t}','TEST-0000','TEST01','بايكر تجريبي','2026-10-12 17:43:16+00',2,null,25,'o','r','submitted',null,'${TEST}'),
 ('${F.f20}','${V.a}','5530 ق ب','1624','Ariful Islam','2026-10-13 17:11:49+00',13692,9.18,20,'o','r','submitted',null,'${ARIF}'),
 ('${F.f15}','${V.a}','5530 ق ب','1624','Ariful Islam','2026-10-15 16:51:35+00',13818,6,15,'o','r','submitted','${R.dup1}','${ARIF}');`);

// ── القسم A (SQL Editor) ثم B ──
const W=fs.readFileSync('docs/sql/fuel_wallet.sql','utf8');
const iA=W.indexOf('═══ A)'),iB=W.indexOf('═══ B)');
const A=W.slice(iA,iB).split('\n').filter(l=>/^-- (begin;|alter |  |commit;)/.test(l)).map(l=>l.slice(3)).join('\n');
const iC=W.indexOf('═══ C)');
const B=W.slice(W.indexOf('\n',iB)+1,W.lastIndexOf('-- ═══',iC-10));
const C=W.slice(W.indexOf('\n',iC)+1,W.indexOf('-- ═══ تحقق بالقراءة بعد B'));
ok('القسم A يحوي drop (لذلك SQL Editor) ويُستخرج كاملاً',/drop constraint/.test(A)&&/fleet_alert_settings_key_check/.test(A)&&/commit;/.test(A));
ok('القسمان B و C بلا drop ولا delete ولا truncate (عبر الأداة)، و B بلا تعديل بيانات',!/\b(drop|delete|truncate)\b/i.test(B+C)&&!/^update /m.test(B)&&/update public\.fuel_requests/.test(C));
const eA=err(A),eA2=err(A);ok('القسم A يُطبَّق مرتين بلا خطأ'+(eA||eA2?' — '+String(eA||eA2).slice(0,300):''),!eA&&!eA2);
const eB=err(B);ok('القسم B يُطبَّق بلا خطأ'+(eB?' — '+eB.slice(0,400):''),!eB);if(eA||eB)process.exit(1);
ok('بعد B وحده: لا تعديل بيانات (amount_actual فارغ للمحوَّل)',ps(`select count(*) from fuel_requests where amount_actual is not null`)==='0');
const eC=err(C);ok('القسم C يُطبَّق (6 صفوف بالضبط)'+(eC?' — '+eC.slice(0,300):''),!eC);
ok('إعادة C ⇒ 0 صفوف مقبولة',!err(C));
ok('حارس C: عدد غير متوقع ⇒ تراجع',(()=>{ps(`update fuel_requests set amount_actual=null where id='${R.mid}'`);const e=err(C);ps(`update fuel_requests set amount_actual=50 where id='${R.mid}'`);return /المتوقع 6 صفوف/.test(e||'');})());

// ── التعبئة التلقائية للمحوَّل سابقاً ──
ok('المحوَّل سابقاً: amount_actual = 50 والرسوم 0.58 من نص البنك، و TEST01 بنص «-» ⇒ رسوم 0',
  ps(`select string_agg(coalesce(amount_actual::text,'∅')||'/'||fee, ',' order by requested_at) from fuel_requests where status in ('transferred','closed')`)==='50/0,50/0.58,50/0.58,50/0.58,50/0.58,50/0.58'
  &&ps(`select amount_actual is null from fuel_requests where id='${R.big}'`)==='t');
ok('قبل الإصلاح: عريف 115 (ثلاث دفعات مكررة − 35)، ميدول 50، رقيب 50',ps(`select string_agg(b||'='||fuel_balance(b), ',' order by b) from (values ('1624'),('1648'),('1700')) t(b)`)==='1624=115,1648=50,1700=50');
const eB2=err(B);ok('القسم B آمن لإعادة التشغيل (لا يكرر الإعدادات)'+(eB2?' — '+eB2.slice(0,200):''),!eB2&&ps(`select count(*) from fleet_alert_settings where key='fuel_topup_amount'`)==='1');
ok('الإعدادات الستة بقيم المالك',ps(`select string_agg(key||'='||value, ',' order by key) from fleet_alert_settings where key in ('fuel_topup_amount','fuel_topup_threshold','fuel_fill_tolerance','fuel_price_min','fuel_price_max','fuel_wallet_start')`)
  ==='fuel_fill_tolerance=10,fuel_price_max=2.6,fuel_price_min=2.0,fuel_topup_amount=50,fuel_topup_threshold=10,fuel_wallet_start=20261012');

// ── ملف الإصلاح ──
const X=fs.readFileSync('docs/sql/fuel_fix_2026_10.sql','utf8');
const steps=X.split(/^-- ═══ البند \d/m).slice(1).map(s=>s.slice(s.indexOf('\n')+1).split('-- ═══')[0]);
ok('ملف الإصلاح: ثلاثة بنود، بلا drop/delete/truncate',steps.length===3&&!/\b(drop|delete|truncate)\b/i.test(steps.join('\n')));
steps.forEach((s,i)=>{const e=err(s);ok(`البند ${i+1} يُطبَّق (العدد المتوقع بالضبط)`+(e?' — '+e.slice(0,200):''),!e);});
ok('إعادة البند 1 تتراجع (العدد صفر ≠ 1) — الحارس يعمل',/المتوقع صف واحد/.test(err(steps[0])||''));
ok('المكرران يحتفظان بنص البنك (transfer_ref) دليلاً',ps(`select count(*) from fuel_requests where id in ('${R.dup1}','${R.dup2}') and transfer_ref like 'التاريخ:%' and transferred_at is null`)==='2');
ok('بعد الإصلاح: الأرصدة عريف 15، ميدول 50، رقيب 50',ps(`select string_agg(b||'='||fuel_balance(b), ',' order by b) from (values ('1624'),('1648'),('1700')) t(b)`)==='1624=15,1648=50,1700=50');
ok('طلبات عريف: 00:09 محوَّل 50/0.58 والثلاثة ملغاة بسبب، والمكرران بلا تحويل',ps(`select string_agg(status||':'||coalesce(amount_actual::text,'∅')||':'||(transferred_at is not null)::text, ',' order by requested_at) from fuel_requests where biker_employee_id='1624'`)
  ==='transferred:50:true,cancelled:∅:false,cancelled:∅:false,cancelled:∅:false'&&ps(`select count(*) from fuel_requests where biker_employee_id='1624' and status='cancelled' and reject_reason is not null`)==='3');
ok('تعبئتا 20 و 15 ﷼ مربوطتان بطلب 00:09',ps(`select string_agg(amount||'→'||(request_id='${R.keep}')::text, ',' order by fill_at) from fuel_logs where biker_employee_id='1624' and not legacy`)==='20→true,15→true');
ok('TEST01 لم يُمسّ',ps(`select status||'|'||amount_actual from fuel_requests where id='${R.tst}'`)==='transferred|50');

// ── الصلاحيات ──
ok('الدوال الداخلية مغلقة أمام المسجّل، والعامة له لا لـ anon، والقديمتان مغلقتان',ps(`select string_agg(x::text,',') from (values
  (has_function_privilege('authenticated','public.fuel_balance(text)','execute')),(has_function_privilege('authenticated','public._fuel_maybe_topup(text)','execute')),
  (has_function_privilege('authenticated','public.my_fuel_balance()','execute')),(has_function_privilege('anon','public.my_fuel_balance()','execute')),
  (has_function_privilege('authenticated','public.request_fuel(numeric,text,numeric)','execute')),(has_function_privilege('authenticated','public.transfer_fuel_request(uuid,text,timestamp with time zone)','execute')),
  (has_function_privilege('authenticated','public.transfer_fuel_request(uuid,text,numeric,numeric)','execute'))) t(x)`)==='false,false,true,false,false,false,true');
ok('الكتابة المباشرة في fuel_logs مسحوبة: لا إدراج ولا تعديل ولا إزالة حتى للمالك',/permission denied/.test(asErr(ARIF,`insert into fuel_logs (biker_employee_id,odometer,amount) values ('1624',99999,500)`)||'')
  &&/permission denied/.test(asErr(OWNER,`delete from fuel_logs where id='${F.f20}'`)||'')&&/permission denied/.test(asErr(OWNER,`update fuel_logs set amount=1 where id='${F.f20}'`)||''));
ok('_fuel_sar: 50 ⇒ 50، 7.5 ⇒ 7.5، 49.42 ⇒ 49.42، -9.5 ⇒ -9.5، 0.58 ⇒ 0.58',ps(`select string_agg(_fuel_sar(x),',') from unnest(array[50,7.5,49.42,-9.5,0.58]::numeric[]) x`)==='50,7.5,49.42,-9.5,0.58');
ok('request_fuel القديمة ترفض بـ USE_WALLET حتى لو نُفّذت',/USE_WALLET/.test(err(`select request_fuel(1,'u')`)||''));

// ── رصيد البايكر ──
ok('my_fuel_balance: البايكر يرى رصيده والعتبة ومبلغ الدفعة والتسامح',as(ARIF,`select balance||'|'||threshold||'|'||topup_amount||'|'||tolerance from my_fuel_balance()`)==='15|10|50|10');
ok('غير البايكر ⇒ NOT_A_BIKER',code(asErr(FA_EDIT,`select * from my_fuel_balance()`))==='NOT_A_BIKER');
ok('رقم البايكر بمسافات (" 1700 ") ⇒ رصيده الصحيح',as(RAKIB,`select balance from my_fuel_balance()`)==='50');
ok('fuel_balances للإدارة فقط: العرض يرى الكل، وغيره لا صفوف',as(FA_VIEW,`select string_agg(biker_employee_id||'='||balance, ',' order by biker_employee_id) from fuel_balances() where biker_employee_id in ('1624','1648','1700')`)==='1624=15,1648=50,1700=50'
  &&as(NOBODY,`select count(*) from fuel_balances()`)==='0'&&as(ARIF,`select count(*) from fuel_balances()`)==='0');
ok('fuel_balances: تعبئات بانتظار الاعتماد لعريف = 2',as(FA_VIEW,`select pending_fills from fuel_balances() where biker_employee_id='1624'`)==='2');

// ── التعبئة ──
const fill=(u,odo,amt,lit)=>as(u,`select add_fuel_fill(${odo},${amt},${lit},'https://x/o.jpg','https://x/r.jpg')`);
const fillE=(u,odo,amt,lit)=>code(asErr(u,`select add_fuel_fill(${odo},${amt},${lit},'https://x/o.jpg','https://x/r.jpg')`));
ok('اللترات إلزامية ⇒ LITERS_REQUIRED',fillE(MIDUL,20100,20,null)==='LITERS_REQUIRED'&&fillE(MIDUL,20100,20,0)==='LITERS_REQUIRED');
ok('العدّاد لا يتقدّم ⇒ ODOMETER_NOT_INCREASING، ونفس العدّاد ⇒ DUPLICATE_FILL',fillE(ARIF,13700,5,2)==='ODOMETER_NOT_INCREASING'&&fillE(ARIF,13818,5,2)==='DUPLICATE_FILL');
ok('المبلغ > الرصيد + 10 ⇒ OVER_BALANCE (عريف 15: 26 مرفوض)',fillE(ARIF,13900,26,11)==='OVER_BALANCE');
const m1=fill(MIDUL,20100,25,11);
ok('تعبئة ميدول 25﷼/11 لتر: مربوطة FIFO بدفعته، سعر 2.27 بلا تحذير',ps(`select (request_id='${R.mid}')::text||'|'||price_warn||'|'||status from fuel_logs where id='${m1}'`)==='true|false|submitted');
ok('تعبئة ثانية خلال 10 دقائق ⇒ DUPLICATE_FILL',fillE(MIDUL,20200,5,2)==='DUPLICATE_FILL');
ps(`update fuel_logs set fill_at=fill_at-interval '1 hour', created_at=created_at-interval '1 hour' where id='${m1}'`);
const m2=fill(MIDUL,20300,18,6);
ok('سعر 3.0 ﷼/لتر خارج [2.0, 2.6] ⇒ تحذير للمراجع لا رفض',ps(`select price_warn from fuel_logs where id='${m2}'`)==='t');
ok('رصيد ميدول 50 − 25 − 18 = 7 < 10 ⇒ طلب تلقائي 50 ﷼ (auto) بلا created_by، بعدّاد آخر تعبئة',
  ps(`select string_agg(amount||'|'||source||'|'||(created_by is null)::text||'|'||odometer, ',') from fuel_requests where biker_employee_id='1648' and status='requested'`)==='50|auto|true|20300');
ok('إشعار «دفعة وقود تلقائية» للمالك وصاحب fleet_alerts تعديل',ps(`select count(*) from notif_log where title like 'دفعة وقود تلقائية%' and body like '%الرصيد 7%'`)==='2');
ps(`update fuel_logs set fill_at=fill_at-interval '1 hour' where id='${m2}'`);
fill(MIDUL,20400,5,2.2);
ok('طلب مفتوح ⇒ لا طلب تلقائي ثانٍ (طلب واحد مطلوب)',ps(`select count(*) from fuel_requests where biker_employee_id='1648' and status='requested'`)==='1');
ok('التسامح: رصيد 2 ⇒ تعبئة 12 تُقبل و 13 ترفض',(()=>{ps(`update fuel_logs set fill_at=fill_at-interval '1 hour' where biker_employee_id='1648'`);return fillE(MIDUL,20500,13,5)==='OVER_BALANCE'&&!!fill(MIDUL,20500,12,5);})());
ok('الرصيد يمكن أن يكون سالباً حتى حد التسامح (يُرحَّل)',ps(`select fuel_balance('1648')`)==='-10');

// ── الدفعة المستعجلة ──
ok('مستعجلة برصيد كافٍ ⇒ BALANCE_OK، وبطلب مفتوح ⇒ OPEN_REQUEST، وبلا سبب ⇒ REASON_REQUIRED',
  code(asErr(RAKIB,`select request_urgent_topup('x')`))==='BALANCE_OK'&&code(asErr(MIDUL,`select request_urgent_topup('x')`))==='OPEN_REQUEST'&&code(asErr(ARIF,`select request_urgent_topup('  ')`))==='REASON_REQUIRED');

// ── التحويل والرفض ──
const auto=ps(`select id from fuel_requests where biker_employee_id='1648' and status='requested'`);
ok('التحويل: عرض فقط ⇒ FORBIDDEN، بلا رقم عملية ⇒ TXN_REQUIRED، رقم مكرر ⇒ DUPLICATE_TXN',
  code(asErr(FA_VIEW,`select transfer_fuel_request(p_id=>'${auto}', p_bank_txn=>'T1')`))==='FORBIDDEN'&&code(asErr(FA_EDIT,`select transfer_fuel_request(p_id=>'${auto}', p_bank_txn=>' ')`))==='TXN_REQUIRED'
  &&(()=>{ps(`update fuel_requests set bank_txn='T-USED' where id='${R.rak}'`);return code(asErr(FA_EDIT,`select transfer_fuel_request(p_id=>'${auto}', p_bank_txn=>'T-USED')`))==='DUPLICATE_TXN';})());
as(FA_EDIT,`select transfer_fuel_request(p_id=>'${auto}', p_bank_txn=>'TXN-1001')`);
ok('حُوِّل بالقيم الافتراضية 50 و 0.58، ورقم العملية في bank_txn و transfer_ref، وإشعار عربي+بنغالي للبايكر',
  ps(`select status||'|'||amount_actual||'|'||fee||'|'||bank_txn||'|'||transfer_ref from fuel_requests where id='${auto}'`)==='transferred|50|0.58|TXN-1001|TXN-1001'
  &&ps(`select count(*) from notif_log where dedupe='fuel-tr-${auto}-${MIDUL}' and title like '%জ্বালানির%'`)==='1');
ok('إشعار التحويل بالمبلغ الدقيق (50 لا تقريب)',ps(`select body from notif_log where dedupe='fuel-tr-${auto}-${MIDUL}'`).startsWith('50 ﷼'));
ok('بعد التحويل رصيد ميدول 40 ⇒ لا طلب تلقائي',ps(`select fuel_balance('1648')`)==='40'&&ps(`select count(*) from fuel_requests where biker_employee_id='1648' and status='requested'`)==='0');
ok('تحويل مرتين ⇒ NOT_REQUESTED، والقديمة (p_ref) ⇒ مغلقة',code(asErr(OWNER,`select transfer_fuel_request(p_id=>'${auto}', p_bank_txn=>'TXN-2')`))==='NOT_REQUESTED'
  &&/permission denied/.test(asErr(OWNER,`select transfer_fuel_request(p_id=>'${auto}', p_ref=>'X')`)||''));
ps(`update fuel_logs set fill_at=fill_at-interval '1 hour' where biker_employee_id='1648'`);
ok('التعبئة التالية تُربط FIFO بالدفعة الجديدة (القديمة غطّتها 25+18+5+12 ≥ 50)',ps(`select request_id from fuel_logs where id='${fill(MIDUL,20600,10,4.2)}'`)===auto);

// ── مراجعة التعبئة ──
ok('مراجعة: عرض فقط ⇒ FORBIDDEN، رفض بلا سبب ⇒ REASON_REQUIRED',code(asErr(FA_VIEW,`select review_fuel_fill('${m2}',true)`))==='FORBIDDEN'&&code(asErr(FA_EDIT,`select review_fuel_fill('${m2}',false,' ')`))==='REASON_REQUIRED');
as(FA_EDIT,`select review_fuel_fill('${m1}',true)`);
const before=ps(`select fuel_balance('1648')`);
as(FA_EDIT,`select review_fuel_fill('${m2}',false,'الفاتورة غير واضحة')`);
ok('المرفوضة لا تُخصم: الرصيد يرتفع 18',Number(ps(`select fuel_balance('1648')`))===Number(before)+18);
ok('إشعار الرفض بالسبب عربي + بنغالي، والاعتماد كذلك',ps(`select count(*) from notif_log where dedupe='fuel-fill-no-${m2}-${MIDUL}' and title like '%প্রত্যাখ্যাত%' and body like '%الفاتورة غير واضحة%'`)==='1'
  &&ps(`select count(*) from notif_log where dedupe='fuel-fill-ok-${m1}-${MIDUL}' and title like '%অনুমোদিত%'`)==='1');
ok('مراجعة مرتين ⇒ ALREADY_REVIEWED',code(asErr(FA_EDIT,`select review_fuel_fill('${m1}',false,'x')`))==='ALREADY_REVIEWED');

// ── رفض الدفعة + المستعجلة ──
ps(`update fuel_logs set fill_at=fill_at-interval '1 hour' where biker_employee_id='1624'`);
fill(ARIF,13900,10,4.4);
const ar=ps(`select id from fuel_requests where biker_employee_id='1624' and status='requested'`);
ok('عريف 15 − 10 = 5 ⇒ طلب تلقائي',!!ar);
as(OWNER,`select reject_fuel_request('${ar}','تُدمج مع دفعة الأسبوع')`);
ok('رفض الطلب بسبب ⇒ rejected ولا يُعاد إنشاؤه تلقائياً، وإشعار للبايكر',ps(`select status||'|'||reject_reason from fuel_requests where id='${ar}'`)==='rejected|تُدمج مع دفعة الأسبوع'
  &&ps(`select count(*) from fuel_requests where biker_employee_id='1624' and status='requested'`)==='0'&&ps(`select count(*) from notif_log where dedupe='fuel-rej-${ar}-${ARIF}'`)==='1');
const pend=ps(`select id from fuel_logs where biker_employee_id='1624' and status='submitted' order by fill_at limit 1`);
as(FA_EDIT,`select review_fuel_fill('${pend}',true)`);
ok('اعتماد تعبئة بعد رفض الطلب لا يعيد إنشاءه (الاعتماد لا يغيّر الرصيد)',ps(`select count(*) from fuel_requests where biker_employee_id='1624' and status='requested'`)==='0');
const ur=as(ARIF,`select request_urgent_topup('نفد الوقود في الطريق')`);
ok('بعد الرفض: المستعجلة تُقبل (urgent، بسببه، created_by = البايكر) وتنبّه الإدارة',ps(`select source||'|'||reason||'|'||(created_by='${ARIF}')::text||'|'||amount from fuel_requests where id='${ur}'`)==='urgent|نفد الوقود في الطريق|true|50'
  &&ps(`select count(*) from notif_log where dedupe like 'fuel-urgent-${ur}%'`)==='2');
ps(`update fuel_requests set amount=60 where id='${ur}'`);as(OWNER,`select transfer_fuel_request(p_id=>'${ur}', p_bank_txn=>'TXN-60')`);
ok('التحويل بلا مبلغ ⇒ مبلغ الطلب نفسه (60 لا 50)',ps(`select amount_actual||'|'||fee from fuel_requests where id='${ur}'`)==='60|0.58');
ps(`insert into fuel_requests (vehicle_id,biker_employee_id,amount,status) values ('${V.a}','1624',50,'requested')`);
ok('طلب مفتوح واحد لكل بايكر على مستوى القاعدة (فهرس فريد)',/duplicate key|unique/.test(err(`insert into fuel_requests (vehicle_id,biker_employee_id,amount,status) values ('${V.a}','1624',50,'requested')`)||''));

// ── الحدود ──
ok('حدود إعدادات الرصيد: العتبة ≥ المبلغ ⇒ BAD_VALUE، المبلغ > 1000 ⇒ BAD_VALUE، التسامح > 100، min ≥ max',
  code(asErr(FA_EDIT,`select set_fleet_alert_setting('fuel_topup_threshold',50)`))==='BAD_VALUE'&&code(asErr(FA_EDIT,`select set_fleet_alert_setting('fuel_topup_amount',1500)`))==='BAD_VALUE'
  &&code(asErr(FA_EDIT,`select set_fleet_alert_setting('fuel_fill_tolerance',101)`))==='BAD_VALUE'&&code(asErr(FA_EDIT,`select set_fleet_alert_setting('fuel_price_min',2.6)`))==='BAD_VALUE'
  &&code(asErr(FA_EDIT,`select set_fleet_alert_setting('fuel_price_max',2.0)`))==='BAD_VALUE');
ok('ضبط: المفاتيح الجديدة مقبولة، وتاريخ بداية غير صالح ⇒ BAD_VALUE، وإعداد الرصيد لدراجة ⇒ BAD_KEY',
  as(FA_EDIT,`select set_fleet_alert_setting('fuel_topup_threshold',12)`)==='t'&&code(asErr(FA_EDIT,`select set_fleet_alert_setting('fuel_wallet_start',20261332)`))==='BAD_VALUE'
  &&code(asErr(FA_EDIT,`select set_fleet_alert_setting('fuel_topup_amount',60,'${V.a}')`))==='BAD_KEY'&&as(FA_EDIT,`select set_fleet_alert_setting('fuel_topup_threshold',10)`)==='t');

// ── المصروفات الشهرية ──
ok('fuel_expenses_monthly: الفواتير المعتمدة فقط «وقود»، والرسوم «رسوم بنكية» بشهر التحويل، والدفعات ليست مصروفاً',
  as(FA_VIEW,`select string_agg(period||'|'||category||'|'||amount||'|'||n, ',' order by category) from fuel_expenses_monthly`)===`2026-10|رسوم بنكية|2.90|5,2026-10|وقود|45|2`
  ||(()=>{console.log('  ',as(FA_VIEW,`select string_agg(period||'|'||category||'|'||amount||'|'||n, ',' order by category) from fuel_expenses_monthly`));return false;})());
ok('البايكر يرى مصروفاته فقط عبر العرض (security_invoker)',as(RAKIB,`select coalesce(sum(amount),0) from fuel_expenses_monthly where category='وقود'`)==='0');
}finally{ps(`drop database if exists ${db}`,'postgres');}
