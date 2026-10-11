-- ═══ إغلاق الوصول بلا تسجيل دخول — المرحلة 2: المتقدمون والمقابلات واستبيان TMA ═══
-- المشروع: cnmggdrlkgsyrjxmvydv
-- الحالة: **لم يُطبَّق** — يشغّله المالك كاملاً من SQL Editor (فيه drop policy، والأداة تنتهي مهلتها عليه)،
--          **قبل** دمج PR الواجهة (النماذج العامة الجديدة تستدعي الدوال أدناه). آمن لإعادة التشغيل.
-- قرار المالك 2026-10-11: الأمان المرحلة 2 في أكتوبر؛ النماذج الثلاثة (التقديم، الإعلان، المقابلة) تتحوّل إلى
--   دوال محدودة؛ استبيان TMA (tma_invites = 0 صفوف، لم يُستخدم) يُغلق بلا دالة بديلة؛ رفع ملفات المتقدمين يبقى كما هو.
--
-- الوضع قبل التطبيق (مقروء من الإنتاج 2026-10-11):
--   applicants (6 صفوف: إقامة/جواز، صور، جوال): anon = select/insert/update بسياسات true ⇒ الزائر يقرأ ويعدّل كل المتقدمين.
--   interview_sessions (6): anon = select/update بسياسات true ⇒ الزائر يقرأ كل المقابلات وأجوبتها ويعدّلها.
--   tma_invites (0): anon = select (true) / update (status<>completed).
--   job_ad: قراءة عامة للإعلان — تبقى كما هي (ليست بيانات شخصية). page_visits: إدراج الزائر يبقى (المرحلة 1).
--
-- ما يحتاجه الزائر فعلاً (من حصر الكود في ApplicantForm/RecruitmentAd/InterviewPage):
--   1) تقديم طلب جديد                                   ⇒ submit_application(p)         ⇒ يُدرج الأعمدة المسموحة فقط، status='pending'،
--      ويرفض التكرار برقم الإقامة/الجواز برمز DUPLICATE_APPLICANT (لا دالة «هل يوجد؟» منفصلة: كانت ستسمح لأي أحد بتعداد أرقام الإقامات)
--   2) (أُلغي)
--   3) عدد المتقدمين (شريط «تقدّم N» في الإعلان)        ⇒ applicants_count()            ⇒ رقم فقط
--   4) فتح المقابلة برمزها                              ⇒ interview_session(p_id)       ⇒ الأسئلة والحالة واسم المتقدم ورقمه فقط
--   5) إرسال أجوبة المقابلة                             ⇒ submit_interview(p_id, p_answers) ⇒ مرة واحدة، للجلسة غير المكتملة
-- كل الدوال security definer بمسار بحث ثابت، وتنفيذها للزائر والمسجّل فقط. بعدها يُسحب كل وصول anon للجداول الثلاثة.
-- مبدأ: المنع في القاعدة لا في الواجهة.

begin;

-- ═══ 1) الدوال المحدودة ═══
drop function if exists public.applicant_exists(text);

create or replace function public.applicants_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.applicants;
$$;

