// جرد العهدة من الجولة + تجديدها بتسليم الإمداد على Postgres محلي (docs/sql/round_custody_check.sql)
// يعمل فقط مع PGTEST_PORT (مثلاً PGTEST_PORT=55432 npm test)؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='rcc_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
const as=(uid,sql)=>ps(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`).split('\n').pop();
const asErr=(uid,sql)=>err(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`);

const OWNER='00000000-0000-0000-0000-00000000000a',SUP='00000000-0000-0000-0000-00000000005b',VIEW='00000000-0000-0000-0000-0000000000ee',STORE='00000000-0000-0000-0000-0000000000cc';
const E_MIDUL='10000000-0000-0000-0000-000000001648',E_RAKIB='10000000-0000-0000-0000-000000001700';
const BIKE='20000000-0000-0000-0000-000000000001',PHONE='20000000-0000-0000-0000-000000000002',BOX='20000000-0000-0000-0000-000000000003',
  TOWEL='20000000-0000-0000-0000-000000000004',SOAP='20000000-0000-0000-0000-000000000005',CHEST='20000000-0000-0000-0000-000000000006',
  RAKIB_TOWEL='20000000-0000-0000-0000-000000000007',OLD='20000000-0000-0000-0000-000000000008',GONE='20000000-0000-0000-0000-000000000009';
const R1='30000000-0000-0000-0000-000000000001',R0='30000000-0000-0000-0000-000000000000',RX='30000000-0000-0000-0000-00000000000f';
const IMEI='490154203237518';

