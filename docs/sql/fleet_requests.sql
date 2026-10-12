-- ═══ طلبات الوقود وتغيير الزيت من بوابة الدرّاج + «تنبيهات الأسطول» (المرحلة 2، الخطوة 1: القاعدة فقط) ═══
-- المشروع: cnmggdrlkgsyrjxmvydv · التصميم: docs/design/fleet_requests.md (#65، وافق عليه المالك 2026-10-12)
-- الحالة: **طُبِّق 2026-10-12** بأمر المالك:
--   القسمان 1 و2 عبر apply_migration (fleet_requests_tables_and_functions، النسخة 20261012141852) ثم تحقق بالقراءة: 3 جداول، RLS مفعّل،
--   الحدود التسعة، 13 دالة security definer، anon بلا تنفيذ ولا قراءة، المسجّل بلا كتابة مباشرة ولا legacy/request_id، 4 سياسات، 3 مشغّلات تدقيق.
--   ثم القسم 3 (بتعديل المالك: صف عابد التجريبي ضمن legacy بدل حذفه) في معاملة محروسة: 8 صفوف بالضبط.
--   الواجهة (البوابة + اللوحة) في PR منفصل لاحق.
--
-- قرارات المالك 2026-10-12:
--   1) الطلب يُغلق تلقائياً عند الطلب التالي للدراجة نفسها.
--   2) الحدود الافتراضية كما في المذكرة، وتُراجع بعد شهر من البيانات؛ oil_interval_km = 2000 مؤقتاً حتى يصل جدول سويتر.
--   3) الصور تبقى في field-evidence (نقل الفواتير لحاوية خاصة بند أمان مستقل لاحقاً).
--   4) صفوف fuel_logs السبعة المدفوعة تبقى تاريخاً بعلامة legacy تستبعدها من التحليل — لا نقل. تقسيم صف ميدول يرسله المالك لاحقاً.
--   5) إشعار «طلب جديد» لكل من له fleet_alerts تعديل، والمالك دائماً.
--
-- المبادئ:
--   • لا منع ولا رسائل للدرّاج: الطلب يُقبل دائماً؛ الرفض فقط لنقص حقل إلزامي (عدّاد، صورة، مبلغ > 0) أو لعدم وجود دراجة مخصّصة.
--     لا تُعاد للدرّاج أي قيمة تحليلية، ولا يصله أي إشعار تحليلي (يصله فقط «حُوِّل» و«أُرسل لسويتر»).
--   • الدرّاج لا يكتب في الجداول الجديدة مباشرة: الإنشاء والتأكيد عبر دوال security definer تشتق الهوية (my_biker_id)
--     والدراجة (_fleet_my_vehicle، بنفس قاعدة البوابة: الحائز المؤقت، أو المخصّصة بلا حائز) — لا يُرسل الدرّاج biker_employee_id ولا vehicle_id.
--   • انتقالات الإدارة (تحويل، أُرسل لسويتر، اعتماد، ضبط الحدود) تفحص has_perm('fleet_alerts', true) — المالك يمرّ دائماً.
--   • التنبيهات تُحسب عند الطلب بدالة fleet_alerts() (لا جدول تنبيهات)، لكل دراجة لا لكل درّاج، وتستبعد صفوف legacy.
--   • الهوية: fuel_logs/fuel_requests/maintenance_requests.biker_employee_id نص = employees.employee_id = my_biker_id();
--     fleet_vehicles.biker_employee_id / held_by = employees.id = my_employee_uuid().
--
-- وقائع مقروءة من الإنتاج 2026-10-12 قبل الكتابة:
--   fuel_logs: 8 صفوف (7 paid يدوية بلا عدّاد ولا vehicle_id، وصف عابد التجريبي petrol بـ0﷼ وعدّاد 24)، RLS بأربع سياسات، و«anon» له كل الصلاحيات
--     على مستوى الجدول (السياسات تمنعه فعلياً لأن my_biker_id() فارغ له) ⇒ يُسحب هنا (revoke) لأن الجدول يُعدَّل في هذا الملف.
--   fleet_vehicles: 6 مركبات (5 نشطة، 4 مخصّصة، لا تخصيص مكرر). user_permissions: لا وحدة fleet_alerts بعد. notifications: audience 'user' + user_id مدعوم.

-- ═══ 1) الجداول والأعمدة والصلاحيات ═══

