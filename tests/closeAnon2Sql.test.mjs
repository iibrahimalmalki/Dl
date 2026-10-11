// إغلاق الوصول المجهول — المرحلة 2 (docs/sql/close_anon_2.sql) على Postgres محلي: الزائر لا يقرأ ولا يعدّل المتقدمين/المقابلات/TMA،
// والدوال المحدودة تُرجع الحد الأدنى فقط. يعمل فقط مع PGTEST_PORT (مثلاً PGTEST_PORT=55432 npm test)؛ بدونه يُتخطّى بلا فشل.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='ca2_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
// بصفة الزائر (anon) — آخر سطر هو نتيجة الاستعلام
const anon=sql=>ps(`begin; set local role anon; ${sql}; commit;`).split('\n').pop();
const anonErr=sql=>err(`begin; set local role anon; ${sql}; commit;`);
const S1='50000000-0000-0000-0000-000000000001',S2='50000000-0000-0000-0000-000000000002',A1='60000000-0000-0000-0000-000000000001',A2='60000000-0000-0000-0000-000000000002';

ps(`create database ${db}`,'postgres');
try{
// الوضع كما في الإنتاج قبل الملف: anon يملك select/insert/update بسياسات true
ps(`do $$ begin create role anon; exception when others then null; end $$;
do $$ begin create role authenticated; exception when others then null; end $$;
create schema auth; create function auth.uid() returns uuid language sql stable as $f$ select null::uuid $f$;
create sequence applicant_number_seq start 101;
create table public.applicants (id uuid primary key default gen_random_uuid(), full_name text not null, whatsapp text not null, location text not null, age int not null, height_cm int not null, weight_kg int not null, passport_or_iqama text not null, has_license boolean not null default false,
  license_image_url text, personal_photo_url text, driving_video_url text, iqama_image_url text, passport_image_url text, car_wash_description text,
  q1_client_refusal text, q2_equipment_damage text, q3_left_previous_job text, q4_salary_deduction text, q5_one_year_goal text, q6_difficult_colleague text,
  ai_score_total numeric, ai_score_technical numeric, ai_score_behavioral numeric, ai_classification text, ai_notes text, ai_evaluation_json jsonb, status text default 'pending', admin_notes text,
  submitted_at timestamptz default now(), updated_at timestamptz default now(), marital_status text, children_count int default 0, score_physical numeric, score_responsibility numeric,
  application_number int default nextval('applicant_number_seq'), interview_answers jsonb, interview_completed_at timestamptz, bangladesh_district text, bangladesh_city text, saudi_city text, ready_for_riyadh text,
  geo_score numeric, map_link text, status_history jsonb default '[]', referred_by text, operator_id uuid);
create table public.interview_sessions (id uuid primary key default gen_random_uuid(), applicant_id uuid, questions jsonb, answers jsonb, status text default 'pending', scheduled_at timestamptz, completed_at timestamptz, created_at timestamptz default now(), rating numeric, decision text, note text, reviewed_at timestamptz);
create table public.tma_invites (id uuid primary key default gen_random_uuid(), operator_id uuid, subject_name text, subject_role text, interview_id uuid, applicant_id uuid, answers jsonb default '{}', scores jsonb default '{}', status text default 'pending', created_at timestamptz default now(), completed_at timestamptz, imported_assessment_id uuid);
create table public.audit_log (table_name text, row_id uuid, action text, actor uuid, actor_email text, old_data jsonb, new_data jsonb);
create function public.audit_capture() returns trigger language plpgsql security definer set search_path to 'public' as $f$
declare aid uuid; rid uuid; begin begin aid := auth.uid(); exception when others then aid := null; end;
  if TG_OP='DELETE' then rid := (to_jsonb(OLD)->>'id')::uuid; else rid := (to_jsonb(NEW)->>'id')::uuid; end if;
  insert into public.audit_log(table_name,row_id,action,actor,old_data,new_data) values(TG_TABLE_NAME, rid, TG_OP, aid, case when TG_OP<>'INSERT' then to_jsonb(OLD) end, case when TG_OP<>'DELETE' then to_jsonb(NEW) end);
  return case when TG_OP='DELETE' then OLD else NEW end; end $f$;
create trigger trg_applicants_audit after insert or update or delete on applicants for each row execute function audit_capture();
alter table applicants enable row level security; alter table interview_sessions enable row level security; alter table tma_invites enable row level security;
grant usage on schema public to anon, authenticated;
grant select, insert, update on applicants to anon; grant select, update on interview_sessions to anon; grant select, update on tma_invites to anon;
create policy anon_select on applicants for select to anon using (true); create policy anon_insert on applicants for insert to anon with check (true); create policy anon_update on applicants for update to anon using (true) with check (true);
create policy iv_anon_select on interview_sessions for select to anon using (true); create policy iv_anon_update on interview_sessions for update to anon using (true) with check (true);
create policy tma_inv_anon_read on tma_invites for select to anon using (true); create policy tma_inv_anon_answer on tma_invites for update to anon using (status <> 'completed') with check (true);
insert into applicants (id, full_name, whatsapp, location, age, height_cm, weight_kg, passport_or_iqama, admin_notes, ai_notes, status) values ('${A1}','Rahim','+8801','Riyadh',22,170,65,'2222222222','ملاحظة إدارية سرية','تقييم','pending'),('${A2}','Karim','+8802','Riyadh',24,172,70,'3333333333',null,null,'rejected');
insert into applicants (full_name, whatsapp, location, age, height_cm, weight_kg, passport_or_iqama, status) values ('Dup','+8809','Jeddah',30,170,70,'A20558187','rejected'),('Dup2','+8810','Jeddah',31,171,71,'A20558187','rejected');
insert into interview_sessions (id, applicant_id, questions, status, answers, decision) values ('${S1}','${A1}','["س1","س2"]','pending',null,null),('${S2}','${A2}','["س1"]','completed','{"0":"جواب قديم"}','accept');
insert into tma_invites (subject_name) values ('x');`);
ok('قبل الملف: الزائر يقرأ المتقدمين كلهم بملاحظاتهم الإدارية (الثغرة)',anon(`select count(*) from applicants where admin_notes is not null`)==='1');

const file=fs.readFileSync('docs/sql/close_anon_2.sql','utf8');
const e1=err(file),e2=err(file);
ok('الملف يُطبَّق مرتين بلا خطأ'+(e1||e2?' — '+String(e1||e2).slice(0,200):''),!e1&&!e2);
if(e1||e2)process.exit(1);

// ── العزل ──
ok('الزائر: لا قراءة للمتقدمين',/permission denied/.test(anonErr(`select count(*) from applicants`)||''));
ok('الزائر: لا إدراج مباشر في المتقدمين',/permission denied/.test(anonErr(`insert into applicants(full_name) values ('x')`)||''));
ok('الزائر: لا تعديل للمقابلات ولا قراءة',/permission denied/.test(anonErr(`update interview_sessions set decision='accept'`)||'')&&/permission denied/.test(anonErr(`select * from interview_sessions`)||''));
ok('الزائر: لا وصول لاستبيان TMA',/permission denied/.test(anonErr(`select * from tma_invites`)||'')&&/permission denied/.test(anonErr(`update tma_invites set status='completed'`)||''));
ok('لا سياسة anon باقية على الجداول الثلاثة',ps(`select count(*) from pg_policies where tablename in ('applicants','interview_sessions','tma_invites') and roles::text like '%anon%'`)==='0');
ok('الدوال الأربع security definer، ولا دالة applicant_exists (أداة تعداد)',ps(`select count(*) from pg_proc where proname in ('applicants_count','submit_application','interview_session','submit_interview') and prosecdef`)==='4'&&ps(`select count(*) from pg_proc where proname='applicant_exists'`)==='0');

// ── الدوال المحدودة ──
ok('applicants_count: رقم فقط',anon(`select applicants_count()`)==='4');
const NEW=anon(`select submit_application('{"full_name":"Jamal","whatsapp":"+8803","passport_or_iqama":" 4444444444 ","location":"Riyadh","height_cm":"170","weight_kg":"66","age":"25","has_license":"true","children_count":"","geo_score":"7.5","ai_evaluation_json":{"x":1},"status":"approved","admin_notes":"حقن","application_number":"1","operator_id":"00000000-0000-0000-0000-000000000001"}'::jsonb)`);
ok('submit_application: يُدرج ويُرجع المعرّف، والرقم مقصوص، ومشغّل التدقيق سجّل الإدراج بلا فاعل',/^[0-9a-f-]{36}$/.test(NEW)&&ps(`select passport_or_iqama from applicants where id='${NEW}'`)==='4444444444'&&ps(`select count(*)||'|'||coalesce(actor::text,'-') from audit_log where row_id='${NEW}' and action='INSERT' group by actor`)==='1|-');
ok('… الحالة pending رغم إرسال approved، ولا ملاحظات إدارية، ورقم الطلب من التسلسل، والقيم الرقمية محوّلة',
  ps(`select status||'|'||coalesce(admin_notes,'-')||'|'||application_number||'|'||age||'|'||has_license||'|'||children_count||'|'||geo_score||'|'||(ai_evaluation_json->>'x')||'|'||coalesce(operator_id::text,'-') from applicants where id='${NEW}'`)==='pending|-|105|25|true|0|7.5|1|-');
const FULL='"whatsapp":"y","location":"R","age":"20","height_cm":"170","weight_kg":"60"';
ok('submit_application: التكرار يُرفض برمز DUPLICATE_APPLICANT (حتى بمسافات أو حروف صغيرة)',/DUPLICATE_APPLICANT/.test(anonErr(`select submit_application('{"full_name":"x",${FULL},"passport_or_iqama":" 2222222222"}'::jsonb)`)||'')&&/DUPLICATE_APPLICANT/.test(anonErr(`select submit_application('{"full_name":"x",${FULL},"passport_or_iqama":"a 20558187"}'::jsonb)`)||''));
ok('submit_application: الطول الزائد يُرفض لا يُقصّ',/أطول من المسموح/.test(anonErr(`select submit_application('{"full_name":"x",${FULL},"passport_or_iqama":"8","whatsapp":"${'1'.repeat(41)}"}'::jsonb)`)||'')&&ps(`select count(*) from applicants where passport_or_iqama='8'`)==='0');
ok('submit_application: النواقص (الأعمدة not null) تُرفض برسالة عربية لا بخطأ القيد',/مطلوبة/.test(anonErr(`select submit_application('{"full_name":"x","whatsapp":"y","passport_or_iqama":"5"}'::jsonb)`)||'')&&/مطلوبة/.test(anonErr(`select submit_application('{"full_name":"x",${FULL},"passport_or_iqama":"5","age":""}'::jsonb)`)||''));
// تزامن: إرسالان بنفس الرقم في معاملتين متزامنتين ⇒ واحد فقط يمرّ (القفل الاستشاري)
{const {spawn}=await import('node:child_process');const run=()=>new Promise(r=>{const c=spawn('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',db,'-qAt','-c',`begin; set local role anon; select submit_application('{"full_name":"x",${FULL},"passport_or_iqama":"7777777777"}'::jsonb); select pg_sleep(0.3); commit;`]);let o='',e='';c.stdout.on('data',d=>o+=d);c.stderr.on('data',d=>e+=d);c.on('close',()=>r(o+e));});
  const rs=await Promise.all([run(),run()]);ok('تزامن: إرسالان بنفس الرقم ⇒ صف واحد وخطأ تكرار واحد',ps(`select count(*) from applicants where passport_or_iqama='7777777777'`)==='1'&&rs.filter(x=>/DUPLICATE_APPLICANT/.test(x)).length===1);}