ps(`create database ${db}`,'postgres');
try{
ps(`do $$ begin create role anon; exception when others then null; end $$;
do $$ begin create role authenticated; exception when others then null; end $$;
create schema auth; create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('test.uid',true),'')::uuid $f$;
grant usage on schema auth to authenticated, anon;
create table public.app_users (id uuid primary key, is_owner boolean not null default false, active boolean not null default true);
create table public.user_permissions (user_id uuid, module text, can_view boolean, can_edit boolean);
create table public.employees (id uuid primary key, full_name text not null, employee_id text);
create function public.is_owner() returns boolean language sql stable security definer set search_path to 'public' as $f$ select exists(select 1 from public.app_users where id = auth.uid() and is_owner and active) $f$;
create function public.has_perm(p_module text, p_need_edit boolean default false) returns boolean language sql stable security definer set search_path to 'public' as $f$
  select public.is_owner() or exists(select 1 from public.user_permissions up join public.app_users au on au.id = up.user_id where up.user_id = auth.uid() and au.active and up.module = p_module and (up.can_view or up.can_edit) and (not p_need_edit or up.can_edit)) $f$;
create table public.field_rounds (id uuid primary key, employee_id uuid, sweater_id text, round_date date, results jsonb default '{}');
create table public.custody_assets (id uuid primary key default gen_random_uuid(), operator_id uuid, employee_id uuid, biker_name text, sweater_id text, item_type text not null default 'other', category text, name text, name_en text,
  start_date date not null default current_date, life_months numeric not null default 12, end_date date, lead_days int default 60, cost numeric, status text not null default 'active', source text default 'manual',
  round_id uuid references public.field_rounds(id) on delete set null, reorder_request_id uuid, notes text, created_at timestamptz default now(), serial_no text, specs jsonb not null default '{}');
alter table public.custody_assets enable row level security;
create policy ca_sel on public.custody_assets for select using (has_perm('supply') or has_perm('field_rounds'));
create policy ca_wr on public.custody_assets for all using (has_perm('supply', true) or has_perm('field_rounds', true)) with check (has_perm('supply', true) or has_perm('field_rounds', true));
create table public.supply_requests (id uuid primary key default gen_random_uuid(), ref text unique, round_id uuid references public.field_rounds(id) on delete set null, sweater_id text,
  items jsonb not null default '[]', status text not null default 'open', created_at timestamptz default now(), completed_at timestamptz, completion_note text);
grant select, insert, update, delete on all tables in schema public to authenticated;
insert into app_users values ('${OWNER}',true,true),('${SUP}',false,true),('${VIEW}',false,true),('${STORE}',false,true);
insert into user_permissions values ('${SUP}','field_rounds',true,true),('${VIEW}','field_rounds',true,false),('${STORE}','supply',true,true);
insert into employees values ('${E_MIDUL}','Midul Hassan','1648'),('${E_RAKIB}','Mohamad Rakib','1700');
insert into field_rounds values ('${R1}','${E_MIDUL}','1648','2026-10-03'),('${R0}','${E_MIDUL}','1648','2026-09-30'),('${RX}',null,'9999','2026-10-03');
insert into custody_assets (id,employee_id,sweater_id,item_type,name,start_date,life_months,end_date,status,serial_no,round_id) values
 ('${BIKE}','${E_MIDUL}','1648','motorcycle','الدراجة النارية','2026-08-07',36,'2029-08-07','active',null,'${R0}'),
 ('${PHONE}','${E_MIDUL}','1648','device','الجوال','2026-10-12',24,'2028-10-12','active','${IMEI}',null),
 ('${BOX}','${E_MIDUL}','1648','tool','صندوق الخدمة','2026-08-07',24,'2028-08-07','active',null,'${R0}'),
 ('${TOWEL}','${E_MIDUL}','1648','towel','مناشف ميكروفايبر (4 ألوان)','2026-08-07',2,'2026-10-07','due',null,'${R0}'),
 ('${SOAP}','${E_MIDUL}','1648','cleaning','صابون/شامبو','2026-08-07',1,'2026-09-07','active',null,'${R0}'),
 ('${CHEST}','${E_MIDUL}','1648','safety','الصدرية (واقي الصدر)','2026-08-07',24,'2028-08-07','active',null,'${R0}'),
 ('${RAKIB_TOWEL}','${E_RAKIB}','1700','towel','مناشف ميكروفايبر (4 ألوان)','2026-08-05',2,'2026-10-05','active',null,null),
 ('${OLD}','${E_MIDUL}','1648','safety','الخوذة','2025-01-01',24,'2027-01-01','replaced',null,null);`);

const F=fs.readFileSync(new URL('../docs/sql/round_custody_check.sql',import.meta.url),'utf8');
const body=F.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n');
ok('الملف بلا drop ولا delete خارج التعليقات (أداة MCP)',!/\bdrop\b|\bdelete\b/i.test(body));
const e1=err(F),e2=err(F);
ok('الملف يُطبَّق مرتين بلا خطأ'+(e1||e2?' — '+String(e1||e2).slice(0,300):''),!e1&&!e2);
if(e1||e2)process.exit(1);
ok('القطع القائمة بلا تغيير: لا جرد ولا قرار',ps(`select count(*)||'|'||count(last_check_at)||'|'||count(decision_status) from custody_assets`)==='8|0|0');
ok('anon لا يملك تنفيذ الدالتين، والمسجّل يملك',ps(`select has_function_privilege('anon','public.round_custody_check(uuid,jsonb)','execute')::text||has_function_privilege('anon','public.supply_request_complete(uuid,text,uuid[])','execute')::text||has_function_privilege('authenticated','public.round_custody_check(uuid,jsonb)','execute')::text`)==='falsefalsetrue');

const L=a=>`'${JSON.stringify(a)}'::jsonb`;
const chk=(uid,round,lines)=>as(uid,`select round_custody_check('${round}',${L(lines)})::text`);
const chkErr=(uid,round,lines)=>asErr(uid,`select round_custody_check('${round}',${L(lines)})`)||'';
const okLines=[{asset_id:BIKE,condition:'ok',photo:'b.jpg'},{asset_id:PHONE,condition:'ok',photo:'p.jpg',imei:'4901 5420 3237 518'},{asset_id:BOX,condition:'ok',photo:'x.jpg'},{asset_id:TOWEL,condition:'ok'}];

// ── الرفض ──
ok('عرض فقط بلا تعديل الجولات ⇒ مرفوض',/ROUND_CUSTODY_DENIED/.test(chkErr(VIEW,R1,okLines)));
ok('أمين الإمداد بلا «الجولات» ⇒ مرفوض',/ROUND_CUSTODY_DENIED/.test(chkErr(STORE,R1,okLines)));
ok('جولة بلا موظف ⇒ لا يُخمَّن',/ROUND_NO_EMPLOYEE/.test(chkErr(SUP,RX,okLines)));
ok('قطعة بايكر آخر ⇒ مرفوضة',/CUSTODY_CHECK_ASSET/.test(chkErr(SUP,R1,[{asset_id:RAKIB_TOWEL,condition:'ok'}])));
ok('قطعة مُستبدلة ⇒ مرفوضة',/CUSTODY_CHECK_ASSET/.test(chkErr(SUP,R1,[{asset_id:OLD,condition:'ok',photo:'h'}])));
ok('قطعة مكرّرة ⇒ مرفوضة',/CUSTODY_CHECK_DUP/.test(chkErr(SUP,R1,[{asset_id:TOWEL,condition:'ok'},{asset_id:TOWEL,condition:'ok'}])));
ok('حالة غير معروفة ⇒ مرفوضة',/CUSTODY_CHECK_CONDITION/.test(chkErr(SUP,R1,[{asset_id:TOWEL,condition:'fine'}])));
ok('تالفة بلا ملاحظة ⇒ مرفوضة',/CUSTODY_CHECK_NOTE/.test(chkErr(SUP,R1,[{asset_id:TOWEL,condition:'damaged',note:' '}])));
ok('الدراجة/الصندوق بلا صورة ⇒ مرفوضة، والمفقودة بلا صورة مقبولة',/CUSTODY_CHECK_PHOTO/.test(chkErr(SUP,R1,[{asset_id:BIKE,condition:'ok'}]))&&/CUSTODY_CHECK_PHOTO/.test(chkErr(SUP,R1,[{asset_id:BOX,condition:'damaged',note:'مكسور'}])));
ok('الجوال بلا IMEI ⇒ مرفوض',/CUSTODY_CHECK_IMEI/.test(chkErr(SUP,R1,[{asset_id:PHONE,condition:'ok',photo:'p'}])));
ok('الرفض لا يغيّر شيئاً (معاملة واحدة)',ps(`select count(last_check_at) from custody_assets`)==='0'&&ps(`select custody_check::text from field_rounds where id='${R1}'`)==='[]');

// ── جرد سليم ──
const r1=JSON.parse(chk(SUP,R1,okLines));
ok('جرد سليم: 4 أسطر، 4 قطع محدّثة، لا شيء بانتظار القرار',r1.lines===4&&r1.updated===4&&r1.pending===0);
ok('على القطعة: تاريخ الجولة والحالة ورقم الجولة، وround_id الأصلي (جولة الإنشاء) كما هو',ps(`select last_check_at||'|'||last_check_condition||'|'||(last_check_round_id='${R1}')||'|'||(round_id='${R0}')||'|'||last_check_photo||'|'||status from custody_assets where id='${BIKE}'`)==='2026-10-03|ok|true|true|b.jpg|active');
ok('الجوال: IMEI مطابق رغم المسافات ⇒ ✅، وعلى الجولة آخر 4 أرقام فقط',ps(`select last_check_imei_ok from custody_assets where id='${PHONE}'`)==='t'&&ps(`select (l->>'imei_ok')||'|'||(l->>'imei_last4')||'|'||(position('${IMEI}' in custody_check::text)>0) from field_rounds, jsonb_array_elements(custody_check) l where id='${R1}' and l->>'asset_id'='${PHONE}'`)==='true|7518|false');
ok('القطعة «مستحقة» (due) تُجرد، وحالتها لا تتغيّر',ps(`select status||'|'||last_check_condition from custody_assets where id='${TOWEL}'`)==='due|ok');

// ── تالف/مفقود/IMEI مختلف ⇒ بانتظار قرار المالك ──
const r2=JSON.parse(chk(SUP,R1,[{asset_id:PHONE,condition:'ok',photo:'p2',imei:'356938035643809'},{asset_id:BOX,condition:'damaged',note:'القفل مكسور',photo:'x2'},{asset_id:SOAP,condition:'lost',note:'غير موجودة'}]));
ok('تعديل الجولة نفسها: 3 أسطر، والثلاث بانتظار القرار',r2.lines===3&&r2.updated===3&&r2.pending===3);
ok('IMEI مختلف ⇒ ❌ وبانتظار القرار',ps(`select last_check_imei_ok||'|'||decision_status from custody_assets where id='${PHONE}'`)==='false|pending');
ok('التالفة والمفقودة: بانتظار القرار، وstatus بلا تغيير (لا تحميل ولا إغلاق تلقائي)',ps(`select string_agg(last_check_condition||':'||decision_status||':'||status,',' order by name) from custody_assets where id in ('${BOX}','${SOAP}')`)==='lost:pending:active,damaged:pending:active');
ok('الجولة تحفظ الأسطر الجديدة وتُبقي أسطرها السابقة للقطع غير المرسلة (3 + الدراجة والمناشف)',ps(`select jsonb_array_length(custody_check) from field_rounds where id='${R1}'`)==='5'&&ps(`select string_agg(l->>'condition',',' order by l->>'name') from field_rounds, jsonb_array_elements(custody_check) l where id='${R1}'`)==='ok,ok,lost,damaged,ok');
const r2b=JSON.parse(chk(SUP,R1,[{asset_id:PHONE,condition:'ok',photo:'p3'}]));
ok('تعديل الجولة بلا IMEI جديد ⇒ تبقى نتيجة المطابقة المحفوظة (❌ و…3809)، ولا علامة جديدة',r2b.pending===0&&ps(`select last_check_imei_ok::text from custody_assets where id='${PHONE}'`)==='false'&&ps(`select l->>'imei_last4' from field_rounds, jsonb_array_elements(custody_check) l where id='${R1}' and l->>'asset_id'='${PHONE}'`)==='3809');
ok('جولة أخرى بلا IMEI للجوال ⇒ مرفوض (لا نتيجة محفوظة لها)',/CUSTODY_CHECK_IMEI/.test(chkErr(SUP,R0,[{asset_id:PHONE,condition:'ok',photo:'p'}])));

// ── جولة أقدم لا تكتب فوق جرد أحدث ──
const r3=JSON.parse(chk(SUP,R0,[{asset_id:BOX,condition:'ok',photo:'old'}]));
ok('جولة 30/09 بعد جرد 03/10: تُحفظ على الجولة ولا تمسّ القطعة',r3.lines===1&&r3.updated===0&&ps(`select last_check_condition||'|'||last_check_photo from custody_assets where id='${BOX}'`)==='damaged|x2');

// ── «سليمة» لا تمسح العلامة، والقرار للمالك وحده ──
chk(SUP,R1,[{asset_id:BOX,condition:'ok',photo:'x3'}]);
ok('جرد لاحق «سليمة» لا يمسح «بانتظار القرار»',ps(`select last_check_condition||'|'||decision_status from custody_assets where id='${BOX}'`)==='ok|pending');
ok('غير المالك لا يقرّر ولا يمسح العلامة مباشرة',/CUSTODY_CHECK_GUARD/.test(asErr(SUP,`update custody_assets set decision_status='decided',decision_note='x' where id='${BOX}'`)||'')
  &&/CUSTODY_CHECK_GUARD/.test(asErr(STORE,`update custody_assets set decision_status=null where id='${SOAP}'`)||''));
ok('غير المالك لا يكتب خانات الجرد مباشرة (IMEI ✅ مزيّف، حالة سليمة)',/CUSTODY_CHECK_GUARD/.test(asErr(STORE,`update custody_assets set last_check_imei_ok=true where id='${PHONE}'`)||'')&&/CUSTODY_CHECK_GUARD/.test(asErr(SUP,`update custody_assets set last_check_condition='ok' where id='${SOAP}'`)||''));
ok('غير المالك لا يُدرج قطعة بقرار جاهز',/CUSTODY_CHECK_GUARD/.test(asErr(SUP,`insert into custody_assets (employee_id,name,decision_status,decision_note) values ('${E_MIDUL}','x','decided','y')`)||''));
ok('تعديلات غير المالك الأخرى تمرّ (ملاحظة/حالة)',!asErr(STORE,`update custody_assets set notes='خُطّط للاستبدال', status='due' where id='${CHEST}'`));
ok('المالك يقرّر',!asErr(OWNER,`update custody_assets set decision_status='decided',decision_note='إصلاح على الشركة',decided_by=auth.uid(),decided_at=now() where id='${BOX}'`)
  &&ps(`select decision_status||'|'||decision_note||'|'||(decided_by='${OWNER}') from custody_assets where id='${BOX}'`)==='decided|إصلاح على الشركة|true');
ok('غير المالك لا يعيد قراراً مسجّلاً إلى «بانتظار»',/CUSTODY_CHECK_GUARD/.test(asErr(SUP,`update custody_assets set decision_status='pending',decision_note=null,decided_by=null,decided_at=null where id='${BOX}'`)||''));
chk(SUP,R1,[{asset_id:BOX,condition:'damaged',note:'كسر جديد',photo:'x4'}]);
ok('تلف جديد بعد القرار ⇒ بانتظار القرار من جديد بحقول قرار فارغة',ps(`select decision_status||'|'||coalesce(decision_note,'-')||'|'||coalesce(decided_by::text,'-') from custody_assets where id='${BOX}'`)==='pending|-|-');
as(OWNER,`update custody_assets set decision_status='decided',decision_note='استبدال على الشركة',decided_by=auth.uid(),decided_at=now() where id='${BOX}'`);
const r5=JSON.parse(chk(SUP,R1,[{asset_id:BOX,condition:'damaged',note:'كسر جديد — تصحيح إملائي',photo:'x4'}]));
ok('إعادة حفظ الجولة نفسها بالحالة نفسها لا تمسح قرار المالك',r5.pending===0&&ps(`select decision_status||'|'||decision_note from custody_assets where id='${BOX}'`)==='decided|استبدال على الشركة');

// ── «ناقص» بلا عدّاد ──
ok('ناقص بتاريخ نهاية ⇒ مرفوض بالقيد، وبلا نهاية مقبول',/custody_assets_missing_ck/.test(asErr(SUP,`insert into custody_assets (employee_id,name,status,end_date) values ('${E_MIDUL}','x','missing','2027-01-01')`)||'')
  &&!asErr(SUP,`insert into custody_assets (id,employee_id,sweater_id,item_type,name,start_date,life_months,status,end_date,round_id) values ('${GONE}','${E_MIDUL}','1648','safety','الخوذة','2026-10-03',24,'missing',null,'${R1}')`));
ok('القطعة الناقصة لا تُجرد (ليست بيد البايكر)',/CUSTODY_CHECK_ASSET/.test(chkErr(SUP,R1,[{asset_id:GONE,condition:'ok',photo:'h'}])));

// ── تسليم طلب الإمداد ⇒ تجديد الدورة ──
const Q1=ps(`insert into supply_requests (ref,round_id,sweater_id) values ('DW-1648-20261003-0900','${R1}','1648') returning id`);
const Q2=ps(`insert into supply_requests (ref,round_id,sweater_id) values ('DW-1648-NOROUND',null,'1648') returning id`);
const Q3=ps(`insert into supply_requests (ref,round_id,sweater_id) values ('DW-1648-R3','${RX}','9999') returning id`);
const done=(uid,q,ids,note='تم')=>as(uid,`select supply_request_complete('${q}','${note}',array[${ids.map(i=>`'${i}'`).join(',')}]::uuid[])::text`);
const doneErr=(uid,q,ids)=>asErr(uid,`select supply_request_complete('${q}','x',array[${ids.map(i=>`'${i}'`).join(',')}]::uuid[])`)||'';
ok('عرض فقط ⇒ مرفوض',/SUPPLY_COMPLETE_DENIED/.test(doneErr(VIEW,Q1,[SOAP])));
ok('قطعة بايكر آخر ⇒ مرفوض',/SUPPLY_ASSET/.test(doneErr(STORE,Q1,[RAKIB_TOWEL])));
ok('الجوال والدراجة لا يُجدَّدان بالإمداد',/SUPPLY_ASSET_TYPE/.test(doneErr(STORE,Q1,[PHONE]))&&/SUPPLY_ASSET_TYPE/.test(doneErr(STORE,Q1,[BIKE])));
ok('قطعة مُستبدلة ⇒ مرفوض',/SUPPLY_ASSET_CLOSED/.test(doneErr(STORE,Q1,[OLD])));
ok('طلب بلا جولة وقطعة غير مربوطة به ⇒ مرفوض، وجولة بلا موظف ⇒ لا يُخمَّن',/SUPPLY_ASSET/.test(doneErr(STORE,Q2,[SOAP]))&&/SUPPLY_ASSET/.test(doneErr(STORE,Q3,[SOAP])));
ok('الرفض لا يغلق الطلب ولا يجدّد',ps(`select string_agg(status,',') from supply_requests`)==='open,open,open'&&ps(`select start_date from custody_assets where id='${SOAP}'`)==='2026-08-07');
const d1=JSON.parse(done(STORE,Q1,[SOAP,GONE]));
const day=ps(`select (now() at time zone 'Asia/Riyadh')::date`);
ok('التسليم يجدّد القطعتين: البداية = يوم التسليم، النهاية = + العمر، ورقم الطلب عليها',d1.renewed===2&&d1.start===day
  &&ps(`select (start_date='${day}')||'|'||(end_date=('${day}'::date+interval '1 month')::date)||'|'||status||'|'||(reorder_request_id='${Q1}')||'|'||(notes like '%جُدّدت بطلب DW-1648-20261003-0900%') from custody_assets where id='${SOAP}'`)==='true|true|active|true|true');
ok('الناقصة تصبح نشطة ويبدأ عدّادها من التسليم',ps(`select status||'|'||(start_date='${day}')||'|'||(end_date=('${day}'::date+interval '24 months')::date) from custody_assets where id='${GONE}'`)==='active|true|true');
ok('التسليم لا يمسّ «بانتظار قرار المالك»',ps(`select decision_status from custody_assets where id='${SOAP}'`)==='pending');
ok('الطلب مكتمل بتاريخه وملاحظته، ولا يُغلق مرتين',ps(`select status||'|'||(completed_at is not null)||'|'||completion_note from supply_requests where id='${Q1}'`)==='completed|true|تم'&&/SUPPLY_CLOSED/.test(doneErr(STORE,Q1,[])));
ok('طلب بلا جولة يُغلق بلا قطع (كالسابق)',JSON.parse(done(SUP,Q2,[])).renewed===0&&ps(`select status from supply_requests where id='${Q2}'`)==='completed');
// طلب استبدال من اعتماد إقرار (بلا جولة): القطعة «مستحقة» ومربوطة بالطلب ⇒ تتجدّد عند التسليم
const Q4=ps(`insert into supply_requests (ref,round_id,sweater_id) values ('DW-1648-A1234',null,'1648') returning id`);
ps(`update custody_assets set status='due', reorder_request_id='${Q4}' where id='${CHEST}'`);
ok('طلب مربوط بالقطعة (reorder_request_id) بلا جولة ⇒ تتجدّد وتعود نشطة',JSON.parse(done(STORE,Q4,[CHEST])).renewed===1&&ps(`select status||'|'||(start_date='${day}') from custody_assets where id='${CHEST}'`)==='active|true');

// ── «ناقصة» تُغلق عند وصول قطعة نشطة بالاسم نفسه ──
const SH=as(SUP,`insert into custody_assets (employee_id,sweater_id,item_type,name,start_date,life_months,status,end_date) values ('${E_MIDUL}','1648','safety','حذاء السلامة','2026-10-03',12,'missing',null) returning id`);
const SH2=as(STORE,`insert into custody_assets (employee_id,sweater_id,item_type,name,start_date,life_months,end_date) values ('${E_MIDUL}','1648','safety','حذاء السلامة','2026-10-14',12,'2027-10-14') returning id`);
ok('إضافة قطعة نشطة ⇒ الناقصة «مُستبدلة» بملاحظة «استُبدلت YYYY-MM-DD» (يقرؤها سجل القطعة)',ps(`select status||'|'||(notes ~ 'كانت ناقصة — استُبدلت \\d{4}-\\d{2}-\\d{2} بقطعة ${SH2}') from custody_assets where id='${SH}'`)==='replaced|true');
ok('لا تمسّ ناقصة بايكر آخر أو صنفاً آخر',!asErr(SUP,`insert into custody_assets (employee_id,name,status,end_date) values ('${E_RAKIB}','حذاء السلامة','missing',null)`)&&as(STORE,`insert into custody_assets (employee_id,name,end_date) values ('${E_MIDUL}','الكاب','2027-01-01') returning 1`)==='1'&&ps(`select count(*) from custody_assets where status='missing' and employee_id='${E_RAKIB}'`)==='1');
}finally{ps(`drop database if exists ${db} with (force)`,'postgres');}