-- يُدرج فقط ما يملؤه النموذج؛ الحالة والملاحظات الإدارية ورقم الطلب والسجل لا تأتي من الزائر
create or replace function public.submit_application(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_iq text := btrim(coalesce(p ->> 'passport_or_iqama', '')); v_key text; k text; lim int;
begin
  if jsonb_typeof(p) <> 'object' then raise exception 'بيانات غير صالحة'; end if;
  -- الطول الزائد يُرفض لا يُقصّ (قصّ الجوال أو الجواب بصمت يفسد البيانات)
  for k, lim in select * from (values ('full_name',200),('whatsapp',40),('location',200),('marital_status',40),('bangladesh_district',120),('bangladesh_city',120),('map_link',500),('saudi_city',120),('ready_for_riyadh',40),('referred_by',120),('ai_classification',60),
      ('car_wash_description',4000),('q1_client_refusal',4000),('q2_equipment_damage',4000),('q3_left_previous_job',4000),('q4_salary_deduction',4000),('q5_one_year_goal',4000),('q6_difficult_colleague',4000),('ai_notes',4000)) v(k, lim) loop
    if length(coalesce(p ->> k, '')) > lim then raise exception 'الحقل % أطول من المسموح (%)', k, lim; end if;
  end loop;
  -- الأعمدة not null في الجدول: يُرفض الناقص برسالة واضحة بدل خطأ القيد
  if btrim(coalesce(p ->> 'full_name', '')) = '' or btrim(coalesce(p ->> 'whatsapp', '')) = '' or v_iq = ''
     or btrim(coalesce(p ->> 'location', '')) = '' or nullif(p ->> 'age', '') is null or nullif(p ->> 'height_cm', '') is null or nullif(p ->> 'weight_kg', '') is null then
    raise exception 'الاسم والجوال ورقم الإقامة/الجواز والموقع والعمر والطول والوزن مطلوبة';
  end if;
  -- مفتاح التكرار مطبّع (حروف كبيرة بلا مسافات): 'a 20558187' = 'A20558187'. يُخزَّن الرقم كما أُدخل بعد القص.
  v_key := upper(regexp_replace(v_iq, '\s', '', 'g'));
  -- قفل على المفتاح داخل المعاملة: إرسالان متزامنان بنفس الرقم لا يمرّان معاً (لا فهرس فريد: في الإنتاج تكرار قائم A20558187×2)
  perform pg_advisory_xact_lock(hashtext('applicant:' || v_key));
  if exists (select 1 from public.applicants where upper(regexp_replace(passport_or_iqama, '\s', '', 'g')) = v_key) then
    raise exception 'DUPLICATE_APPLICANT' using errcode = '23505';
  end if;
  insert into public.applicants (
    full_name, whatsapp, location, age, height_cm, weight_kg, passport_or_iqama, has_license, marital_status, children_count,
    license_image_url, personal_photo_url, driving_video_url, iqama_image_url, passport_image_url, car_wash_description,
    q1_client_refusal, q2_equipment_damage, q3_left_previous_job, q4_salary_deduction, q5_one_year_goal, q6_difficult_colleague,
    bangladesh_district, bangladesh_city, map_link, saudi_city, ready_for_riyadh, referred_by,
    geo_score, ai_score_total, ai_score_technical, ai_score_behavioral, score_physical, score_responsibility,
    ai_classification, ai_notes, ai_evaluation_json, status)
  values (
    p ->> 'full_name', p ->> 'whatsapp', p ->> 'location',
    nullif(p ->> 'age', '')::int, nullif(p ->> 'height_cm', '')::int, nullif(p ->> 'weight_kg', '')::int, v_iq,
    coalesce((p ->> 'has_license')::boolean, false), p ->> 'marital_status', coalesce(nullif(p ->> 'children_count', '')::int, 0),
    p ->> 'license_image_url', p ->> 'personal_photo_url', p ->> 'driving_video_url', p ->> 'iqama_image_url', p ->> 'passport_image_url',
    p ->> 'car_wash_description',
    p ->> 'q1_client_refusal', p ->> 'q2_equipment_damage', p ->> 'q3_left_previous_job',
    p ->> 'q4_salary_deduction', p ->> 'q5_one_year_goal', p ->> 'q6_difficult_colleague',
    p ->> 'bangladesh_district', p ->> 'bangladesh_city', p ->> 'map_link', p ->> 'saudi_city',
    p ->> 'ready_for_riyadh', p ->> 'referred_by',
    nullif(p ->> 'geo_score', '')::numeric, nullif(p ->> 'ai_score_total', '')::numeric, nullif(p ->> 'ai_score_technical', '')::numeric,
    nullif(p ->> 'ai_score_behavioral', '')::numeric, nullif(p ->> 'score_physical', '')::numeric, nullif(p ->> 'score_responsibility', '')::numeric,
    p ->> 'ai_classification', p ->> 'ai_notes', case when jsonb_typeof(p -> 'ai_evaluation_json') = 'object' then p -> 'ai_evaluation_json' end,
    'pending')
  returning id into v_id;
  return v_id;
end $$;

-- المقابلة برمزها: ما تعرضه الصفحة فقط (لا الأجوبة السابقة ولا التقييم ولا القرار)
create or replace function public.interview_session(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'status', s.status, 'questions', coalesce(s.questions, '[]'::jsonb),
           'applicant_name', a.full_name, 'application_number', a.application_number)
  from public.interview_sessions s left join public.applicants a on a.id = s.applicant_id
  where s.id = p_id;
$$;

-- إرسال الأجوبة مرة واحدة: يكمل الجلسة ويحدّث المتقدم (كما كان في الواجهة)
create or replace function public.submit_interview(p_id uuid, p_answers jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare s public.interview_sessions;
begin
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'بيانات غير صالحة'; end if;
  select * into s from public.interview_sessions where id = p_id for update;
  if not found then raise exception 'INTERVIEW_NOT_FOUND'; end if;
  if s.status = 'completed' then raise exception 'INTERVIEW_COMPLETED'; end if;
  update public.interview_sessions set answers = p_answers, status = 'completed', completed_at = now() where id = p_id;
  -- الأجوبة تُحفظ دائماً؛ الحالة تتقدّم إلى interview فقط من pending/interview (لا تُرجع متقدماً قُبل أو رُفض إلى المسار)
  update public.applicants set interview_answers = p_answers, interview_completed_at = now(),
    status = case when status in ('pending', 'interview') then 'interview' else status end where id = s.applicant_id;
  return true;
end $$;

revoke all on function public.applicants_count() from public;
revoke all on function public.submit_application(jsonb) from public;
revoke all on function public.interview_session(uuid) from public;
revoke all on function public.submit_interview(uuid, jsonb) from public;
grant execute on function public.applicants_count(), public.submit_application(jsonb),
  public.interview_session(uuid), public.submit_interview(uuid, jsonb) to anon, authenticated;

-- ═══ 2) سحب وصول الزائر للجداول الثلاثة ═══
revoke all on public.applicants from anon;
revoke all on public.interview_sessions from anon;
revoke all on public.tma_invites from anon;
-- السياسات القديمة بلا أثر بعد السحب؛ تُحذف تنظيفاً (SQL Editor)
drop policy if exists anon_select on public.applicants;
drop policy if exists anon_insert on public.applicants;
drop policy if exists anon_update on public.applicants;
drop policy if exists iv_anon_select on public.interview_sessions;
drop policy if exists iv_anon_update on public.interview_sessions;
drop policy if exists tma_inv_anon_read on public.tma_invites;
drop policy if exists tma_inv_anon_answer on public.tma_invites;

commit;

-- ═══ تحقق (بعد التطبيق) ═══
-- select table_name, string_agg(privilege_type, ',') from information_schema.role_table_grants
--   where grantee = 'anon' and table_name in ('applicants','interview_sessions','tma_invites') group by 1;   -- لا صفوف
-- select tablename, policyname from pg_policies where tablename in ('applicants','interview_sessions','tma_invites') and roles::text like '%anon%';  -- لا صفوف
-- select proname, prosecdef from pg_proc where proname in ('applicants_count','submit_application','interview_session','submit_interview');  -- 4 صفوف، prosecdef = t
-- select has_function_privilege('anon', 'public.submit_application(jsonb)', 'execute');  -- t
-- اختبار عزل بمفتاح الزائر (من المتصفح أو curl بلا توكن): GET /rest/v1/applicants?select=id ⇒ 401/403 أو [] ، و rpc/applicants_count ⇒ رقم.

-- ═══ تراجع ═══
-- begin;
-- grant select, insert, update on public.applicants to anon;
-- grant select, update on public.interview_sessions to anon;
-- grant select, update on public.tma_invites to anon;
-- create policy anon_select on public.applicants for select to anon using (true);
-- create policy anon_insert on public.applicants for insert to anon with check (true);
-- create policy anon_update on public.applicants for update to anon using (true) with check (true);
-- create policy iv_anon_select on public.interview_sessions for select to anon using (true);
-- create policy iv_anon_update on public.interview_sessions for update to anon using (true) with check (true);
-- create policy tma_inv_anon_read on public.tma_invites for select to anon using (true);
-- create policy tma_inv_anon_answer on public.tma_invites for update to anon using (status <> 'completed') with check (true);
-- drop function if exists public.applicants_count(), public.submit_application(jsonb),
--   public.interview_session(uuid), public.submit_interview(uuid, jsonb);
-- commit;
-- (التراجع يعيد الواجهة القديمة إلى العمل؛ الواجهة الجديدة تحتاج الدوال)
