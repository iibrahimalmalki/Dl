// دورة حياة الفاتورة على Postgres محلي: docs/sql/invoice_lifecycle.sql (الأعمدة + settlements_due_notify + تعبئة الأشهر السابقة).
// يعمل فقط مع PGTEST_PORT (مثلاً PGTEST_PORT=55432 npm test)؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='il_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
ps(`create database ${db}`,'postgres');
try{
ps(`do $$ begin create role anon; exception when others then null; end $$;
do $$ begin create role authenticated; exception when others then null; end $$;
create schema cron; create table cron.job (jobid serial primary key, jobname text, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns int language sql as $f$ insert into cron.job(jobname,schedule,command) values (n,s,c) returning jobid $f$;
create function cron.unschedule(j int) returns boolean language sql as $f$ delete from cron.job where jobid = j returning true $f$;
create table public.sweater_settlements (id uuid primary key default gen_random_uuid(), period text, status text, invoice_ref text, net_total numeric, paid boolean default false, paid_amount numeric, paid_at date, confirmed_at timestamptz, created_at timestamptz default now());
create table public.notif_log (audience text, cat text, sev text, title text, body text, module text, dedupe text);
create function public.push_notification(p_audience text, p_user uuid, p_category text, p_severity text, p_title text, p_body text, p_module text, p_entity text, p_dedupe text) returns void language sql security definer as $f$ insert into public.notif_log values (p_audience,p_category,p_severity,p_title,p_body,p_module,p_dedupe) $f$;
insert into sweater_settlements (period,status,net_total,paid,paid_amount,paid_at,confirmed_at) values
 ('2026-07','paid',8180,true,8262,'2026-09-22',null),
 ('2026-08','confirmed',10358.38,true,10558.38,'2026-09-28','2026-09-21 09:00+00'),
 ('2026-09','confirmed',10131.66,false,null,null,'2026-10-11 20:58+00');`);
const file=fs.readFileSync('docs/sql/invoice_lifecycle.sql','utf8');
const e1=err(file),e2=err(file);
ok('الملف يُطبَّق مرتين بلا خطأ'+(e1||e2?' — '+String(e1||e2).slice(0,200):''),!e1&&!e2);
if(e1||e2)process.exit(1);
ok('الأعمدة الأربعة موجودة',ps(`select count(*) from information_schema.columns where table_name='sweater_settlements' and column_name in ('submitted_at','accepted_at','tip_amount','due_date')`)==='4');
ok('مهمة cron واحدة settlement-due يومياً (لا تتكرر بإعادة التشغيل)',ps(`select count(*)||'|'||min(schedule) from cron.job where jobname='settlement-due'`)==='1|20 5 * * *');
ok('الدالة security definer وغير متاحة للمستخدمين',ps(`select prosecdef from pg_proc where proname='settlements_due_notify'`)==='t'&&ps(`select has_function_privilege('authenticated','public.settlements_due_notify()','execute')`)==='f');

// ── التعبئة (القسم 3 معلَّق في الملف؛ ننفّذ أسطره هنا كما ستُنفَّذ بموافقة المالك) ──
const fill=file.split('\n').filter(l=>/^-- (update|begin;|commit;|  where|  due_date)/.test(l)).map(l=>l.replace(/^-- /,'')).join('\n');
ps(fill);
ok('البقشيش الفعلي للأشهر المدفوعة = المستلَم − الصافي (يوليو 82، أغسطس 200)',ps(`select string_agg(period||':'||tip_amount, ',' order by period) from sweater_settlements where paid`)==='2026-07:82.00,2026-08:200.00');
ok('يوليو وأغسطس: رُفعتا 19/09 وقُبلتا 21/09',ps(`select count(*) from sweater_settlements where period in ('2026-07','2026-08') and (submitted_at at time zone 'Asia/Riyadh')::date='2026-09-19' and (accepted_at at time zone 'Asia/Riyadh')::date='2026-09-21'`)==='2');
ok('سبتمبر: accepted، بقشيش 293، الموعد = القبول + 14 (2026-10-25 بتوقيت الرياض)',ps(`select status||'|'||tip_amount||'|'||due_date||'|'||(accepted_at=confirmed_at) from sweater_settlements where period='2026-09'`)==='accepted|293|2026-10-25|true');

// ── التنبيهات ──
ok('قبل الموعد: لا تنبيه لسبتمبر',ps(`select settlements_due_notify()`)==='0'&&ps(`select count(*) from notif_log`)==='0');
ps(`update sweater_settlements set due_date='2020-01-01' where period='2026-09'`);
ok('بعد الموعد: تنبيه حرج للمالك بالمستحق 10,424.66 يفتح صفحة التسوية',ps(`select settlements_due_notify()`)==='1'&&ps(`select audience||'|'||cat||'|'||sev||'|'||module||'|'||(body like '%10,424.66%') from notif_log`)==='owner|settlement|crit|settlement|true');
ok('التكرار: نفس اليوم ⇒ نفس مفتاح dedupe (المشغّل الحقيقي يمنع التكرار)',ps(`select settlements_due_notify()`)==='1'&&ps(`select count(distinct dedupe) from notif_log`)==='1');
ps(`delete from notif_log; update sweater_settlements set paid=true where period='2026-09'`);
ok('مدفوعة ⇒ لا تنبيه حتى لو تجاوزت الموعد',ps(`select settlements_due_notify()`)==='0');
ps(`insert into sweater_settlements (period,status,net_total,submitted_at) values ('2026-10','submitted',9000,now()-interval '8 days')`);
ok('مُرسلة منذ 8 أيام بلا قبول ⇒ تحذير',ps(`select settlements_due_notify()`)==='1'&&ps(`select sev||'|'||(title like '%8 يوماً%') from notif_log`)==='warn|true');
ps(`delete from notif_log; update sweater_settlements set submitted_at=now()-interval '2 days' where period='2026-10'`);
ok('مُرسلة منذ يومين ⇒ لا تحذير',ps(`select settlements_due_notify()`)==='0');
ps(`insert into sweater_settlements (period,status,net_total,confirmed_at) values ('2026-06','confirmed',9000,now())`);
ok('معتمدة داخلياً لشهر قديم لم تُرفع ⇒ تذكير بالرفع',ps(`select settlements_due_notify()`)==='1'&&ps(`select title from notif_log`).includes('لم تُرفع'));
}finally{ps(`drop database if exists ${db}`,'postgres');}
