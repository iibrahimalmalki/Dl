// تسجيل الدفع من الواجهة على Postgres محلي: record_payroll_payment (docs/sql/payroll_record_payment.sql) فوق payroll_guard ثم payroll_payments ثم ترحيل يونيو/يوليو.
// يعمل فقط مع PGTEST_PORT (مثلاً PGTEST_PORT=55432 npm test)؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='prp_test_'+process.pid;
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
const RP=F('payroll_record_payment.sql');ps(RP);ps(RP);
ok('الملف آمن لإعادة التشغيل',true);
ps(`update app_users set email='owner@dalu.sa' where id='${OWNER}'`);
const SUPJ='e42eae8f-1558-49e3-92dd-da4b5d0c6c0a',SUPL='8019df96-d5f8-43f7-b228-89c2c368981f',ARIF='58865df7-ed94-4387-807f-93afefdb8a02',MIDJ='4893a638-85cb-43a2-91db-22b7da2482c5',ABEDL='509373ab-955b-4430-ac3e-5a3c9111231f';
const call=(args)=>`select public.record_payroll_payment(${args})`;
const run=(uid,args)=>as(uid,call(args));
const rerr=(uid,args)=>asErr(uid,call(args))||'';
const L=id=>ps(`select payment_status||'|'||coalesce(paid_at::text,'-')||'|'||coalesce(paid_amount::text,'-')||'|'||coalesce(payment_ref,'-')||'|'||bank_fee||'|'||coalesce(pay_note,'-')||'|'||coalesce(base_paid::text,'-')||'|'||coalesce(base_paid_at::text,'-') from payroll_lines where id='${id}'`);
const audits=()=>+ps(`select count(*) from audit_log where table_name='payroll_lines' and action='PAYMENT'`);

// ── الصلاحية ──
ok('غير المالك (بايكر) ⇒ «تسجيل الدفع للمالك فقط»',rerr(MIDUL,`'${SUPJ}','paid','2026-10-05',533.52`).includes('للمالك فقط'));
ok('anon لا يملك تنفيذ الدالة',(err(`begin; set local role anon; ${call(`'${SUPJ}','paid','2026-10-05',533.52`)}; commit;`)||'').includes('permission denied'));
ok('التحديث المباشر من الواجهة ما زال مقفلاً حتى للمالك',(asErr(OWNER,`update payroll_lines set payment_status='paid' where id='${SUPJ}'`)||'').includes('مقفل'));
const D=ps(`insert into payroll_runs (operator_id,period,status) values ('${OP}','2026-08','draft') returning id`).split('\n').pop();
const DL=ps(`insert into payroll_lines (run_id,period,role,name,biker_id,base,net_bonus,total) values ('${D}','2026-08','biker','Midul Hassan','1648',1000,300,1300) returning id`).split('\n').pop();
ok('مسير مسودة ⇒ مرفوض («اعتمده أولاً»)',rerr(OWNER,`'${DL}','paid','2026-10-05',300`).includes('اعتمده أولاً'));
ok('حالة غير معروفة ⇒ مرفوضة',rerr(OWNER,`'${SUPJ}','final'`).includes('غير معروفة'));
ok('لا تغيير ولا تدقيق بعد المرفوضات',L(SUPJ).startsWith('deferred|-|-|-|0|')&&audits()===0);

// ── قواعد «مدفوع» ──
ok('بلا تاريخ ⇒ «تاريخ الدفع إلزامي»',rerr(OWNER,`'${SUPJ}','paid',null,533.52`).includes('تاريخ الدفع إلزامي'));
ok('تاريخ مستقبلي ⇒ خارج المدى',rerr(OWNER,`'${SUPJ}','paid',(now() at time zone 'Asia/Riyadh')::date+1,533.52`).includes('خارج المدى'));
ok('تاريخ قبل شهر المسير ⇒ خارج المدى',rerr(OWNER,`'${SUPJ}','paid','2026-05-31',533.52`).includes('خارج المدى'));
ok('بلا مبلغ ⇒ «المبلغ المدفوع إلزامي»',rerr(OWNER,`'${SUPJ}','paid','2026-10-05'`).includes('المبلغ المدفوع إلزامي'));
ok('أكثر من المكافأة ⇒ خارج المدى',rerr(OWNER,`'${SUPJ}','paid','2026-10-05',533.53`).includes('خارج المدى'));
ok('صفر والمكافأة موجبة ⇒ «سجّلها مؤجَّلة»',rerr(OWNER,`'${SUPJ}','paid','2026-10-05',0`).includes('مؤجَّلة'));
ok('دفع جزئي بلا ملاحظة ⇒ «اكتب السبب»',rerr(OWNER,`'${SUPJ}','paid','2026-10-05',500`).includes('دفع جزئي'));
ok('رسوم 60 ⇒ خارج المدى',rerr(OWNER,`'${SUPJ}','paid','2026-10-05',533.52,null,60`).includes('رسوم الحوالة'));
ok('مرجع حوالة ميدول على سطر سلمان ⇒ «مسجّل لـMidul Hassan»',rerr(OWNER,`'${SUPJ}','paid','2026-10-05',533.52,'9113102600103372'`).includes('مسجّل لـMidul Hassan'));

