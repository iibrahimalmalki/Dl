// أعمدة تقرير الشكاوى على Postgres محلي: docs/sql/ops_tickets_bn.sql. يعمل فقط مع PGTEST_PORT.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='otb_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
ps(`create database ${db}`,'postgres');
try{
ps(`create table public.ops_tickets (id uuid primary key default gen_random_uuid(), period text, sweater_id text, description text, decision text, qc_notes text);
insert into ops_tickets (period,sweater_id,description,decision) values ('2026-07','1648','x','approved');`);
const file=fs.readFileSync('docs/sql/ops_tickets_bn.sql','utf8');
const exec=file.slice(file.indexOf('-- ═══ 1)'),file.indexOf('-- ═══ تحقق'));
ok('التنفيذ بلا كلمة drop أو delete',!/drop|delete/i.test(exec));
const e1=err(exec),e2=err(exec);
ok('يُطبَّق مرتين بلا خطأ',!e1&&!e2);
ok('الأعمدة الثلاثة نصية اختيارية',ps(`select string_agg(column_name||':'||data_type||':'||is_nullable, ',' order by column_name) from information_schema.columns where table_name='ops_tickets' and column_name in ('desc_bn','reason_ar','reason_bn')`)==='desc_bn:text:YES,reason_ar:text:YES,reason_bn:text:YES');
ok('الصفوف القائمة بلا تغيير',ps(`select count(*)||'|'||count(desc_bn)||'|'||description from ops_tickets group by description`)==='1|0|x');
}finally{ps(`drop database if exists ${db}`,'postgres');}