-- 1.1 طلب الوقود: مطلوب ← حُوِّل ← مُغلق (تلقائياً عند الطلب التالي للدراجة)
create table if not exists public.fuel_requests (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid,
  vehicle_id uuid not null references public.fleet_vehicles(id),
  plate text,
  biker_employee_id text not null,
  biker_name text,
  odometer numeric not null check (odometer >= 0),
  odometer_photo_url text not null check (length(odometer_photo_url) between 1 and 1000),
  amount numeric not null default 50 check (amount > 0),
  status text not null default 'requested' check (status in ('requested', 'transferred', 'closed')),
  requested_at timestamptz not null default now(),
  transfer_ref text check (length(transfer_ref) <= 200),
  transferred_at timestamptz,
  transferred_by uuid,
  closed_at timestamptz,
  created_by uuid
);
create index if not exists fuel_requests_vehicle_idx on public.fuel_requests (vehicle_id, requested_at);
create index if not exists fuel_requests_biker_idx on public.fuel_requests (biker_employee_id, requested_at desc);

-- 1.2 التعبئات: fuel_logs يبقى سجلها، ويُربط بالطلب. legacy = تاريخ يدوي قبل البوابة، مستبعد من التحليل.
alter table public.fuel_logs add column if not exists request_id uuid references public.fuel_requests(id);
alter table public.fuel_logs add column if not exists legacy boolean not null default false;
create index if not exists fuel_logs_request_idx on public.fuel_logs (request_id);
create index if not exists fuel_logs_vehicle_idx on public.fuel_logs (vehicle_id, fill_at);
revoke all on public.fuel_logs from anon;
-- الكتابة المباشرة في fuel_logs (الشاشة الحالية تُدرج مباشرة) تبقى لكل الأعمدة القديمة، ولا تشمل legacy و request_id:
-- لا يعلّم الدرّاج تعبئته «قديمة» فتختفي من التحليل، ولا يربطها بطلب غيره. الربط عبر add_fuel_fill، والعلامة عبر القسم 3.
revoke insert, update on public.fuel_logs from authenticated;
grant insert (id, operator_id, vehicle_id, plate, biker_employee_id, biker_name, fuel_type, fill_at, odometer, liters, amount,
              odometer_photo_url, receipt_photo_url, notes, status, reviewed_by, reviewed_at, created_by, created_at),
      update (operator_id, vehicle_id, plate, biker_employee_id, biker_name, fuel_type, fill_at, odometer, liters, amount,
              odometer_photo_url, receipt_photo_url, notes, status, reviewed_by, reviewed_at)
  on public.fuel_logs to authenticated;
-- صاحب «تنبيهات الأسطول» يرى التعبئات (فواتيرها وصورها) التي تشير إليها التنبيهات — إضافة سياسة قراءة فقط
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fuel_logs' and policyname = 'fl_sel_fleet_alerts') then
    create policy fl_sel_fleet_alerts on public.fuel_logs for select to authenticated using (public.has_perm('fleet_alerts'));
  end if;
end $$;

-- 1.3 طلبات الصيانة (تغيير الزيت الآن): مطلوب ← أُرسل لسويتر ← نُفّذ ← معتمد. المعتمد منها = سجل صيانة الدراجة.
create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid,
  vehicle_id uuid not null references public.fleet_vehicles(id),
  plate text,
  biker_employee_id text not null,
  biker_name text,
  kind text not null default 'oil_change' check (kind in ('oil_change')),
  status text not null default 'requested' check (status in ('requested', 'sent', 'done', 'approved')),
  odometer numeric not null check (odometer >= 0),
  odometer_photo_url text not null check (length(odometer_photo_url) between 1 and 1000),
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_channel text check (sent_channel in ('sweater_portal', 'whatsapp', 'call', 'other')),
  sent_by uuid,
  done_at timestamptz,
  done_odometer numeric check (done_odometer >= 0),
  done_odometer_photo_url text check (length(done_odometer_photo_url) <= 1000),
  done_proof_url text check (length(done_proof_url) <= 1000),          -- الفاتورة أو ملصق الزيت
  sweater_tech_name text check (length(sweater_tech_name) <= 120),     -- اسم مسؤول الصيانة في سويتر
  approved_at timestamptz,
  approved_by uuid,
  approve_note text check (length(approve_note) <= 1000),
  created_by uuid
);
create index if not exists maintenance_requests_vehicle_idx on public.maintenance_requests (vehicle_id, requested_at);
create index if not exists maintenance_requests_biker_idx on public.maintenance_requests (biker_employee_id, requested_at desc);