// ── تسجيل ناجح: مشرف يونيو 533.52 ⇒ يونيو «مدفوع» ──
const r1=JSON.parse(run(OWNER,`'${SUPJ}','paid','2026-10-05',533.52,' 9113102600109999 ',0.58,'عمولات المشرف P5'`));
ok('مشرف يونيو: مدفوع 2026-10-05 بالمرجع (مقصوص) والرسوم والملاحظة',L(SUPJ)==='paid|2026-10-05|533.52|9113102600109999|0.58|عمولات المشرف P5|-|-'&&r1.payment_status==='paid');
ok('يونيو: كل الأسطر مدفوعة ⇒ المسير «paid» (في الرد وفي القاعدة)',r1.run_status==='paid'&&ps(`select status from payroll_runs where id='${JUN}'`)==='paid');
const a1=JSON.parse(ps(`select json_build_object('a',actor,'e',actor_email,'o',old_data->>'payment_status','n',new_data->>'payment_status','amt',new_data->>'paid_amount','p',new_data->>'period') from audit_log where row_id='${SUPJ}' and action='PAYMENT'`));
ok('سطر تدقيق: الفاعل والبريد، والقديم deferred والجديد paid 533.52 ليونيو',a1.a===OWNER&&a1.e==='owner@dalu.sa'&&a1.o==='deferred'&&a1.n==='paid'&&+a1.amt===533.52&&a1.p==='2026-06');
ok('لا تغيير في المكافأة ولا الإجمالي',ps(`select net_bonus||'|'||total from payroll_lines where id='${SUPJ}'`)==='533.52|2033.52');
ok('المرجع نفسه لنفس الشخص في شهر آخر مقبول',!!run(OWNER,`'${SUPL}','paid','2026-10-06',623.38,'9113102600109999'`)&&L(SUPL).startsWith('paid|2026-10-06|623.38|9113102600109999'));
ok('يوليو صار «paid» بعد دفع سلمان',ps(`select status from payroll_runs where id='${JUL}'`)==='paid');

// ── المؤجَّل والتراجع ──
ok('تأجيل بلا سبب ⇒ مرفوض',rerr(OWNER,`'${SUPL}','deferred'`).includes('سبب التأجيل'));
run(OWNER,`'${SUPL}','deferred',null,null,null,null,'مؤجَّل مع عمولات المشرف (P5)'`);
ok('التأجيل يفرّغ حقول الدفع، ويوليو يعود «partially_paid»',L(SUPL)==='deferred|-|-|-|0|مؤجَّل مع عمولات المشرف (P5)|-|-'&&ps(`select status from payroll_runs where id='${JUL}'`)==='partially_paid');
ok('تراجع إلى «بانتظار» بلا سبب ⇒ مرفوض',rerr(OWNER,`'${ARIF}','pending'`).includes('سبب التراجع'));
run(OWNER,`'${ARIF}','pending',null,null,null,null,'إدخال خاطئ'`);
ok('التراجع يفرّغ الدفع ويُبقي السبب',L(ARIF)==='pending|-|-|-|0|إدخال خاطئ|-|-');

// ── الأساس ──
ok('تاريخ أساس مستقبلي ⇒ مرفوض',rerr(OWNER,`'${MIDJ}','paid','2026-10-04',800.13,null,null,null,true,(now() at time zone 'Asia/Riyadh')::date+3`).includes('تاريخ صرف الأساس'));
run(OWNER,`'${MIDJ}','paid','2026-10-04',800.13,null,null,null,true,'2026-07-01'`);
ok('الأساس مدفوع بتاريخه مع بقاء الدفع',L(MIDJ)==='paid|2026-10-04|800.13|-|0|-|true|2026-07-01');
run(OWNER,`'${MIDJ}','paid','2026-10-04',800.13`);
ok('p_base_paid فارغ ⇒ الأساس بلا تغيير',L(MIDJ).endsWith('|true|2026-07-01'));
run(OWNER,`'${MIDJ}','paid','2026-10-04',800.13,null,null,null,false`);
ok('الأساس false ⇒ يُفرَّغ تاريخه',L(MIDJ).endsWith('|false|-'));
ok('عابد: مكافأة صفر ⇒ دفع بصفر مقبول',!!run(OWNER,`'${ABEDL}','paid','2026-08-01',0,null,null,null,true`)&&L(ABEDL).startsWith('paid|2026-08-01|0.00|'));
ok('كل تسجيل ناجح له سطر تدقيق (8)',audits()===8);
// البايكر يرى نتيجة التسجيل عبر RLS
ok('ميدول يرى سطر يونيو مدفوعاً بأساسه',as(MIDUL,`select payment_status||':'||base_paid from payroll_lines where period='2026-06'`)==='paid:false');
}finally{ps(`drop database if exists ${db} with (force)`,'postgres');}
