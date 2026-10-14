// حالة المسير مع الدفع الجزئي على Postgres محلي: docs/sql/payroll_run_partial.sql فوق payroll_guard ← payroll_payments ← ترحيل يونيو/يوليو ← record_payroll_payment.
// يعمل فقط مع PGTEST_PORT (مثلاً PGTEST_PORT=55432 npm test)؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='prpart_test_'+process.pid;
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
create table public.app_users (id uuid primary key, is_owner boolean not null default false, biker_employee_id text, active boolean not null default true, email text);
create table public.audit_log (id uuid primary key default gen_random_uuid(), table_name text, row_id uuid, action text, actor uuid, actor_email text, changed_at timestamptz default now(), old_data jsonb, new_data jsonb);
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
ps(F('payroll_migrate_2026_06_07.sql'));
// كما في الإنتاج: سطر مشرف يونيو مربوط بسجل سلمان (يوليو يربطه الترحيل)
ps(`update payroll_lines set employee_id='80d65b02-9428-4484-8b27-ffb0ad8a96a8' where id='e42eae8f-1558-49e3-92dd-da4b5d0c6c0a'`);
ps(F('payroll_record_payment.sql'));
const st=id=>ps(`select status from payroll_runs where id='${id}'`);
ok('قبل الملف: يونيو ويوليو partially_paid',st(JUN)==='partially_paid'&&st(JUL)==='partially_paid');
const P=F('payroll_run_partial.sql');ps(P);ps(P);
ok('الملف آمن لإعادة التشغيل، والحالات كما هي (لا دفع جزئي في البيانات)',st(JUN)==='partially_paid'&&st(JUL)==='partially_paid');
ok('المشغّل يشمل paid_amount وnet_bonus',/UPDATE OF payment_status, paid_amount, net_bonus/.test(ps(`select pg_get_triggerdef(oid) from pg_trigger where tgname='trg_payroll_run_sync_status'`)));
ps(`update app_users set email='owner@dalu.sa' where id='${OWNER}'`);
const SUPJ='e42eae8f-1558-49e3-92dd-da4b5d0c6c0a';
const run=args=>JSON.parse(as(OWNER,`select public.record_payroll_payment(${args})`));
// يونيو: آخر سطر غير مدفوع (المشرف 533.52) يُدفع جزئياً ⇒ المسير يبقى مدفوعاً جزئياً
const r1=run(`'${SUPJ}','paid','2026-10-05',500,null,null,'دفعة أولى'`);
ok('كل الأسطر «مدفوعة» لكن سطر المشرف 500 من 533.52 ⇒ يونيو يبقى partially_paid (في الرد وفي القاعدة)',r1.run_status==='partially_paid'&&st(JUN)==='partially_paid');
// صرف الباقي: الحالة تبقى paid والمبلغ وحده يتغيّر ⇒ يجب أن يُعاد الحساب
const r2=run(`'${SUPJ}','paid',null,533.52,null,null,'اكتمل الدفع'`);
ok('صرف الباقي (المبلغ وحده تغيّر) ⇒ يونيو paid',r2.run_status==='paid'&&st(JUN)==='paid');
// العكس: تخفيض المبلغ (تصحيح) يعيده جزئياً
run(`'${SUPJ}','paid',null,400,null,null,'تصحيح المبلغ'`);
ok('تخفيض المبلغ المسجّل ⇒ يونيو يعود partially_paid',st(JUN)==='partially_paid');
// يوليو: عابد مكافأته 0 ومدفوع 0 ⇒ يُعدّ مدفوعاً بالكامل؛ ودفع سلمان كاملاً ⇒ يوليو paid
run(`'8019df96-d5f8-43f7-b228-89c2c368981f','paid','2026-10-06',623.38,null,null,''`);
ok('يوليو: الأسطر كلها مدفوعة بالكامل (عابد 0 من 0) ⇒ paid',st(JUL)==='paid');
ok('مكافأة سالبة تُعامل كصفر (المدفوع 0 يكفي)',ps(`select count(*) from payroll_lines where payment_status='paid' and coalesce(paid_amount,0) >= round(greatest(coalesce(net_bonus,0),0),2) and run_id='${JUL}'`)==='5');
}finally{ps(`drop database if exists ${db} with (force)`,'postgres');}
