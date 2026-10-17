-- ═══ مسار طلبات تغيير الزيت كما يجري فعلاً: البايكر يرفع الطلب في سويتر، والإدارة تتابع وتراجع الصور ═══
-- المشروع: cnmggdrlkgsyrjxmvydv · طلب المالك 2026-10-17
-- الحالة: A **لم يُطبَّق** · B **لم يُطبَّق**
--
-- وقائع مقروءة من الإنتاج 2026-10-17 قبل الكتابة:
--   • maintenance_requests: 3 صفوف — 68c5f268 (1624، sent عبر واتساب 15/10)، 7acda5e0 (1648، approved)، 39004cb4 (1648، requested 16/10).
--     status check = requested/sent/done/approved. سياسة القراءة mr_sel: البايكر صفوفه، أو has_perm('fleet_alerts') أو has_perm('fleet').
--     المسجّل له select فقط؛ الكتابة كلها عبر الدوال. مشغّل التدقيق trg_audit_maintenance_requests موجود.
--   • الدوال request_oil_change/confirm_oil_change/send_oil_to_sweater/approve_oil_change و fleet_alerts() مطابقة لـ docs/sql/fleet_requests.sql.
--   • _fleet_notify_admins/_fleet_notify_biker في الإنتاج أحدث من الملف (بادئة «🧪 تجريبي») ⇒ تُستدعى ولا تُعاد كتابتها هنا.
--
-- المسار الجديد:
--   البايكر: ١) يرفع الطلب في تطبيق سويتر بنفسه، ثم في البوابة: لقطة طلب سويتر (إلزامية) + العدّاد وصورته ⇒ «قيد المتابعة مع سويتر».
--            ٢) بعد التنفيذ: لقطة من سويتر تثبت التنفيذ (إلزامية) + العدّاد وصورته؛ اسم الفني اختياري ⇒ «نُفّذ — بانتظار المراجعة».
--            ٣) يُرفض التحديث في نفس دقيقة رفع الطلب (SAME_MINUTE)، أو بعدّاد أقل من عدّاد الطلب (ODOMETER_BELOW_REQUEST).
--   الإدارة (has_perm('fleet_alerts', true) فقط، والمالك دائماً):
--            ٤) لا خطوة «أُرسل لسويتر»: الطلب المفتوح (requested، أو sent القديم) يُعرض «قيد المتابعة مع سويتر» مع لقطة الطلب وصورة العدّاد.
--               send_oil_to_sweater يُسحب تنفيذها (لا حذف).
--            ٥) المراجعة: approve_oil_change (كما هي) أو reject_oil_execution بسبب ⇒ يعود الطلب «قيد المتابعة» ويصل البايكرَ إشعار
--               بالعربي والبنغالي فيعيد الرفع. الإثبات المرفوض يُحفظ في exec_rejections (لا يضيع).
--            ٦) admin_add_oil_change: طلب مفتوح أو تغيير منفّذ (معتمد مباشرة) نيابة عن البايكر.
--            ٧) cancel_oil_request: «إلغاء بسبب» — الحالة cancelled مع السبب ومن ألغى ومتى والحالة السابقة. لا حذف من القاعدة.
--   ٨) عند كل طلب جديد تُحفظ المسافة والأيام منذ آخر تغيير معتمد (since_km، since_days) والحدّ وقتها (interval_km)،
--      وإن كانت المسافة أقل من oil_interval_km يبدأ إشعار الإدارة بـ«⚠️ زيت مبكر» مع الكيلومترات والأيام.
--
-- ترتيب التطبيق:
--   القسم A — من SQL Editor: docs/sql/oil_flow_A.sql كما هو (drop constraint لإضافة «cancelled»؛ تحقق: true | 3).
--   القسم B — عبر الأداة (معاملة واحدة، آمن لإعادة التشغيل، بلا تعديل بيانات).
--   ثم دمج PR الواجهة مباشرة. بين B والدمج: «اطلب تغيير الزيت» في الواجهة القديمة يرفض (USE_NEW_OIL_REQUEST — النسخة القديمة
--   بلا لقطة سويتر مسحوبة)، و«أُرسل لسويتر» يرفض (permission denied)، و«أكّد» يعمل بالقواعد الجديدة.
--
-- قرارات تفصيلية (للمراجعة):
--   1) رفض التنفيذ يعيد الحالة إلى requested (لا حالة جديدة) ويفرّغ حقول التنفيذ بعد نسخها إلى exec_rejections (jsonb):
--      {at, by, reason, done_at, odometer, odometer_photo_url, proof_url, tech}. سبب آخر رفض في exec_reject_reason يراه البايكر.
--   2) «نفس الدقيقة»: date_trunc('minute', now()) <= date_trunc('minute', requested_at) ⇒ SAME_MINUTE (الدقيقة نفسها على الساعة).
--   3) الإلغاء مسموح لأي حالة غير ملغاة (حتى المعتمد إن سُجّل خطأ ⇒ يخرج من أساس «استحقاق الزيت»). cancelled_from تحفظ الحالة السابقة.
--      يصل البايكرَ إشعار بالإلغاء إن كان الطلب مفتوحاً (requested/sent/done).
--   4) الإضافة نيابة عن البايكر: البايكر = حائز الدراجة الحالي، وإلا المخصّصة له (نفس قاعدة البوابة). صورة العدّاد إلزامية (العمود not null)،
--      ولقطتا سويتر اختياريتان للإدارة. التاريخ: لا مستقبل (> ساعة)، ولا أقدم من 400 يوم. «منفّذ» ⇒ approved مباشرة (approved_by = المُضيف)،
--      done_at = التاريخ المُدخل. «طلب» ⇒ requested بالتاريخ المُدخل، ويصل البايكرَ إشعار ليؤكد التنفيذ لاحقاً.
--   5) آخر تغيير معتمد = الأحدث بتاريخ التنفيذ (done_at، وإلا requested_at) لا تاريخ الاعتماد، وقبل تاريخ الطلب الجديد.
--   6) سبب الرفض أو الإلغاء نص حرّ يكتبه المراجع فيصل كما كُتب؛ الجملة الثابتة حوله بالعربي والبنغالي.
--   7) fleet_alerts(): الطلبات الملغاة خارج قراءات العدّاد و«استحقاق الزيت»، ونص «طلب زيت لم يُنفَّذ» صار «قيد المتابعة مع سويتر».
--      لا تغيير آخر فيها (مطابقة للإنتاج حرفياً عدا هذه الأسطر الأربعة).