ok('submit_application: نص بدل كائن ⇒ خطأ',!!anonErr(`select submit_application('"abc"'::jsonb)`));

const iv=JSON.parse(anon(`select interview_session('${S1}')`));
ok('interview_session: الأسئلة والحالة واسم المتقدم ورقمه فقط',iv.id===S1&&iv.status==='pending'&&iv.questions.length===2&&iv.applicant_name==='Rahim'&&iv.application_number===101&&Object.keys(iv).sort().join()==='applicant_name,application_number,id,questions,status');
ok('interview_session: رمز غير موجود ⇒ لا شيء',anon(`select coalesce(interview_session('50000000-0000-0000-0000-000000000009')::text,'null')`)==='null');
ok('submit_interview: يكمل الجلسة ويحدّث المتقدم',anon(`select submit_interview('${S1}','{"0":"أ","1":"ب"}')`)==='t'
  &&ps(`select status||'|'||(answers->>'1')||'|'||(completed_at is not null) from interview_sessions where id='${S1}'`)==='completed|ب|true'
  &&ps(`select status||'|'||(interview_answers->>'0')||'|'||(interview_completed_at is not null) from applicants where id='${A1}'`)==='interview|أ|true');
ok('submit_interview: الجلسة المكتملة لا تُعاد',/INTERVIEW_COMPLETED/.test(anonErr(`select submit_interview('${S2}','{"0":"تغيير"}')`)||'')&&ps(`select answers->>'0' from interview_sessions where id='${S2}'`)==='جواب قديم');
ps(`insert into interview_sessions (id, applicant_id, questions, status) values ('50000000-0000-0000-0000-000000000003','${A2}','["س"]','pending')`);
ok('submit_interview: متقدم مرفوض يُرسل أجوبته ⇒ تُحفظ وحالته لا ترجع إلى interview',anon(`select submit_interview('50000000-0000-0000-0000-000000000003','{"0":"ج"}')`)==='t'&&ps(`select status||'|'||(interview_answers->>'0') from applicants where id='${A2}'`)==='rejected|ج');
ok('submit_interview: رمز مجهول ⇒ INTERVIEW_NOT_FOUND',/INTERVIEW_NOT_FOUND/.test(anonErr(`select submit_interview('50000000-0000-0000-0000-000000000009','{}')`)||''));
ok('submit_interview: مصفوفة بدل كائن ⇒ خطأ',!!anonErr(`select submit_interview('${S1}','[]')`));
ok('الدوال غير متاحة للدور public (مثل دور غير معروف)',ps(`select has_function_privilege('authenticated','public.submit_application(jsonb)','execute')`)==='t'&&ps(`do $$ begin create role nobody_x nologin; exception when others then null; end $$; select has_function_privilege('nobody_x','public.submit_application(jsonb)','execute')`)==='f');
}finally{ps(`drop database if exists ${db}`,'postgres');}