-- 1.4 حدود التنبيهات: صف عام (vehicle_id فارغ) + تجاوز اختياري لكل دراجة
create table if not exists public.fleet_alert_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key in ('fuel_low_pct', 'fuel_min_km_per_50', 'fill_gap_km', 'fill_gap_hours', 'receipt_grace_days',
                                   'odo_max_km_per_day', 'oil_interval_km', 'oil_exec_days', 'fuel_price_91')),
  vehicle_id uuid references public.fleet_vehicles(id),
  value numeric check (value is null or value > 0),    -- فارغ في صف دراجة = «يرث العام»
  note text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  check (vehicle_id is not null or value is not null),
  check (key <> 'fuel_low_pct' or value is null or value < 100)
);
create unique index if not exists fleet_alert_settings_key_uq on public.fleet_alert_settings (key, coalesce(vehicle_id, '00000000-0000-0000-0000-000000000000'::uuid));
insert into public.fleet_alert_settings (key, value, note) values
  ('fuel_low_pct',       25,   'استهلاك عالٍ: كم/50﷼ أقل من متوسط آخر 3 طلبات للدراجة بهذه النسبة ⇒ فحص صيانة مقترح'),
  ('fuel_min_km_per_50',  600,  'استهلاك عالٍ قبل اكتمال 3 طلبات: أقل من هذا (كم لكل 50﷼). المرجع: بوكسر 150، 50﷼ ≈ 23 لتر ≈ 800–1000 كم'),
  ('fill_gap_km',         150,  'تعبئتان متقاربتان: فرق العدّاد أقل من هذا'),
  ('fill_gap_hours',      12,   'تعبئتان متقاربتان: الفرق الزمني أقل من هذا'),
  ('receipt_grace_days',  5,    'طلب حُوِّل بلا أي تعبئة بعد هذه الأيام'),
  ('odo_max_km_per_day',  400,  'قفزة عدّاد غير منطقية: أكثر من هذا يومياً'),
  ('oil_interval_km',     2000, 'استحقاق تغيير الزيت منذ آخر تغيير معتمد — مؤقت حتى يصل جدول صيانة سويتر'),
  ('oil_exec_days',       5,    'طلب زيت لم يُنفَّذ بعد هذه الأيام'),
  ('fuel_price_91',       2.18, 'سعر لتر بنزين 91 (للعرض والحساب)')
on conflict do nothing;