-- ════════════════════════════════════════════════════════════════════════
-- ═══ A) من SQL Editor (معاملة واحدة) ═══
-- ════════════════════════════════════════════════════════════════════════
-- في ملف مستقل جاهز للصق كما هو: docs/sql/oil_flow_A.sql (begin … commit + استعلام تحقق: true | 3).

-- ════════════════════════════════════════════════════════════════════════
-- ═══ B) عبر الأداة (معاملة واحدة؛ آمن لإعادة التشغيل؛ بلا كلمات الحذف) ═══
-- ════════════════════════════════════════════════════════════════════════

-- B.1 الأعمدة (كلها اختيارية أو بقيمة افتراضية ⇒ الصفوف الثلاثة كما هي)
alter table public.maintenance_requests add column if not exists request_shot_url text check (length(request_shot_url) between 1 and 1000);  -- لقطة طلب سويتر
alter table public.maintenance_requests add column if not exists source text not null default 'biker' check (source in ('biker', 'admin'));
alter table public.maintenance_requests add column if not exists note text check (length(note) <= 1000);                -- ملاحظة الإدارة عند الإضافة
alter table public.maintenance_requests add column if not exists since_km numeric;       -- كم منذ آخر تغيير معتمد (لحظة الطلب)
alter table public.maintenance_requests add column if not exists since_days numeric;     -- أيام منذ آخر تغيير معتمد
alter table public.maintenance_requests add column if not exists interval_km numeric;    -- oil_interval_km لحظة الطلب
alter table public.maintenance_requests add column if not exists exec_reject_reason text check (length(exec_reject_reason) <= 500);
alter table public.maintenance_requests add column if not exists exec_rejected_at timestamptz;
alter table public.maintenance_requests add column if not exists exec_rejected_by uuid;
alter table public.maintenance_requests add column if not exists exec_rejections jsonb not null default '[]'::jsonb;
alter table public.maintenance_requests add column if not exists cancel_reason text check (length(cancel_reason) <= 500);
alter table public.maintenance_requests add column if not exists cancelled_at timestamptz;
alter table public.maintenance_requests add column if not exists cancelled_by uuid;
alter table public.maintenance_requests add column if not exists cancelled_from text;

