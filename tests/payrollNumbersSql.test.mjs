// PR-B على Postgres محلي: docs/sql/payroll_numbers.sql + docs/sql/payroll_net_washes.sql (مع أقسام SQL Editor المعلّقة).
// يعمل فقط مع PGTEST_PORT (مثلاً PGTEST_PORT=55432 npm test)؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='pn_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
const OP='b57f396c-2d39-4fa4-a568-143585f3db14';
// أقسام «يشغّله المالك» معلّقة بـ"-- " — نزيل التعليق لنختبرها كما ستُشغَّل
const uncomment=(sql,from,to)=>{const a=sql.indexOf(from),b=sql.indexOf(to,a+1);return sql.slice(a,b).split('\n').filter(l=>l.startsWith('-- ')&&!/^-- (═|يبقى|--)/.test(l)).map(l=>l.slice(3)).join('\n');};

ps(`create database ${db}`,'postgres');
try{
ps(`create table public.operators (id uuid primary key);
insert into operators values ('${OP}');
create table public.employees (id uuid primary key, full_name text, employee_id text, staff_role text, is_test boolean not null default false);
insert into employees values ('e5d45ef0-0f7c-4c87-8c33-6c9d44dfa2a2','Ariful Islam','1624',null,false),('47793dbb-f84f-495c-9458-1d8ac9a277aa','Midul Hassan','1648',null,false),
 ('6bc2d2be-3c7c-40d2-85fd-e7a0e290ec08','Mohamad Rakib','1700',null,false),('f3bb50ed-86f4-468f-a2d9-1eaf5369d859','Abed mia','2637651411',null,false),
 ('80d65b02-9428-4484-8b27-ffb0ad8a96a8','سلمان المالكي',null,'manager',false),('ba6e536b-a0e0-44bd-9ae6-6b0fe86bacd9','عمر المالكي',null,'manager',false),
 ('02076834-1702-47e8-a96a-df3c43e24289','بايكر تجريبي','TEST01','biker',true);
create table public.ops_biker_month (id uuid primary key default gen_random_uuid(), operator_id uuid, period text, employee_id uuid, sweater_id text, biker_name text,
  net_washes int, collect_payment int, cancel_client int, cancel_admin int, rating numeric(4,2), approved_complaints int, complaint_pct numeric, daily jsonb, updated_at timestamptz, unique(operator_id,period,sweater_id));
insert into ops_biker_month (operator_id,period,sweater_id,net_washes,collect_payment,cancel_client,rating,approved_complaints,complaint_pct) values
 ('${OP}','2026-06','1624',100,100,4,4.5,0,0),
 ('${OP}','2026-07','1624',46,46,2,4.55,0,0),('${OP}','2026-07','1648',187,187,3,4.48,4,2.14),('${OP}','2026-07','1700',196,196,5,4.50,1,0.51),
 ('${OP}','2026-08','1624',186,186,2,4.69,0,0),('${OP}','2026-08','1648',134,134,4,4.54,0,0),('${OP}','2026-08','1700',226,226,10,4.69,0,0),
 ('${OP}','2026-09','1624',223,223,3,4.77,0,0),('${OP}','2026-09','1648',77,77,6,4.65,0,0),('${OP}','2026-09','1700',221,221,11,4.61,0,0);
create table public.report_uploads (id uuid primary key default gen_random_uuid(), operator_id uuid, period text, kind text, filename text, rows int, uploaded_by uuid, uploaded_at timestamptz);
insert into report_uploads (operator_id,period,kind,filename,uploaded_at) values ('${OP}','2026-07','maintenance','old.csv','2026-10-01'),('${OP}','2026-07','maintenance','new.csv','2026-10-02'),('${OP}','2026-07','bookings','b.csv','2026-10-02');
create table public.ops_daily (day date primary key, period text, total_bookings int, washes int);
insert into ops_daily select d::date, to_char(d,'YYYY-MM'), 1, 1 from generate_series('2026-07-01'::date,'2026-07-10','1 day') d;`);

const N=fs.readFileSync(new URL('../docs/sql/payroll_numbers.sql',import.meta.url),'utf8');
ok('payroll_numbers: الأقسام عبر الأداة تمرّ',err(N)===null);
ok('إعادة التشغيل آمنة',err(N)===null);
ok('rating بلا تقريب (3.995 يبقى)',ps(`update ops_biker_month set rating=3.995 where period='2026-06'; select rating from ops_biker_month where period='2026-06'`).split('\n').pop()==='3.995');
ok('عمود tips وstart_date موجودان',ps(`select count(*) from information_schema.columns where (table_name,column_name) in (('ops_biker_month','tips'),('employees','start_date'))`)==='2');
ok('البايكرز الأربعة biker والتجريبي كما هو',ps(`select string_agg(employee_id,',' order by employee_id) from employees where staff_role='biker' and not is_test`)==='1624,1648,1700,2637651411');
ok('سلمان supervisor وعمر يبقى manager',ps(`select string_agg(full_name||':'||staff_role,',' order by full_name) from employees where employee_id is null`)==='سلمان المالكي:supervisor,عمر المالكي:manager');
ok('ops_daily: operator_id معبّأ لكل الصفوف',ps(`select count(*)=count(operator_id) from ops_daily`)==='t');
// أقسام SQL Editor
ps(uncomment(N,'═══ 4) report_uploads','═══ 5)'));
ok('report_uploads: يبقى الأحدث فقط (new.csv) ويمنع التكرار',ps(`select string_agg(filename,',' order by filename) from report_uploads`)==='b.csv,new.csv'
  &&(err(`insert into report_uploads (operator_id,period,kind) values ('${OP}','2026-07','bookings')`)||'').includes('duplicate'));
ok('upsert على (operator_id, period, kind) يعمل',err(`insert into report_uploads (operator_id,period,kind,filename) values ('${OP}','2026-07','bookings','b2.csv') on conflict (operator_id,period,kind) do update set filename=excluded.filename`)===null);
ps(uncomment(N,'5-ب المفتاح الأساسي','═══ التحقق'));
ok('ops_daily: مشغّل ثانٍ في اليوم نفسه مسموح',err(`insert into operators values ('00000000-0000-0000-0000-000000000002'); insert into ops_daily (day,period,operator_id) values ('2026-07-01','2026-07','00000000-0000-0000-0000-000000000002')`)===null);
ok('ops_daily: upsert على (operator_id, day)',err(`insert into ops_daily (day,period,operator_id,washes) values ('2026-07-01','2026-07','${OP}',9) on conflict (operator_id,day) do update set washes=excluded.washes`)===null
  &&ps(`select washes from ops_daily where day='2026-07-01' and operator_id='${OP}'`)==='9');

const W=fs.readFileSync(new URL('../docs/sql/payroll_net_washes.sql',import.meta.url),'utf8');
ok('payroll_net_washes: يمرّ',err(W)===null);
const nw=p=>ps(`select string_agg(net_washes::text,'/' order by sweater_id) from ops_biker_month where period='${p}'`);
ok('يوليو 48/190/201',nw('2026-07')==='48/190/201');
ok('أغسطس 188/138/236',nw('2026-08')==='188/138/236');
ok('سبتمبر 226/83/232',nw('2026-09')==='226/83/232');
ok('نسبة الشكاوى على الصافي الجديد: ميدول 4/190 = 2.11، راكب 1/201 = 0.50',ps(`select string_agg(complaint_pct::text,'/' order by sweater_id) from ops_biker_month where period='2026-07'`)==='0.00/2.11/0.50');
ok('يونيو لم يُمسّ',nw('2026-06')==='100');
ok('إعادة التشغيل لا تغيّر شيئاً',err(W)===null&&nw('2026-07')==='48/190/201');
ps(`update ops_biker_month set net_washes=1 where period='2026-08' and sweater_id='1624'; update ops_biker_month set net_washes=collect_payment where period='2026-08' and sweater_id in ('1648')`);
const e=err(W);
ok('عدد غير متوقع ⇒ تراجع كامل',e&&e.includes('تراجع')&&nw('2026-08')==='1/134/236');
}finally{ps(`drop database if exists ${db} with (force)`,'postgres');}
