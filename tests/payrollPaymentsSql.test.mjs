// الدفع وترحيل يونيو/يوليو على Postgres محلي: payroll_guard.sql ثم payroll_payments.sql ثم payroll_migrate_2026_06_07.sql.
// يعمل فقط مع PGTEST_PORT (مثلاً PGTEST_PORT=55432 npm test)؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='pp_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
const as=(uid,sql)=>ps(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`).split('\n').slice(1).join('\n');
const asErr=(uid,sql)=>err(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); ${sql}; commit;`);
const F=n=>fs.readFileSync(new URL('../docs/sql/'+n,import.meta.url),'utf8');

const OWNER='00000000-0000-0000-0000-00000000000a',MIDUL='00000000-0000-0000-0000-000000001648',ABED='00000000-0000-0000-0000-000000000ab0';
const OP='b57f396c-2d39-4fa4-a568-143585f3db14',JUN='ee06d014-ed5a-4e82-8513-fc041188a116',JUL='5d91c7f8-f011-48b9-8860-abc5cf9f3d89';

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
insert into app_users values ('${OWNER}',true,null,true),('${MIDUL}',false,'1648',true),('${ABED}',false,'2637651411',true);
insert into payroll_runs (id,operator_id,period,status,notes) values ('${JUN}','${OP}','2026-06','final','يونيو 2026 — HR-POL-003 v1.1.'),('${JUL}','${OP}','2026-07','approved',null);
insert into payroll_lines (id,run_id,period,role,name,biker_id,base,net_bonus,total,sort) values
 ('4f93bfea-8617-4d6b-a787-cc8e93c98525','${JUN}','2026-06','biker','Ariful Islam','1624',1000,360.75,1360.75,0),
 ('4893a638-85cb-43a2-91db-22b7da2482c5','${JUN}','2026-06','biker','Midul Hassan','1648',1000,800.13,1800.13,1),
 ('0ab62aee-abe8-4d47-9fc8-61bc57179368','${JUN}','2026-06','biker','Mohamad Rakib','1700',1000,502.00,1502.00,2),
 ('e42eae8f-1558-49e3-92dd-da4b5d0c6c0a','${JUN}','2026-06','supervisor','سلمان المالكي',null,1500,533.52,2033.52,99),
 ('58865df7-ed94-4387-807f-93afefdb8a02','${JUL}','2026-07','biker','Ariful Islam','1624',1000,172.50,1172.50,0),
 ('700d065f-231f-4018-9141-9e2af9e9e2f6','${JUL}','2026-07','biker','Midul Hassan','1648',1000,514.25,1514.25,1),
 ('05cf92bd-3050-4732-b329-80816d0c289a','${JUL}','2026-07','biker','Mohamad Rakib','1700',1000,735.00,1735.00,2),
 ('509373ab-955b-4430-ac3e-5a3c9111231f','${JUL}','2026-07','biker','Abed mia','2637651411',1000,0,1000,3),
 ('8019df96-d5f8-43f7-b228-89c2c368981f','${JUL}','2026-07','supervisor','سلمان المالكي',null,1500,609.18,2109.18,99);`);
ps(F('payroll_guard.sql'));

ps(F('payroll_payments.sql'));ps(F('payroll_payments.sql'));
ok('payroll_payments: آمن لإعادة التشغيل',true);
ok('يونيو final ⇒ approved',ps(`select status from payroll_runs where id='${JUN}'`)==='approved');
ok('قيد الحالات يرفض final',(err(`update payroll_runs set status='final' where id='${JUN}'`)||'').includes('payroll_runs_status_ck'));
ok('الأسطر كلها pending',ps(`select count(*) from payroll_lines where payment_status<>'pending'`)==='0');

const M=F('payroll_migrate_2026_06_07.sql');
ps(M);
const L=id=>ps(`select net_bonus||'|'||total||'|'||payment_status||'|'||coalesce(paid_at::text,'-')||'|'||coalesce(paid_amount::text,'-')||'|'||coalesce(payment_ref,'-')||'|'||bank_fee||'|'||coalesce(base_paid::text,'-') from payroll_lines where id='${id}'`);
ok('يوليو عارف 180.00 مدفوع بالمرجع والرسوم',L('58865df7-ed94-4387-807f-93afefdb8a02')==='180|1180|paid|2026-10-13|180.00|9113102600102912|0.58|-');
ok('يوليو ميدول 565.40',L('700d065f-231f-4018-9141-9e2af9e9e2f6').startsWith('565.4|1565.4|paid|2026-10-13|565.40|9113102600103372|0.58'));
ok('يوليو راكب 817.75',L('05cf92bd-3050-4732-b329-80816d0c289a').startsWith('817.75|1817.75|paid|2026-10-13|817.75|9113102600103684|0.58'));
ok('يوليو عابد: لا مكافأة، الأساس مدفوع',L('509373ab-955b-4430-ac3e-5a3c9111231f')==='0|1000|paid|-|0|-|0|true');
ok('يوليو سلمان 623.38 مؤجَّل ومربوط بسجله',L('8019df96-d5f8-43f7-b228-89c2c368981f').startsWith('623.38|2123.38|deferred|-|-|-|0')&&ps(`select employee_id from payroll_lines where id='8019df96-d5f8-43f7-b228-89c2c368981f'`)==='80d65b02-9428-4484-8b27-ffb0ad8a96a8');
ok('يوليو: الحسابات المخزّنة من المحرك (ميدول 190 غسلة، إكراميات 42.9)',ps(`select (computed->>'net_washes')||'|'||(computed->>'tips')||'|'||(inputs->>'tips') from payroll_lines where id='700d065f-231f-4018-9141-9e2af9e9e2f6'`)==='190|42.9|42.9');
ok('يوليو: المسير partially_paid (سلمان مؤجَّل)',ps(`select status from payroll_runs where id='${JUL}'`)==='partially_paid');
ok('يوليو: الملاحظة بنص المالك',ps(`select notes from payroll_runs where id='${JUL}'`).includes('إنتاج راكب (25)'));
ok('يوليو: المدفوع 1,563.15 والرسوم 1.74',ps(`select sum(paid_amount)||'|'||sum(bank_fee) from payroll_lines where run_id='${JUL}'`)==='1563.15|1.74');
ok('يونيو: البايكرز مدفوعون 2026-10-04 (1,662.88) والمشرف pending',ps(`select string_agg(payment_status||':'||coalesce(paid_at::text,'-'),',' order by sort) from payroll_lines where run_id='${JUN}'`)==='paid:2026-10-04,paid:2026-10-04,paid:2026-10-04,pending:-'
  &&ps(`select sum(paid_amount) from payroll_lines where run_id='${JUN}'`)==='1662.88');
ok('يونيو: partially_paid والملاحظة',ps(`select status from payroll_runs where id='${JUN}'`)==='partially_paid'&&ps(`select notes from payroll_runs where id='${JUN}'`).includes('1,662.88'));
ps(M);
ok('الترحيل آمن لإعادة التشغيل (لا تغيير)',L('58865df7-ed94-4387-807f-93afefdb8a02')==='180|1180|paid|2026-10-13|180.00|9113102600102912|0.58|-'&&ps(`select count(*) from payroll_runs where notes like '%1,662.88%1,662.88%'`)==='0');

// البوابة: البايكر يرى سطره المعتمد بالأرقام الجديدة
ok('ميدول يرى سطري يونيو ويوليو فقط (565.40 في يوليو)',as(MIDUL,`select string_agg(period||':'||net_bonus||':'||payment_status,',' order by period) from payroll_lines`)==='2026-06:800.13:paid,2026-07:565.4:paid');
ok('عابد يرى سطر يوليو (الأساس مدفوع)',as(ABED,`select period||':'||base_paid from payroll_lines`)==='2026-07:true');
// الواجهة لا تعدّل الدفع (الحارس)
ok('الواجهة لا تغيّر حالة دفع سطر مقفل حتى للمالك',(asErr(OWNER,`update payroll_lines set payment_status='pending' where id='58865df7-ed94-4387-807f-93afefdb8a02'`)||'').includes('مقفل'));
// اشتقاق الحالة: دفع سلمان ⇒ paid
ps(`update payroll_lines set payment_status='paid', paid_amount=623.38, paid_at='2026-10-20' where id='8019df96-d5f8-43f7-b228-89c2c368981f'`);
ok('دفع المؤجَّل ⇒ المسير paid',ps(`select status from payroll_runs where id='${JUL}'`)==='paid');
ps(`update payroll_lines set payment_status='pending' where run_id='${JUL}'`);
ok('كل الأسطر pending ⇒ approved',ps(`select status from payroll_runs where id='${JUL}'`)==='approved');
}finally{ps(`drop database if exists ${db} with (force)`,'postgres');}