-- B.2 المسافة والأيام منذ آخر تغيير معتمد قبل p_at (داخلية)
create or replace function public._oil_since(p_vehicle uuid, p_odometer numeric, p_at timestamptz)
returns table (km numeric, days numeric) language sql stable security definer set search_path = public as $$
  select p_odometer - coalesce(m.done_odometer, m.odometer), floor(extract(epoch from p_at - coalesce(m.done_at, m.requested_at)) / 86400.0)
  from public.maintenance_requests m
  where m.vehicle_id = p_vehicle and m.kind = 'oil_change' and m.status = 'approved' and coalesce(m.done_at, m.requested_at) <= p_at
  order by coalesce(m.done_at, m.requested_at) desc limit 1;
$$;

-- B.3 البايكر: طلب تغيير زيت (رفعه في سويتر أولاً): لقطة طلب سويتر + العدّاد وصورته
create or replace function public.request_oil_change(p_odometer numeric, p_odometer_photo_url text, p_request_shot_url text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.fleet_vehicles; v_bid text := public.my_biker_id(); v_name text; v_id uuid; v_km numeric; v_days numeric; v_int numeric;
begin
  if v_bid is null then raise exception 'NOT_A_BIKER'; end if;
  v := public._fleet_my_vehicle();
  if v.id is null then raise exception 'NO_BIKE'; end if;
  if p_odometer is null or p_odometer < 0 then raise exception 'ODOMETER_REQUIRED'; end if;
  if coalesce(btrim(p_odometer_photo_url), '') = '' or length(p_odometer_photo_url) > 1000 then raise exception 'PHOTO_REQUIRED'; end if;
  if coalesce(btrim(p_request_shot_url), '') = '' or length(p_request_shot_url) > 1000 then raise exception 'SHOT_REQUIRED'; end if;
  select full_name into v_name from public.employees where id = public.my_employee_uuid();
  select s.km, s.days into v_km, v_days from public._oil_since(v.id, p_odometer, now()) s;
  v_int := public._fleet_setting('oil_interval_km', v.id);
  insert into public.maintenance_requests (operator_id, vehicle_id, plate, biker_employee_id, biker_name, odometer, odometer_photo_url, request_shot_url,
                                           source, since_km, since_days, interval_km, created_by)
  values (v.operator_id, v.id, v.plate, v_bid, v_name, p_odometer, btrim(p_odometer_photo_url), btrim(p_request_shot_url),
          'biker', v_km, v_days, v_int, auth.uid())
  returning id into v_id;
  perform public._fleet_notify_admins(
    case when v_km < v_int then '⚠️ زيت مبكر — ' else 'طلب تغيير زيت — ' end || coalesce(v.plate, '—'),
    coalesce(v_name, v_bid) || ' · العدّاد ' || trim_scale(p_odometer)::text
      || case when v_km is null then ' · لا تغيير معتمد سابق'
              else ' · ' || trim_scale(v_km)::text || ' كم و' || v_days::text || ' يوم منذ آخر تغيير معتمد'
                   || case when v_km < v_int then ' (الحد ' || trim_scale(v_int)::text || ' كم)' else '' end end,
    v_id::text, 'oil-req-' || v_id);
  return v_id;
end $$;

-- النسخة القديمة (بلا لقطة سويتر): تبقى بالاسم (لا حذف عبر الأداة) وترفض، ويُسحب تنفيذها في B.9
create or replace function public.request_oil_change(p_odometer numeric, p_odometer_photo_url text)
returns uuid language plpgsql security definer set search_path = public as $$
begin raise exception 'USE_NEW_OIL_REQUEST'; end $$;

-- B.4 البايكر: تحديث التنفيذ — لقطة سويتر تثبت التنفيذ + العدّاد وصورته؛ اسم الفني اختياري
create or replace function public.confirm_oil_change(p_id uuid, p_odometer numeric, p_odometer_photo_url text, p_proof_url text, p_tech_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.maintenance_requests;
begin
  select * into r from public.maintenance_requests where id = p_id for update;
  if not found or r.biker_employee_id is distinct from public.my_biker_id() then raise exception 'NOT_FOUND'; end if;
  if r.status not in ('requested', 'sent') then raise exception 'ALREADY_DONE'; end if;
  if p_odometer is null or p_odometer < 0 then raise exception 'ODOMETER_REQUIRED'; end if;
  if coalesce(btrim(p_odometer_photo_url), '') = '' or length(p_odometer_photo_url) > 1000 then raise exception 'PHOTO_REQUIRED'; end if;
  if coalesce(btrim(p_proof_url), '') = '' or length(p_proof_url) > 1000 then raise exception 'SHOT_REQUIRED'; end if;
  if length(p_tech_name) > 120 then raise exception 'TECH_NAME_TOO_LONG'; end if;
  if date_trunc('minute', now()) <= date_trunc('minute', r.requested_at) then raise exception 'SAME_MINUTE'; end if;
  if p_odometer < r.odometer then raise exception 'ODOMETER_BELOW_REQUEST'; end if;
  update public.maintenance_requests set status = 'done', done_at = now(), done_odometer = p_odometer,
    done_odometer_photo_url = btrim(p_odometer_photo_url), done_proof_url = btrim(p_proof_url), sweater_tech_name = nullif(btrim(p_tech_name), ''),
    exec_reject_reason = null
  where id = p_id;
  -- رقم المحاولة في مفتاح التكرار: إعادة الرفع بعد رفض تصل إشعاراً جديداً
  perform public._fleet_notify_admins('نُفّذ تغيير الزيت — ' || coalesce(r.plate, '—'),
    coalesce(r.biker_name, r.biker_employee_id) || ' · العدّاد ' || trim_scale(p_odometer)::text || ' · بانتظار مراجعة الصور',
    p_id::text, 'oil-done-' || p_id || '-' || jsonb_array_length(r.exec_rejections));
  return true;
end $$;

-- B.5 الإدارة: رفض التنفيذ بسبب ⇒ يعود «قيد المتابعة مع سويتر»، والإثبات المرفوض محفوظ في exec_rejections
create or replace function public.reject_oil_execution(p_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.maintenance_requests;
begin
  if not public.has_perm('fleet_alerts', true) then raise exception 'FORBIDDEN'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  if length(p_reason) > 500 then raise exception 'REASON_TOO_LONG'; end if;
  select * into r from public.maintenance_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'done' then raise exception 'NOT_DONE'; end if;
  update public.maintenance_requests set status = 'requested',
    exec_rejections = r.exec_rejections || jsonb_build_array(jsonb_build_object('at', now(), 'by', auth.uid(), 'reason', btrim(p_reason), 'done_at', r.done_at,
      'odometer', r.done_odometer, 'odometer_photo_url', r.done_odometer_photo_url, 'proof_url', r.done_proof_url, 'tech', r.sweater_tech_name)),
    exec_reject_reason = btrim(p_reason), exec_rejected_at = now(), exec_rejected_by = auth.uid(),
    done_at = null, done_odometer = null, done_odometer_photo_url = null, done_proof_url = null, sweater_tech_name = null
  where id = p_id;
  perform public._fleet_notify_biker(r.biker_employee_id, 'أعد رفع إثبات تغيير الزيت · তেল পরিবর্তনের প্রমাণ আবার আপলোড করুন',
    btrim(p_reason) || ' — أعد الرفع من البوابة · পোর্টাল থেকে আবার আপলোড করুন', p_id::text, 'oil-rej-' || p_id || '-' || jsonb_array_length(r.exec_rejections));
  return true;
end $$;

-- B.6 الإدارة: إلغاء بسبب (لا حذف) — يختفي من القوائم ويبقى في السجل
create or replace function public.cancel_oil_request(p_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.maintenance_requests;
begin
  if not public.has_perm('fleet_alerts', true) then raise exception 'FORBIDDEN'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  if length(p_reason) > 500 then raise exception 'REASON_TOO_LONG'; end if;
  select * into r from public.maintenance_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status = 'cancelled' then raise exception 'ALREADY_CANCELLED'; end if;
  update public.maintenance_requests set status = 'cancelled', cancelled_from = r.status, cancel_reason = btrim(p_reason), cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_id;
  if r.status in ('requested', 'sent', 'done') then
    perform public._fleet_notify_biker(r.biker_employee_id, 'أُلغي طلب تغيير الزيت · তেল পরিবর্তনের অনুরোধ বাতিল',
      btrim(p_reason), p_id::text, 'oil-cancel-' || p_id);
  end if;
  return true;
end $$;

-- B.7 الإدارة: إضافة طلب أو تغيير منفّذ نيابة عن البايكر (حائز الدراجة، وإلا المخصّصة له)
create or replace function public.admin_add_oil_change(p_vehicle_id uuid, p_odometer numeric, p_odometer_photo_url text, p_done boolean default false,
  p_at timestamptz default now(), p_request_shot_url text default null, p_proof_url text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.fleet_vehicles; v_bid text; v_name text; v_at timestamptz := coalesce(p_at, now()); v_id uuid; v_km numeric; v_days numeric; v_done boolean := coalesce(p_done, false);
begin
  if not public.has_perm('fleet_alerts', true) then raise exception 'FORBIDDEN'; end if;
  select * into v from public.fleet_vehicles where id = p_vehicle_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  select btrim(e.employee_id), e.full_name into v_bid, v_name from public.employees e where e.id = coalesce(v.held_by, v.biker_employee_id);
  if coalesce(v_bid, '') = '' then raise exception 'NO_BIKER'; end if;
  if p_odometer is null or p_odometer < 0 then raise exception 'ODOMETER_REQUIRED'; end if;
  if coalesce(btrim(p_odometer_photo_url), '') = '' or length(p_odometer_photo_url) > 1000 then raise exception 'PHOTO_REQUIRED'; end if;
  if length(p_request_shot_url) > 1000 or length(p_proof_url) > 1000 then raise exception 'BAD_URL'; end if;
  if length(p_note) > 1000 then raise exception 'NOTE_TOO_LONG'; end if;
  if v_at > now() + interval '1 hour' or v_at < now() - interval '400 days' then raise exception 'BAD_DATE'; end if;
  select s.km, s.days into v_km, v_days from public._oil_since(v.id, p_odometer, v_at) s;
  insert into public.maintenance_requests (operator_id, vehicle_id, plate, biker_employee_id, biker_name, status, odometer, odometer_photo_url, request_shot_url,
      requested_at, done_at, done_odometer, done_odometer_photo_url, done_proof_url, approved_at, approved_by,
      source, note, since_km, since_days, interval_km, created_by)
  values (v.operator_id, v.id, v.plate, v_bid, v_name, case when v_done then 'approved' else 'requested' end, p_odometer, btrim(p_odometer_photo_url),
      nullif(btrim(p_request_shot_url), ''), v_at,
      case when v_done then v_at end, case when v_done then p_odometer end, case when v_done then btrim(p_odometer_photo_url) end,
      case when v_done then nullif(btrim(p_proof_url), '') end, case when v_done then now() end, case when v_done then auth.uid() end,
      'admin', nullif(btrim(p_note), ''), v_km, v_days, public._fleet_setting('oil_interval_km', v.id), auth.uid())
  returning id into v_id;
  if not v_done then
    perform public._fleet_notify_biker(v_bid, 'سُجِّل لك طلب تغيير زيت · আপনার জন্য তেল পরিবর্তনের অনুরোধ নথিভুক্ত হয়েছে',
      'بعد التنفيذ ارفع الإثبات من البوابة · কাজ শেষে পোর্টালে প্রমাণ আপলোড করুন', v_id::text, 'oil-add-' || v_id);
  end if;
  return v_id;
end $$;

-- B.8 fleet_alerts(): مطابقة للإنتاج عدا: الملغاة خارج قراءات العدّاد و«استحقاق الزيت»، ونص «قيد المتابعة مع سويتر»
create or replace function public.fleet_alerts()
returns table (kind text, severity text, vehicle_id uuid, plate text, ref_table text, ref_id uuid, at timestamptz, value numeric, threshold numeric, detail text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('fleet_alerts') then return; end if;
  return query
  -- (1) استهلاك عالٍ: آخر فترة مكتملة (طلب محوَّل ← الطلب المحوَّل التالي) مُطبَّعة إلى 50﷼، مقابل متوسط الفترات الثلاث السابقة أو الحد المطلق.
  --     الطلبات غير المحوَّلة (مكررة أو لم يُرسل لها مال) لا تدخل: لا وقود بلا تحويل.
  with req as (
    select r.*, lead(r.odometer) over w as next_odo, lead(r.requested_at) over w as next_at
    from public.fuel_requests r where r.transferred_at is not null window w as (partition by r.vehicle_id order by r.requested_at)
  ), seg as (
    select q.*, (q.next_odo - q.odometer) * 50.0 / q.amount as km50 from req q where q.next_odo is not null and q.next_odo > q.odometer
  ), seg2 as (
    select s.*, avg(s.km50) over (partition by s.vehicle_id order by s.requested_at rows between 3 preceding and 1 preceding) as base,
           count(*) over (partition by s.vehicle_id order by s.requested_at rows between 3 preceding and 1 preceding) as nprev,
           row_number() over (partition by s.vehicle_id order by s.requested_at desc) as last_rn
    from seg s
  )
  select 'high_consumption', 'warn', s.vehicle_id, s.plate, 'fuel_requests', s.id, s.next_at, round(s.km50),
         case when s.nprev >= 3 then round(s.base * (1 - public._fleet_setting('fuel_low_pct', s.vehicle_id) / 100.0)) else public._fleet_setting('fuel_min_km_per_50', s.vehicle_id) end,
         'فحص صيانة مقترح: ' || round(s.km50) || ' كم لكل 50﷼' || case when s.nprev >= 3 then ' (متوسط سابق ' || round(s.base) || ' كم)' else '' end
  from seg2 s
  where s.last_rn = 1 and (
    (s.nprev >= 3 and s.km50 < s.base * (1 - public._fleet_setting('fuel_low_pct', s.vehicle_id) / 100.0))
    or (s.nprev < 3 and s.km50 < public._fleet_setting('fuel_min_km_per_50', s.vehicle_id)))

  union all
  -- (2) تعبئات متقاربة (آخر 30 يوماً، بلا legacy)
  select 'close_fills', 'info', f.vehicle_id, f.plate, 'fuel_logs', f.id, f.fill_at, f.odometer - f.prev_odo, public._fleet_setting('fill_gap_km', f.vehicle_id),
         'تعبئتان متقاربتان: ' || coalesce((f.odometer - f.prev_odo)::text, '—') || ' كم خلال ' || round(extract(epoch from f.fill_at - f.prev_at) / 3600.0) || ' ساعة'
  from (select l.*, lag(l.odometer) over w as prev_odo, lag(l.fill_at) over w as prev_at
        from public.fuel_logs l where not l.legacy and l.vehicle_id is not null window w as (partition by l.vehicle_id order by l.fill_at)) f
  where f.prev_at is not null and f.fill_at > now() - interval '30 days'
    and ((f.odometer - f.prev_odo) < public._fleet_setting('fill_gap_km', f.vehicle_id)
         or f.fill_at - f.prev_at < make_interval(hours => public._fleet_setting('fill_gap_hours', f.vehicle_id)::int))

  union all
  -- (3) حُوِّل بلا فواتير بعد المهلة (يبقى ظاهراً ولو أُغلق الطلب بطلب أحدث؛ نافذة 30 يوماً من التحويل)
  select 'no_receipts', 'warn', r.vehicle_id, r.plate, 'fuel_requests', r.id, r.transferred_at,
         floor(extract(epoch from now() - r.transferred_at) / 86400.0), public._fleet_setting('receipt_grace_days', r.vehicle_id),
         'حُوِّل ' || to_char(r.amount, 'FM999990.##') || ' ﷼ (' || coalesce(r.transfer_ref, '—') || ') ولا فاتورة بعد ' || floor(extract(epoch from now() - r.transferred_at) / 86400.0) || ' يوم'
  from public.fuel_requests r
  where r.transferred_at is not null and r.transferred_at > now() - interval '30 days'
    and r.transferred_at < now() - make_interval(days => public._fleet_setting('receipt_grace_days', r.vehicle_id)::int)
    and not exists (select 1 from public.fuel_logs l where l.request_id = r.id)

  union all
  -- (4) تعبئة بلا طلب (آخر 30 يوماً، بلا legacy)
  select 'fill_without_request', 'info', l.vehicle_id, l.plate, 'fuel_logs', l.id, l.fill_at, l.amount, null::numeric,
         'تعبئة ' || coalesce(to_char(l.amount, 'FM999990.##'), '—') || ' ﷼ بلا طلب محوَّل'
  from public.fuel_logs l
  where not l.legacy and l.request_id is null and l.vehicle_id is not null and l.fill_at > now() - interval '30 days'

  union all
  -- (5) و(6) العدّاد: أقل من القراءة السابقة، أو قفزة يومية غير منطقية (كل القراءات: طلبات، تعبئات، زيت).
  --     المقارنة بالقراءة السابقة لا بأعلاها: قراءة خاطئة واحدة تطلق تنبيهين فقط (قفزة ثم رجوع) لا سلسلة.
  --     طلب الزيت له قراءتان (الطلب والتنفيذ) ⇒ يُبقى أحدث تنبيه واحد لكل (نوع، مرجع).
  (select distinct on (o.kind, o.src, o.id) o.kind, 'warn'::text, o.vehicle_id, o.plate, o.src, o.id, o.at, o.val, o.thr, o.detail
  from (
    select case when rd.odo < rd.prev_odo then 'odometer_backwards' else 'odometer_jump' end as kind,
           rd.vehicle_id, rd.plate, rd.src, rd.id, rd.at,
           case when rd.odo < rd.prev_odo then rd.odo else round((rd.odo - rd.prev_odo) / greatest(extract(epoch from rd.at - rd.prev_at) / 86400.0, 1)) end as val,
           case when rd.odo < rd.prev_odo then rd.prev_odo else public._fleet_setting('odo_max_km_per_day', rd.vehicle_id) end as thr,
           case when rd.odo < rd.prev_odo then 'قراءة العدّاد ' || rd.odo || ' أقل من سابقة ' || rd.prev_odo
                else 'قفزة عدّاد: ' || (rd.odo - rd.prev_odo) || ' كم خلال ' || round(extract(epoch from rd.at - rd.prev_at) / 86400.0, 1) || ' يوم' end as detail,
           (rd.odo - rd.prev_odo) / greatest(extract(epoch from rd.at - rd.prev_at) / 86400.0, 1) as per_day
    from (
      select x.*, lag(x.odo) over (partition by x.vehicle_id order by x.at) as prev_odo, lag(x.at) over (partition by x.vehicle_id order by x.at) as prev_at
      from (
        select r.vehicle_id, r.plate, 'fuel_requests'::text as src, r.id, r.requested_at as at, r.odometer as odo from public.fuel_requests r
        union all select l.vehicle_id, l.plate, 'fuel_logs', l.id, l.fill_at, l.odometer from public.fuel_logs l where not l.legacy and l.vehicle_id is not null and l.odometer is not null
        union all select m.vehicle_id, m.plate, 'maintenance_requests', m.id, m.requested_at, m.odometer from public.maintenance_requests m where m.status <> 'cancelled'
        union all select m.vehicle_id, m.plate, 'maintenance_requests', m.id, m.done_at, m.done_odometer from public.maintenance_requests m where m.done_odometer is not null and m.status <> 'cancelled'
      ) x
    ) rd
    where rd.at > now() - interval '30 days' and rd.prev_at is not null
  ) o
  where o.kind = 'odometer_backwards' or o.per_day > public._fleet_setting('odo_max_km_per_day', o.vehicle_id)
  order by o.kind, o.src, o.id, o.at desc)

  union all
  -- (7) استحقاق تغيير الزيت: أعلى قراءة حالية − عدّاد آخر تغيير معتمد ≥ الحد، ولا طلب زيت مفتوح. بلا سجل سابق ⇒ لا تنبيه (لا أساس).
  select 'oil_due', 'warn', v.id, v.plate, 'fleet_vehicles', v.id, now(), cur.odo - last_oil.odo, public._fleet_setting('oil_interval_km', v.id),
         'تغيير الزيت مستحق: ' || (cur.odo - last_oil.odo) || ' كم منذ آخر تغيير (' || last_oil.odo || ')'
  from public.fleet_vehicles v
  join lateral (select coalesce(m.done_odometer, m.odometer) as odo from public.maintenance_requests m
                where m.vehicle_id = v.id and m.kind = 'oil_change' and m.status = 'approved' order by m.approved_at desc limit 1) last_oil on true
  join lateral (select max(y.odo) as odo from (
                  select r.odometer as odo from public.fuel_requests r where r.vehicle_id = v.id
                  union all select l.odometer from public.fuel_logs l where l.vehicle_id = v.id and not l.legacy
                  union all select m.odometer from public.maintenance_requests m where m.vehicle_id = v.id and m.status <> 'cancelled'
                  union all select m.done_odometer from public.maintenance_requests m where m.vehicle_id = v.id and m.status <> 'cancelled') y) cur on true
  where v.active and cur.odo - last_oil.odo >= public._fleet_setting('oil_interval_km', v.id)
    and not exists (select 1 from public.maintenance_requests m where m.vehicle_id = v.id and m.kind = 'oil_change' and m.status in ('requested', 'sent', 'done'))

  union all
  -- (8) طلب زيت لم يُنفَّذ خلال المهلة
  select 'oil_overdue', 'warn', m.vehicle_id, m.plate, 'maintenance_requests', m.id, m.requested_at,
         floor(extract(epoch from now() - m.requested_at) / 86400.0), public._fleet_setting('oil_exec_days', m.vehicle_id),
         'طلب تغيير زيت قيد المتابعة مع سويتر منذ ' || floor(extract(epoch from now() - m.requested_at) / 86400.0) || ' يوم'
  from public.maintenance_requests m
  where m.status in ('requested', 'sent') and m.requested_at < now() - make_interval(days => public._fleet_setting('oil_exec_days', m.vehicle_id)::int);
end $$;

-- B.9 الصلاحيات: _oil_since داخلية؛ الجديدة للمسجّل لا لـ anon؛ القديمتان (بلا لقطة، والإرسال لسويتر) مسحوبتان
revoke all on function public._oil_since(uuid, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.request_oil_change(numeric, text, text), public.reject_oil_execution(uuid, text), public.cancel_oil_request(uuid, text),
  public.admin_add_oil_change(uuid, numeric, text, boolean, timestamptz, text, text, text) from public, anon;
grant execute on function public.request_oil_change(numeric, text, text), public.reject_oil_execution(uuid, text), public.cancel_oil_request(uuid, text),
  public.admin_add_oil_change(uuid, numeric, text, boolean, timestamptz, text, text, text) to authenticated;
revoke all on function public.request_oil_change(numeric, text), public.send_oil_to_sweater(uuid, text, timestamptz) from public, anon, authenticated;

-- ═══ تحقق بالقراءة بعد B ═══
-- select count(*) from information_schema.columns where table_name='maintenance_requests' and column_name in ('request_shot_url','source','note','since_km','since_days',
--   'interval_km','exec_reject_reason','exec_rejected_at','exec_rejected_by','exec_rejections','cancel_reason','cancelled_at','cancelled_by','cancelled_from');   -- 14
-- select string_agg(status||':'||source||':'||jsonb_array_length(exec_rejections), ',' order by requested_at) from maintenance_requests;   -- sent:biker:0,approved:biker:0,requested:biker:0 (لم تتغير)
-- select has_function_privilege('authenticated','public.request_oil_change(numeric,text,text)','execute'),
--        has_function_privilege('authenticated','public.request_oil_change(numeric,text)','execute'),
--        has_function_privilege('authenticated','public.send_oil_to_sweater(uuid,text,timestamp with time zone)','execute'),
--        has_function_privilege('authenticated','public._oil_since(uuid,numeric,timestamp with time zone)','execute'),
--        has_function_privilege('anon','public.cancel_oil_request(uuid,text)','execute');   -- t, f, f, f, f
-- select proname, prosecdef from pg_proc where proname in ('request_oil_change','confirm_oil_change','reject_oil_execution','cancel_oil_request','admin_add_oil_change','_oil_since');  -- 7 صفوف، كلها t
-- select count(*) from fleet_alerts();   -- بجلسة المالك: لا خطأ

-- ═══ تراجع ═══
-- (عبر الأداة) يغلق الجديد ويعيد القديم:
--   revoke execute on function public.request_oil_change(numeric,text,text), public.reject_oil_execution(uuid,text), public.cancel_oil_request(uuid,text),
--     public.admin_add_oil_change(uuid,numeric,text,boolean,timestamptz,text,text,text) from authenticated;
--   ثم إعادة تعريف request_oil_change(numeric,text) و confirm_oil_change و fleet_alerts() من docs/sql/fleet_requests.sql (2.7 و2.8 و2.13)،
--   و grant execute on function public.request_oil_change(numeric,text), public.send_oil_to_sweater(uuid,text,timestamptz) to authenticated;
--   الطلبات الملغاة تبقى بحالة cancelled (تُعاد يدوياً بـ cancelled_from إن لزم).
-- (من SQL Editor، بعد ألا يبقى صف cancelled) الأعمدة الجديدة وقيد الحالة:
--   alter table public.maintenance_requests drop column if exists request_shot_url, drop column if exists source, drop column if exists note, … ;
--   drop function if exists public.request_oil_change(numeric,text,text), public.reject_oil_execution(uuid,text), public.cancel_oil_request(uuid,text),
--     public.admin_add_oil_change(uuid,numeric,text,boolean,timestamptz,text,text,text), public._oil_since(uuid,numeric,timestamptz);
