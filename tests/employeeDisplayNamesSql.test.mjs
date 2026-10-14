// خانتا «الاسم بالعربي/بالبنغالي» في ملف الموظف على Postgres محلي (docs/sql/employee_display_names.sql)
// يعمل فقط مع PGTEST_PORT؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='edn_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
const F=fs.readFileSync(new URL('../docs/sql/employee_display_names.sql',import.meta.url),'utf8');
ps(`create database ${db}`,'postgres');
try{
ps(`create table public.employees (id uuid primary key, full_name text, employee_id text, staff_role text);
insert into employees values ('e5d45ef0-0f7c-4c87-8c33-6c9d44dfa2a2','Ariful Islam','1624','biker'),('47793dbb-f84f-495c-9458-1d8ac9a277aa','Midul Hassan','1648','biker'),
 ('6bc2d2be-3c7c-40d2-85fd-e7a0e290ec08','Mohamad Rakib','1700','biker'),('f3bb50ed-86f4-468f-a2d9-1eaf5369d859','Abed mia','2637651411','biker'),
 ('80d65b02-9428-4484-8b27-ffb0ad8a96a8','سلمان المالكي',null,'supervisor'),('02076834-1702-47e8-a96a-df3c43e24289','Test Biker','TEST01','biker');`);
ps(F);ps(F);
const N=()=>ps(`select string_agg(coalesce(employee_id,'S')||':'||coalesce(name_ar,'-')||'/'||coalesce(name_bn,'-'),',' order by full_name) from employees`);
ok('الملف آمن لإعادة التشغيل، والخمسة معبّأون والتجريبي فارغ',N()==='2637651411:عابد/আবেদ,1624:عريف/আরিফুল,1648:ميدول/মিদুল,1700:رقيب/রাকিব,TEST01:-/-,S:سلمان/সালমান');
ps(`update employees set name_ar='ميدول حسن' where employee_id='1648'; update employees set name_bn=null where employee_id='1624'`);ps(F);
ok('لا يكتب فوق اسم أُدخل من ملف الموظف، ويعبّئ الخانة الفارغة فقط',ps(`select name_ar from employees where employee_id='1648'`)==='ميدول حسن'&&ps(`select name_bn from employees where employee_id='1624'`)==='আরিফুল');
ps(`update employees set name_ar=null,name_bn=null; delete from employees where employee_id='1700'`);
ok('إن غاب أحد الخمسة ⇒ تراجع كامل بلا أي تعبئة',(err(F)||'').includes('وُجد 4 من 5')&&ps(`select count(*) from employees where name_ar is not null`)==='0');
}finally{ps(`drop database if exists ${db} with (force)`,'postgres');}
