// خانة «الاسم بالإنجليزي» في ملف الموظف على Postgres محلي (docs/sql/employee_name_en.sql)
// يعمل فقط مع PGTEST_PORT؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='ene_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
const F=fs.readFileSync(new URL('../docs/sql/employee_name_en.sql',import.meta.url),'utf8');
ps(`create database ${db}`,'postgres');
try{
ok('الملف بلا drop ولا delete خارج التعليقات (أداة MCP)',!/\bdrop\b|\bdelete\b/i.test(F.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n')));
ps(`create table public.employees (id uuid primary key, full_name text, employee_id text, name_ar text, name_bn text);
insert into employees (id,full_name,employee_id) values ('e5d45ef0-0f7c-4c87-8c33-6c9d44dfa2a2','Ariful Islam','1624'),('47793dbb-f84f-495c-9458-1d8ac9a277aa','Midul Hassan','1648'),
 ('6bc2d2be-3c7c-40d2-85fd-e7a0e290ec08','Mohamad Rakib','1700'),('f3bb50ed-86f4-468f-a2d9-1eaf5369d859','Abed mia','2637651411'),
 ('80d65b02-9428-4484-8b27-ffb0ad8a96a8','سلمان المالكي',null),('02076834-1702-47e8-a96a-df3c43e24289','Test Biker','TEST01');`);
ps(F);ps(F);
const N=()=>ps(`select string_agg(coalesce(employee_id,'S')||':'||coalesce(name_en,'-'),',' order by coalesce(employee_id,'S')) from employees`);
ok('آمن لإعادة التشغيل: الخمسة معبّأون (Rakib لا Mohamad)، والتجريبي فارغ، والاسم المسجّل كما هو',N()==='1624:Ariful,1648:Midul,1700:Rakib,2637651411:Abed,S:Salman,TEST01:-'&&ps(`select full_name from employees where employee_id='1700'`)==='Mohamad Rakib');
ps(`update employees set name_en='Midul H.' where employee_id='1648'; update employees set name_en=' ' where employee_id='1624'`);ps(F);
ok('لا يكتب فوق اسم أُدخل من ملف الموظف، ويعبّئ الفارغ فقط',ps(`select name_en from employees where employee_id='1648'`)==='Midul H.'&&ps(`select name_en from employees where employee_id='1624'`)==='Ariful');
ps(`update employees set name_en=null; delete from employees where employee_id='1700'`);
ok('إن غاب أحد الخمسة ⇒ تراجع كامل بلا أي تعبئة',(err(F)||'').includes('وُجد 4 من 5')&&ps(`select count(*) from employees where name_en is not null`)==='0');
}finally{ps(`drop database if exists ${db} with (force)`,'postgres');}
