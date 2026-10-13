// قفل المسير والاعتماد للمالك على Postgres محلي: docs/sql/payroll_guard.sql.
// يعمل فقط مع PGTEST_PORT (مثلاً PGTEST_PORT=55432 npm test)؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='pg_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
const as=(uid,sql)=>ps(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`).split('\n').slice(1).join('\n');
const asErr=(uid,sql)=>err(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`);

const OWNER='00000000-0000-0000-0000-00000000000a',CLERK='00000000-0000-0000-0000-00000000000c',MIDUL='00000000-0000-0000-0000-000000001648';
const OP='b57f396c-2d39-4fa4-a568-143585f3db14',JUN='ee06d014-ed5a-4e82-8513-fc041188a116',JUL='5d91c7f8-f011-48b9-8860-abc5cf9f3d89',AUG='a0000000-0000-0000-0000-000000000008';

ps(`create database ${db}`,'postgres');
try{
ps(`do $$ begin create role anon; exception when others then null; end $$;
do $$ begin create role authenticated; exception when others then null; end $$;
create schema auth; create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('test.uid',true),'')::uuid $f$;
grant usage on schema auth to authenticated, anon;
create table public.app_users (id uuid primary key, is_owner boolean not null default false, biker_employee_id text, active boolean not null default true);
create table public.user_permissions (user_id uuid, module text, can_view boolean, can_edit boolean);
create function public.is_owner() returns boolean language sql stable security definer set search_path to 'public' as $f$ select exists(select 1 from public.app_users where id = auth.uid() and is_owner and active) $f$;
create function public.has_perm(p_module text, p_need_edit boolean default false) returns boolean language sql stable security definer set search_path to 'public' as $f$
  select public.is_owner() or exists(select 1 from public.user_permissions up join public.app_users au on au.id = up.user_id where up.user_id = auth.uid() and au.active and up.module = p_module and (up.can_view or up.can_edit) and (not p_need_edit or up.can_edit)) $f$;
create function public.my_biker_id() returns text language sql stable security definer set search_path to 'public' as $f$ select btrim(biker_employee_id) from public.app_users where id = auth.uid() and active and coalesce(biker_employee_id,'') <> '' $f$;
create table public.payroll_runs (id uuid primary key default gen_random_uuid(), operator_id uuid, period text not null, status text not null default 'draft', notes text, created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now(), unique(operator_id, period));
create table public.payroll_lines (id uuid primary key default gen_random_uuid(), run_id uuid references public.payroll_runs(id) on delete cascade, operator_id uuid, employee_id uuid, role text, name text, biker_id text, level text, inputs jsonb, computed jsonb, base numeric, net_bonus numeric, total numeric, sort int, created_at timestamptz default now(), period text);
alter table public.payroll_runs enable row level security; alter table public.payroll_lines enable row level security;
create policy payroll_runs_auth_select on public.payroll_runs for select using (has_perm('payroll'));
create policy payroll_runs_auth_write on public.payroll_runs for all using (has_perm('payroll', true)) with check (has_perm('payroll', true));
create policy payroll_lines_auth_select on public.payroll_lines for select using (has_perm('payroll'));
create policy payroll_lines_auth_write on public.payroll_lines for all using (has_perm('payroll', true)) with check (has_perm('payroll', true));
create policy payroll_lines_self on public.payroll_lines for select using ((my_biker_id() is not null) and (role = 'biker') and (btrim(coalesce(biker_id, '')) = my_biker_id()));
grant select, insert, update, delete on all tables in schema public to authenticated;
insert into app_users values ('${OWNER}',true,null,true),('${CLERK}',false,null,true),('${MIDUL}',false,'1648',true);
insert into user_permissions values ('${CLERK}','payroll',true,true);
insert into payroll_runs (id,operator_id,period,status) values ('${JUN}','${OP}','2026-06','final'),('${JUL}','${OP}','2026-07','approved'),('${AUG}','${OP}','2026-08','draft');
insert into payroll_lines (run_id,period,role,name,biker_id,net_bonus) values ('${JUL}','2026-07','biker','Midul Hassan','1648',514.25),('${AUG}','2026-08','biker','Midul Hassan','1648',300);`);

// قبل الملف: الثغرات قائمة
ok('قبل الملف: غير المالك يعتمد المسير',asErr(CLERK,`update payroll_runs set status='approved' where id='${AUG}'`)===null);
ps(`update payroll_runs set status='draft' where id='${AUG}'`);
ok('قبل الملف: البايكر يقرأ سطر المسودة',as(MIDUL,`select count(*) from payroll_lines`)==='2');

const SQL=fs.readFileSync(new URL('../docs/sql/payroll_guard.sql',import.meta.url),'utf8');
ps(SQL);ps(SQL); // إعادة التشغيل آمنة
ok('الملف آمن لإعادة التشغيل (طُبِّق مرتين)',true);
ok('العمودان approved_by/approved_at موجودان',ps(`select count(*) from information_schema.columns where table_name='payroll_runs' and column_name in ('approved_by','approved_at')`)==='2');
ok('لم تتغيّر البيانات: الحالات كما هي',ps(`select string_agg(status,',' order by period) from payroll_runs`)==='final,approved,draft');

// الاعتماد
let e=asErr(CLERK,`update payroll_runs set status='approved' where id='${AUG}'`);
ok('غير المالك لا يعتمد',e&&e.includes('للمالك فقط'));
e=asErr(CLERK,`insert into payroll_runs (operator_id,period,status) values ('${OP}','2026-09','approved')`);
ok('غير المالك لا يُدرج مسيراً معتمداً',e&&e.includes('للمالك فقط'));
ok('غير المالك يحفظ المسودة',asErr(CLERK,`update payroll_runs set notes='x', approved_by='${CLERK}' where id='${AUG}'`)===null);
ok('المسودة لا تحمل approved_by من الواجهة',ps(`select approved_by is null from payroll_runs where id='${AUG}'`)==='t');
ok('غير المالك يعدّل أسطر المسودة',asErr(CLERK,`delete from payroll_lines where run_id='${AUG}'; insert into payroll_lines (run_id,period,role,name,biker_id,net_bonus) values ('${AUG}','2026-08','biker','Midul Hassan','1648',310)`)===null);
ok('البايكر لا يرى سطر المسودة',as(MIDUL,`select count(*) from payroll_lines where run_id='${AUG}'`)==='0');
ok('المالك يعتمد',asErr(OWNER,`update payroll_runs set status='approved' where id='${AUG}'`)===null);
ok('approved_by = المالك وapproved_at مملوء',ps(`select approved_by='${OWNER}' and approved_at is not null from payroll_runs where id='${AUG}'`)==='t');
ok('البايكر يرى سطره بعد الاعتماد',as(MIDUL,`select count(*) from payroll_lines where run_id='${AUG}'`)==='1');

// القفل
e=asErr(CLERK,`update payroll_runs set notes='y' where id='${JUL}'`);
ok('يوليو المعتمد: لا تعديل للمسير (محرّر)',e&&e.includes('مقفل'));
e=asErr(OWNER,`update payroll_runs set status='draft' where id='${JUL}'`);
ok('يوليو المعتمد: حتى المالك لا يعيده مسودة من الواجهة',e&&e.includes('مقفل'));
e=asErr(OWNER,`update payroll_runs set notes='y' where id='${JUN}'`);
ok('يونيو final مقفل أيضاً',e&&e.includes('مقفل'));
e=asErr(CLERK,`delete from payroll_lines where run_id='${JUL}'`);
ok('لا حذف لأسطر مسير معتمد',e&&e.includes('مقفل'));
e=asErr(OWNER,`update payroll_lines set net_bonus=0 where run_id='${JUL}'`);
ok('لا تعديل لأسطر مسير معتمد (حتى المالك)',e&&e.includes('مقفل'));
e=asErr(CLERK,`insert into payroll_lines (run_id,period,role,name) values ('${JUL}','2026-07','biker','x')`);
ok('لا إدراج سطر في مسير معتمد',e&&e.includes('مقفل'));
e=asErr(OWNER,`delete from payroll_runs where id='${JUL}'`);
ok('لا حذف لمسير معتمد',e&&e.includes('مقفل'));
ok('سطر يوليو لم يتغيّر',ps(`select net_bonus from payroll_lines where run_id='${JUL}'`)==='514.25');

// SQL Editor (postgres) يتجاوز — للترحيل ودوال الدفع
ok('SQL Editor يعدّل مسيراً معتمداً (ترحيل)',err(`update payroll_lines set net_bonus=565.40 where run_id='${JUL}'`)===null);
ok('مسودة جديدة ثم حذفها مسموح',asErr(CLERK,`insert into payroll_runs (operator_id,period) values ('${OP}','2026-10'); delete from payroll_runs where period='2026-10'`)===null);
}finally{ps(`drop database if exists ${db} with (force)`,'postgres');}