-- 1.5 RLS: القراءة فقط بالسياسات، والكتابة عبر الدوال (لا سياسات كتابة ⇒ الكتابة المباشرة ممنوعة)
-- السياسات تُنشأ إن لم توجد (بلا إعادة إنشاء: أداة MCP تتعطل على أوامر الحذف)
alter table public.fuel_requests enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.fleet_alert_settings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fuel_requests' and policyname = 'fr_sel') then
    create policy fr_sel on public.fuel_requests for select to authenticated
      using (biker_employee_id = public.my_biker_id() or public.has_perm('fleet_alerts'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'maintenance_requests' and policyname = 'mr_sel') then
    create policy mr_sel on public.maintenance_requests for select to authenticated   -- «الأسطول» يرى سجل الصيانة على بطاقة الدراجة
      using (biker_employee_id = public.my_biker_id() or public.has_perm('fleet_alerts') or public.has_perm('fleet'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fleet_alert_settings' and policyname = 'fas_sel') then
    create policy fas_sel on public.fleet_alert_settings for select to authenticated using (public.has_perm('fleet_alerts'));
  end if;
end $$;
revoke all on public.fuel_requests, public.maintenance_requests, public.fleet_alert_settings from anon, authenticated;
grant select on public.fuel_requests, public.maintenance_requests, public.fleet_alert_settings to authenticated;

-- 1.6 السجل التدقيقي (audit_capture موجودة ومستعملة على fuel_logs) للإدراج والتعديل. لا أحد يملك الإزالة من هذه الجداول
--     (لا صلاحية ولا دالة)، فتدقيق الإزالة غير لازم — وكلمتها تعطّل أداة MCP.
create or replace trigger trg_audit_fuel_requests after insert or update on public.fuel_requests for each row execute function public.audit_capture();
create or replace trigger trg_audit_maintenance_requests after insert or update on public.maintenance_requests for each row execute function public.audit_capture();
create or replace trigger trg_audit_fleet_alert_settings after insert or update on public.fleet_alert_settings for each row execute function public.audit_capture();

-- ═══ 2) الدوال ═══

-- 2.1 دراجة الدرّاج الحالية (نفس قاعدة BikerPortal): الحائز المؤقت، أو المخصّصة له ولا يحوزها أحد
create or replace function public._fleet_my_vehicle()
returns public.fleet_vehicles language sql stable security definer set search_path = public as $$
  select v.* from public.fleet_vehicles v
  where v.active and public.my_employee_uuid() is not null
    and (v.held_by = public.my_employee_uuid() or (v.held_by is null and v.biker_employee_id = public.my_employee_uuid()))
  order by (v.held_by = public.my_employee_uuid()) desc nulls last, v.created_at
  limit 1;
$$;

-- 2.2 قيمة حدّ: تجاوز الدراجة إن وُجد، وإلا العام
create or replace function public._fleet_setting(p_key text, p_vehicle uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.fleet_alert_settings where key = p_key and vehicle_id = p_vehicle),
                  (select value from public.fleet_alert_settings where key = p_key and vehicle_id is null));
$$;

-- 2.3 إشعار الإدارة: المالك + كل من له fleet_alerts تعديل (مرة لكل شخص)
create or replace function public._fleet_notify_admins(p_title text, p_body text, p_entity text, p_dedupe text)
returns void language plpgsql security definer set search_path = public as $$
declare u record;
begin
  perform public.push_notification('owner', null, 'fleet', 'info', p_title, p_body, 'fleet_alerts', p_entity, p_dedupe || '-owner');
  for u in select distinct au.id from public.app_users au join public.user_permissions up on up.user_id = au.id
           where au.active and not au.is_owner and up.module = 'fleet_alerts' and up.can_edit loop
    perform public.push_notification('user', u.id, 'fleet', 'info', p_title, p_body, 'fleet_alerts', p_entity, p_dedupe || '-' || u.id);
  end loop;
end $$;

-- 2.4 إشعار الدرّاج (حالة فقط، لا تحليل)
create or replace function public._fleet_notify_biker(p_biker text, p_title text, p_body text, p_entity text, p_dedupe text)
returns void language plpgsql security definer set search_path = public as $$
declare u record;
begin
  for u in select id from public.app_users where active and btrim(biker_employee_id) = p_biker loop
    perform public.push_notification('user', u.id, 'fleet', 'info', p_title, p_body, 'fuel', p_entity, p_dedupe || '-' || u.id);
  end loop;
end $$;

-- 2.5 الدرّاج: طلب وقود. يُقبل دائماً؛ ويغلق الطلبات «المحوَّلة» السابقة للدراجة نفسها.
create or replace function public.request_fuel(p_odometer numeric, p_odometer_photo_url text, p_amount numeric default 50)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.fleet_vehicles; v_bid text := public.my_biker_id(); v_name text; v_id uuid;
begin
  if v_bid is null then raise exception 'NOT_A_BIKER'; end if;
  v := public._fleet_my_vehicle();
  if v.id is null then raise exception 'NO_BIKE'; end if;
  if p_odometer is null or p_odometer < 0 then raise exception 'ODOMETER_REQUIRED'; end if;
  if coalesce(btrim(p_odometer_photo_url), '') = '' or length(p_odometer_photo_url) > 1000 then raise exception 'PHOTO_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'AMOUNT_REQUIRED'; end if;
  select full_name into v_name from public.employees where id = public.my_employee_uuid();
  update public.fuel_requests set status = 'closed', closed_at = now() where vehicle_id = v.id and status = 'transferred';
  insert into public.fuel_requests (operator_id, vehicle_id, plate, biker_employee_id, biker_name, odometer, odometer_photo_url, amount, created_by)
  values (v.operator_id, v.id, v.plate, v_bid, v_name, p_odometer, btrim(p_odometer_photo_url), p_amount, auth.uid())
  returning id into v_id;
  perform public._fleet_notify_admins('طلب وقود جديد — ' || coalesce(v.plate, '—'),
    coalesce(v_name, v_bid) || ' · ' || to_char(p_amount, 'FM999990.##') || ' ﷼ · العدّاد ' || to_char(p_odometer, 'FM99999990'),
    v_id::text, 'fuel-req-' || v_id);
  return v_id;
end $$;

-- 2.6 الدرّاج: تعبئة (فاتورة + عدّاد). تُربط بآخر تحويل للدراجة إن وُجد، وإلا تُقبل بلا طلب.
create or replace function public.add_fuel_fill(p_odometer numeric, p_amount numeric, p_liters numeric,
  p_odometer_photo_url text, p_receipt_photo_url text, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.fleet_vehicles; v_bid text := public.my_biker_id(); v_name text; v_req uuid; v_id uuid;
begin
  if v_bid is null then raise exception 'NOT_A_BIKER'; end if;
  v := public._fleet_my_vehicle();
  if v.id is null then raise exception 'NO_BIKE'; end if;
  if p_odometer is null or p_odometer < 0 then raise exception 'ODOMETER_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'AMOUNT_REQUIRED'; end if;
  if coalesce(btrim(p_odometer_photo_url), '') = '' or coalesce(btrim(p_receipt_photo_url), '') = ''
     or length(p_odometer_photo_url) > 1000 or length(p_receipt_photo_url) > 1000 then raise exception 'PHOTO_REQUIRED'; end if;
  if p_liters < 0 then raise exception 'BAD_LITERS'; end if;
  if length(p_notes) > 1000 then raise exception 'NOTES_TOO_LONG'; end if;
  select full_name into v_name from public.employees where id = public.my_employee_uuid();
  -- تُربط بآخر مبلغ حُوِّل للدراجة (محوَّل أو مُغلق بطلب أحدث لم يُحوَّل بعد): المال المصروف هو آخر تحويل
  select id into v_req from public.fuel_requests where vehicle_id = v.id and transferred_at is not null order by transferred_at desc, requested_at desc limit 1;
  insert into public.fuel_logs (operator_id, vehicle_id, plate, biker_employee_id, biker_name, fuel_type, odometer, amount, liters,
                                odometer_photo_url, receipt_photo_url, notes, created_by, request_id)
  values (v.operator_id, v.id, v.plate, v_bid, v_name, 'petrol', p_odometer, p_amount, nullif(p_liters, 0),
          btrim(p_odometer_photo_url), btrim(p_receipt_photo_url), nullif(btrim(p_notes), ''), auth.uid(), v_req)
  returning id into v_id;
  return v_id;
end $$;

-- 2.7 الدرّاج: طلب تغيير زيت. يُقبل دائماً.
create or replace function public.request_oil_change(p_odometer numeric, p_odometer_photo_url text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.fleet_vehicles; v_bid text := public.my_biker_id(); v_name text; v_id uuid;
begin
  if v_bid is null then raise exception 'NOT_A_BIKER'; end if;
  v := public._fleet_my_vehicle();
  if v.id is null then raise exception 'NO_BIKE'; end if;
  if p_odometer is null or p_odometer < 0 then raise exception 'ODOMETER_REQUIRED'; end if;
  if coalesce(btrim(p_odometer_photo_url), '') = '' or length(p_odometer_photo_url) > 1000 then raise exception 'PHOTO_REQUIRED'; end if;
  select full_name into v_name from public.employees where id = public.my_employee_uuid();
  insert into public.maintenance_requests (operator_id, vehicle_id, plate, biker_employee_id, biker_name, odometer, odometer_photo_url, created_by)
  values (v.operator_id, v.id, v.plate, v_bid, v_name, p_odometer, btrim(p_odometer_photo_url), auth.uid())
  returning id into v_id;
  perform public._fleet_notify_admins('طلب تغيير زيت — ' || coalesce(v.plate, '—'),
    coalesce(v_name, v_bid) || ' · العدّاد ' || to_char(p_odometer, 'FM99999990'), v_id::text, 'oil-req-' || v_id);
  return v_id;
end $$;

-- 2.8 الدرّاج: تأكيد التنفيذ (صورة العدّاد + الفاتورة أو ملصق الزيت + اسم مسؤول سويتر). من «مطلوب» أو «أُرسل» — لا منع.
create or replace function public.confirm_oil_change(p_id uuid, p_odometer numeric, p_odometer_photo_url text, p_proof_url text, p_tech_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.maintenance_requests;
begin
  select * into r from public.maintenance_requests where id = p_id for update;
  if not found or r.biker_employee_id is distinct from public.my_biker_id() then raise exception 'NOT_FOUND'; end if;
  if r.status not in ('requested', 'sent') then raise exception 'ALREADY_DONE'; end if;
  if p_odometer is null or p_odometer < 0 then raise exception 'ODOMETER_REQUIRED'; end if;
  if coalesce(btrim(p_odometer_photo_url), '') = '' or coalesce(btrim(p_proof_url), '') = ''
     or length(p_odometer_photo_url) > 1000 or length(p_proof_url) > 1000 then raise exception 'PHOTO_REQUIRED'; end if;
  if coalesce(btrim(p_tech_name), '') = '' or length(p_tech_name) > 120 then raise exception 'TECH_NAME_REQUIRED'; end if;
  update public.maintenance_requests set status = 'done', done_at = now(), done_odometer = p_odometer,
    done_odometer_photo_url = btrim(p_odometer_photo_url), done_proof_url = btrim(p_proof_url), sweater_tech_name = btrim(p_tech_name)
  where id = p_id;
  perform public._fleet_notify_admins('نُفّذ تغيير الزيت — ' || coalesce(r.plate, '—'),
    coalesce(r.biker_name, r.biker_employee_id) || ' · بانتظار الاعتماد', p_id::text, 'oil-done-' || p_id);
  return true;
end $$;

-- 2.9 الإدارة: تسجيل التحويل (مرجع إلزامي) ⇒ «حُوِّل»
create or replace function public.transfer_fuel_request(p_id uuid, p_ref text, p_at timestamptz default now())
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.fuel_requests;
begin
  if not public.has_perm('fleet_alerts', true) then raise exception 'FORBIDDEN'; end if;
  select * into r from public.fuel_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'requested' then raise exception 'NOT_REQUESTED'; end if;
  if coalesce(btrim(p_ref), '') = '' or length(p_ref) > 200 then raise exception 'REF_REQUIRED'; end if;
  if p_at is not null and (p_at > now() + interval '1 hour' or p_at < r.requested_at - interval '1 day') then raise exception 'BAD_DATE'; end if;
  update public.fuel_requests set status = 'transferred', transfer_ref = btrim(p_ref), transferred_at = coalesce(p_at, now()), transferred_by = auth.uid()
  where id = p_id;
  perform public._fleet_notify_biker(r.biker_employee_id, 'حُوِّل مبلغ الوقود · জ্বালানির টাকা পাঠানো হয়েছে',
    to_char(r.amount, 'FM999990.##') || ' ﷼ — ارفع فاتورة كل تعبئة · প্রতিটি রিফুয়েলের রসিদ দিন', p_id::text, 'fuel-tr-' || p_id);
  return true;
end $$;

-- 2.10 الإدارة: أُرسل لسويتر (التاريخ والقناة)
create or replace function public.send_oil_to_sweater(p_id uuid, p_channel text, p_at timestamptz default now())
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.maintenance_requests;
begin
  if not public.has_perm('fleet_alerts', true) then raise exception 'FORBIDDEN'; end if;
  if p_channel is null or p_channel not in ('sweater_portal', 'whatsapp', 'call', 'other') then raise exception 'CHANNEL_REQUIRED'; end if;
  select * into r from public.maintenance_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'requested' then raise exception 'NOT_REQUESTED'; end if;
  if p_at is not null and (p_at > now() + interval '1 hour' or p_at < r.requested_at - interval '1 day') then raise exception 'BAD_DATE'; end if;
  update public.maintenance_requests set status = 'sent', sent_at = coalesce(p_at, now()), sent_channel = p_channel, sent_by = auth.uid() where id = p_id;
  perform public._fleet_notify_biker(r.biker_employee_id, 'أُرسل طلب تغيير الزيت لسويتر · তেল পরিবর্তনের অনুরোধ সুইটারে পাঠানো হয়েছে',
    'بعد التنفيذ أكّد من البوابة · কাজ শেষে পোর্টালে নিশ্চিত করুন', p_id::text, 'oil-sent-' || p_id);
  return true;
end $$;

-- 2.11 الإدارة: اعتماد التنفيذ ⇒ يدخل سجل صيانة الدراجة
create or replace function public.approve_oil_change(p_id uuid, p_note text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.maintenance_requests;
begin
  if not public.has_perm('fleet_alerts', true) then raise exception 'FORBIDDEN'; end if;
  if length(p_note) > 1000 then raise exception 'NOTE_TOO_LONG'; end if;
  select * into r from public.maintenance_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'done' then raise exception 'NOT_DONE'; end if;
  update public.maintenance_requests set status = 'approved', approved_at = now(), approved_by = auth.uid(), approve_note = nullif(btrim(p_note), '') where id = p_id;
  return true;
end $$;

-- 2.12 الإدارة: ضبط حدّ (عام أو لدراجة). p_value = null مع دراجة ⇒ يُفرَّغ التجاوز فيرث العام.
create or replace function public.set_fleet_alert_setting(p_key text, p_value numeric, p_vehicle_id uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('fleet_alerts', true) then raise exception 'FORBIDDEN'; end if;
  if p_key is null or p_key not in ('fuel_low_pct', 'fuel_min_km_per_50', 'fill_gap_km', 'fill_gap_hours', 'receipt_grace_days',
                                    'odo_max_km_per_day', 'oil_interval_km', 'oil_exec_days', 'fuel_price_91') then raise exception 'BAD_KEY'; end if;
  -- كل الحدود موجبة (الصفر يعطّل التنبيه أو يطلقه دائماً)، والنسبة أقل من 100
  if (p_vehicle_id is null and p_value is null) or p_value <= 0 or (p_key = 'fuel_low_pct' and p_value >= 100) then raise exception 'BAD_VALUE'; end if;
  insert into public.fleet_alert_settings (key, vehicle_id, value, updated_by) values (p_key, p_vehicle_id, p_value, auth.uid())
  on conflict (key, coalesce(vehicle_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  return true;
end $$;

-- 2.13 لوحة «تنبيهات الأسطول»: التنبيهات المفتوحة محسوبة الآن. لغير صاحب الصلاحية ⇒ لا صفوف.
--   النوافذ: التعبئات والقراءات خلال آخر 30 يوماً؛ الاستهلاك لآخر فترة مكتملة لكل دراجة.
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
        union all select m.vehicle_id, m.plate, 'maintenance_requests', m.id, m.requested_at, m.odometer from public.maintenance_requests m
        union all select m.vehicle_id, m.plate, 'maintenance_requests', m.id, m.done_at, m.done_odometer from public.maintenance_requests m where m.done_odometer is not null
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
                  union all select m.odometer from public.maintenance_requests m where m.vehicle_id = v.id
                  union all select m.done_odometer from public.maintenance_requests m where m.vehicle_id = v.id) y) cur on true
  where v.active and cur.odo - last_oil.odo >= public._fleet_setting('oil_interval_km', v.id)
    and not exists (select 1 from public.maintenance_requests m where m.vehicle_id = v.id and m.kind = 'oil_change' and m.status in ('requested', 'sent', 'done'))

  union all
  -- (8) طلب زيت لم يُنفَّذ خلال المهلة
  select 'oil_overdue', 'warn', m.vehicle_id, m.plate, 'maintenance_requests', m.id, m.requested_at,
         floor(extract(epoch from now() - m.requested_at) / 86400.0), public._fleet_setting('oil_exec_days', m.vehicle_id),
         'طلب تغيير زيت ' || case m.status when 'sent' then 'أُرسل لسويتر' else 'مطلوب' end || ' منذ ' || floor(extract(epoch from now() - m.requested_at) / 86400.0) || ' يوم'
  from public.maintenance_requests m
  where m.status in ('requested', 'sent') and m.requested_at < now() - make_interval(days => public._fleet_setting('oil_exec_days', m.vehicle_id)::int);
end $$;

-- 2.14 الصلاحيات: الدوال المساعدة (_fleet_*) داخلية تماماً؛ العامة للمسجّل فقط (لا anon)
revoke all on function public._fleet_my_vehicle(), public._fleet_setting(text, uuid), public._fleet_notify_admins(text, text, text, text),
  public._fleet_notify_biker(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.request_fuel(numeric, text, numeric), public.add_fuel_fill(numeric, numeric, numeric, text, text, text),
  public.request_oil_change(numeric, text), public.confirm_oil_change(uuid, numeric, text, text, text),
  public.transfer_fuel_request(uuid, text, timestamptz), public.send_oil_to_sweater(uuid, text, timestamptz),
  public.approve_oil_change(uuid, text), public.set_fleet_alert_setting(text, numeric, uuid), public.fleet_alerts() from public, anon;
grant execute on function public.request_fuel(numeric, text, numeric), public.add_fuel_fill(numeric, numeric, numeric, text, text, text),
  public.request_oil_change(numeric, text), public.confirm_oil_change(uuid, numeric, text, text, text),
  public.transfer_fuel_request(uuid, text, timestamptz), public.send_oil_to_sweater(uuid, text, timestamptz),
  public.approve_oil_change(uuid, text), public.set_fleet_alert_setting(text, numeric, uuid), public.fleet_alerts() to authenticated;

-- ═══ 3) بيانات (طُبِّق 2026-10-12 بموافقة مستقلة بعد القسمين 1 و2): علامة legacy ═══
-- الصفوف السبعة المدفوعة يدوياً (status='paid' بلا عدّاد ولا vehicle_id، قبل 2026-10-01) + صف عابد التجريبي (petrol، 0﷼، عدّاد 24، submitted)
-- — قرار المالك: يُعلَّم legacy بدل حذفه ⇒ 8 صفوف بالضبط، وإلا تتراجع المعاملة.
-- do $$ declare n int; begin
--   update public.fuel_logs set legacy = true
--   where not legacy and (
--     (status = 'paid' and odometer is null and vehicle_id is null and fill_at < '2026-10-01')
--     or (fuel_type = 'petrol' and amount = 0 and odometer = 24 and status = 'submitted'));
--   get diagnostics n = row_count;
--   if n <> 8 then raise exception 'المتوقع 8 صفوف، تأثّر %', n; end if;
-- end $$;

-- ═══ تحقق بالقراءة بعد التطبيق ═══
-- select table_name from information_schema.tables where table_schema='public' and table_name in ('fuel_requests','maintenance_requests','fleet_alert_settings');  -- 3
-- select column_name from information_schema.columns where table_name='fuel_logs' and column_name in ('request_id','legacy');  -- 2
-- select relname, relrowsecurity from pg_class where relname in ('fuel_requests','maintenance_requests','fleet_alert_settings');  -- كلها true
-- select key, value from fleet_alert_settings where vehicle_id is null order by key;  -- 9 قيم كما في 1.4
-- select proname, prosecdef from pg_proc where proname in ('request_fuel','add_fuel_fill','request_oil_change','confirm_oil_change','transfer_fuel_request',
--   'send_oil_to_sweater','approve_oil_change','set_fleet_alert_setting','fleet_alerts','_fleet_my_vehicle','_fleet_setting','_fleet_notify_admins','_fleet_notify_biker');  -- 13، كلها t
-- select has_function_privilege('anon','public.request_fuel(numeric,text,numeric)','execute'), has_function_privilege('authenticated','public.request_fuel(numeric,text,numeric)','execute'),
--        has_function_privilege('authenticated','public._fleet_notify_admins(text,text,text,text)','execute');  -- f, t, f
-- select has_table_privilege('anon','public.fuel_logs','select'), has_table_privilege('anon','public.fuel_requests','select'),
--        has_table_privilege('authenticated','public.fuel_requests','insert');  -- f, f, f
-- (بعد القسم 3) select count(*) from fuel_logs where legacy;  -- 8

-- ═══ تراجع (من SQL Editor؛ لا بيانات إنتاجية في الجداول الجديدة قبل إطلاق الواجهة) ═══
-- revoke execute on function public.request_fuel(numeric,text,numeric), public.add_fuel_fill(numeric,numeric,numeric,text,text,text), public.request_oil_change(numeric,text),
--   public.confirm_oil_change(uuid,numeric,text,text,text), public.transfer_fuel_request(uuid,text,timestamptz), public.send_oil_to_sweater(uuid,text,timestamptz),
--   public.approve_oil_change(uuid,text), public.set_fleet_alert_setting(text,numeric,uuid), public.fleet_alerts() from authenticated;   -- يغلق الباب فوراً
-- drop function if exists public.fleet_alerts(), public.set_fleet_alert_setting(text,numeric,uuid), public.approve_oil_change(uuid,text), public.send_oil_to_sweater(uuid,text,timestamptz),
--   public.transfer_fuel_request(uuid,text,timestamptz), public.confirm_oil_change(uuid,numeric,text,text,text), public.request_oil_change(numeric,text),
--   public.add_fuel_fill(numeric,numeric,numeric,text,text,text), public.request_fuel(numeric,text,numeric), public._fleet_notify_biker(text,text,text,text,text),
--   public._fleet_notify_admins(text,text,text,text), public._fleet_setting(text,uuid), public._fleet_my_vehicle();
-- alter table public.fuel_logs drop column if exists request_id, drop column if exists legacy;
-- drop table if exists public.fleet_alert_settings, public.maintenance_requests, public.fuel_requests;
-- (سحب anon من fuel_logs لا يُتراجع عنه: لم يكن له استعمال، والسياسات كانت تمنعه أصلاً)
