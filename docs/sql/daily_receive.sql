-- الاستلام اليومي من مندوب سويتر — الجداول والسياسات والتخزين والتنبيهات
-- الحالة: طُبِّق على الإنتاج (cnmggdrlkgsyrjxmvydv) بموافقة المالك في 2026-10-03 — لا تُعد تشغيله.
--
-- البايكر = حساب app_users نشط مرتبط برقم سويتر (my_biker_id) ← employees عبر my_employee_uuid() (موجودة من academy.sql).
-- البايكرز النشطون للتوزيع = موظفون برقم سويتر لهم حساب app_users نشط (position biker/team_leader أو فارغ)
--   ومشمولون بالتوزيع (app_users.in_daily_split) ومن نفس مشغّل المستلم (employees.operator_id) — الدالة daily_team().
-- صلاحية المشرف: الجولات الميدانية (field_rounds) أو سلاسل الإمداد (supply) — قراءة للمتابعة، وتعديل (can_edit) للتسويات والمندوبين.
--   has_perm تُرجع true للمالك تلقائياً.
-- لا سياسات حذف على أي جدول؛ التحديث محصور بأعمدة محددة عبر صلاحيات الأعمدة.
-- العهدة الدائمة (custody_assets و sc_*) لا تُمس.

-- ── الجداول (كما في الأمر) ──
create table public.daily_items (
  key text primary key, name_ar text not null, name_bn text,
  kind text not null check (kind in ('addon','towel','consumable')),
  sort int not null default 0, active boolean not null default true);

create table public.sweater_couriers (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid, name text not null, phone text not null,
  active boolean not null default true,
  created_by uuid, created_at timestamptz not null default now(),
  unique (operator_id, phone));

create table public.daily_deliveries (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid,
  received_by uuid not null references public.employees(id),
  courier_id uuid not null references public.sweater_couriers(id),
  received_at timestamptz not null,           -- وقت الاستلام كما أدخله المستلم
  towels_returned int not null default 0,
  photos jsonb not null default '[]',         -- مسارات في bucket
  note text,
  status text not null default 'received' check (status in ('received','distributed')),
  created_at timestamptz not null default now());

create table public.daily_delivery_lines (
  delivery_id uuid not null references public.daily_deliveries(id) on delete cascade,
  item_key text not null references public.daily_items(key),
  qty int not null check (qty >= 0),
  primary key (delivery_id, item_key));

create table public.daily_shares (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.daily_deliveries(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  item_key text not null references public.daily_items(key),
  qty int not null check (qty >= 0),
  status text not null default 'pending' check (status in ('pending','confirmed','short')),
  qty_actual int, note text, confirmed_at timestamptz,
  unique (delivery_id, employee_id, item_key));

create table public.daily_adjustments (       -- صرف/تسوية/فاقد
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  item_key text not null references public.daily_items(key),
  delta int not null, reason text not null,
  created_by uuid, created_at timestamptz not null default now());

create index on public.daily_deliveries (received_at desc);
create index on public.daily_shares (employee_id, status);
create index on public.daily_adjustments (employee_id);

-- قيود إضافية
alter table public.daily_deliveries add constraint daily_deliveries_towels_ck check (towels_returned >= 0);
alter table public.daily_deliveries add constraint daily_deliveries_photos_ck check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) between 1 and 4);
alter table public.daily_shares add constraint daily_shares_actual_ck check (qty_actual is null or (qty_actual >= 0 and qty_actual <= qty));
alter table public.sweater_couriers add constraint sweater_couriers_phone_ck check (phone ~ '^05[0-9]{8}$');

-- ── الأصناف المبدئية ──
-- name_en للقسم الإنجليزي في رسائل واتساب (فارغ ⇒ يُستعمل الاسم العربي)
alter table public.daily_items add column name_en text;
insert into public.daily_items (key, name_ar, name_bn, name_en, kind, sort) values
  ('freshener',   'فواحة',                  'এয়ার ফ্রেশনার',            'Air freshener',            'addon', 1),
  ('mat',         'دعاسة (قطعتين)',         'পা-দানি (২ পিস)',           'Floor mat (2 pcs)',        'addon', 2),
  ('tissue',      'مناديل',                 'টিস্যু',                    'Tissues',                  'addon', 3),
  ('seat_cover',  'غطاء مقعد سيارة',        'সিট কভার',                  'Seat cover',               'addon', 4),
  ('wet_wipes',   'مناديل مبللة',           'ভেজা টিস্যু',               'Wet wipes',                'addon', 5),
  -- الوحدة هي الربطة (ربطة واحدة لكل غسلة)، لا المنشفة بالحبة
  ('towel_clean', 'ربطة مناشف (لكل غسلة)',  'তোয়ালে বান্ডেল (প্রতি ওয়াশ)', 'Towel bundle (per wash)',  'towel', 6);

-- ── تتبّع إرسال رسالتي واتساب (أول ضغطة هي المسجَّلة) ──
alter table public.daily_deliveries
  add column shared_sweater_at timestamptz,
  add column shared_ops_at timestamptz;

-- يضبط العمود المقابل على now() فقط إن كان فارغاً، وللمستلم نفسه فقط، ولا يمس أي عمود آخر.
-- لا update مباشر على العمودين: صلاحية العمود status وحدها تبقى كما هي.
create or replace function public.mark_daily_shared(p_delivery uuid, p_kind text)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  if p_kind not in ('sweater', 'ops') then raise exception 'invalid kind'; end if;
  if p_kind = 'sweater' then
    update public.daily_deliveries set shared_sweater_at = now()
      where id = p_delivery and received_by = public.my_employee_uuid() and shared_sweater_at is null;
  else
    update public.daily_deliveries set shared_ops_at = now()
      where id = p_delivery and received_by = public.my_employee_uuid() and shared_ops_at is null;
  end if;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.mark_daily_shared(uuid, text) from public, anon;
grant execute on function public.mark_daily_shared(uuid, text) to authenticated;

-- ── دوال مساعدة ──
create or replace function public.daily_staff(p_edit boolean default false)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.has_perm('field_rounds', p_edit) or public.has_perm('supply', p_edit)
$$;

create or replace function public.my_operator_id()
returns uuid language sql stable security definer set search_path to 'public' as $$
  select e.operator_id from public.employees e where e.id = public.my_employee_uuid()
$$;

-- المشمولون بالتوزيع: المتدرب المرافق يُستبعد من القسمة (false) ويبقى قادراً على تسجيل استلام
alter table public.app_users add column in_daily_split boolean not null default true;
update public.app_users set in_daily_split = false where btrim(biker_employee_id) = '2637651411';  -- Abed mia: متدرب مرافق

-- البايكرز النشطون المشمولون بالتوزيع في مشغّل المستدعي؛ البايكر لا يقرأ employees لغيره فتُعرض الأسماء عبر هذه الدالة فقط
create or replace function public.daily_team()
returns table (id uuid, full_name text, employee_id text)
language sql stable security definer set search_path to 'public' as $$
  select e.id, e.full_name, e.employee_id
  from public.employees e
  join public.app_users au on btrim(au.biker_employee_id) = e.employee_id
  where au.active and au.in_daily_split and coalesce(au.position, 'biker') in ('biker', 'team_leader')
    and coalesce(e.staff_role, '') <> 'manager'
    and e.operator_id is not distinct from public.my_operator_id()
    and public.my_employee_uuid() is not null
  order by e.full_name
$$;

-- قائمة البايكرز وحالة شمولهم (للمالك والمشرف فقط)
create or replace function public.daily_split_list()
returns table (id uuid, full_name text, employee_id text, operator_id uuid, in_daily_split boolean)
language sql stable security definer set search_path to 'public' as $$
  select e.id, e.full_name, e.employee_id, e.operator_id, au.in_daily_split
  from public.employees e
  join public.app_users au on btrim(au.biker_employee_id) = e.employee_id
  where public.daily_staff() and au.active and coalesce(au.position, 'biker') in ('biker', 'team_leader')
    and coalesce(e.staff_role, '') <> 'manager'
  order by e.full_name
$$;

-- تشغيل/إيقاف الشمول: تتحقق من daily_staff(true) وتغيّر in_daily_split فقط
create or replace function public.set_daily_split(p_employee uuid, p_on boolean)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  if not public.daily_staff(true) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_on is null then raise exception 'p_on is required'; end if;
  update public.app_users au set in_daily_split = p_on
  from public.employees e
  where e.id = p_employee and btrim(au.biker_employee_id) = e.employee_id;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.daily_staff(boolean), public.my_operator_id(), public.daily_team(), public.daily_split_list(), public.set_daily_split(uuid, boolean) from public, anon;
grant execute on function public.daily_staff(boolean), public.my_operator_id(), public.daily_team(), public.daily_split_list(), public.set_daily_split(uuid, boolean) to authenticated;

-- قيد الخادم على وقت الاستلام: لا مستقبل (بسماحية دقيقتين لفرق ساعة الجهاز) ولا أقدم من 12 ساعة
create or replace function public.daily_deliveries_check()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.received_at > now() + interval '2 minutes' then raise exception 'received_at in the future'; end if;
  if new.received_at < now() - interval '12 hours' then raise exception 'received_at older than 12 hours'; end if;
  return new;
end $$;
create trigger daily_deliveries_check before insert on public.daily_deliveries
  for each row execute function public.daily_deliveries_check();

-- ── RLS ──
alter table public.daily_items          enable row level security;
alter table public.sweater_couriers     enable row level security;
alter table public.daily_deliveries     enable row level security;
alter table public.daily_delivery_lines enable row level security;
alter table public.daily_shares         enable row level security;
alter table public.daily_adjustments    enable row level security;

-- الأصناف: قراءة لكل مسجَّل؛ كتابة للمالك
create policy p_ditem_sel on public.daily_items for select to authenticated using (true);
create policy p_ditem_own on public.daily_items for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- المندوبون: قراءة وإدراج لكل مسجَّل؛ تحديث للمالك والمشرف
create policy p_dcour_sel on public.sweater_couriers for select to authenticated using (true);
create policy p_dcour_ins on public.sweater_couriers for insert to authenticated
  with check (created_by = auth.uid() and (operator_id is not distinct from public.my_operator_id() or public.daily_staff(true)));
create policy p_dcour_upd on public.sweater_couriers for update to authenticated
  using (public.daily_staff(true)) with check (public.daily_staff(true));

-- التسليمات: القراءة لبايكرز المشغّل نفسه وللمالك والمشرف؛ الإدراج للمستلم نفسه؛ تحديث status فقط إلى distributed
create policy p_ddel_sel on public.daily_deliveries for select to authenticated
  using (public.daily_staff() or (public.my_employee_uuid() is not null and operator_id is not distinct from public.my_operator_id()));
create policy p_ddel_ins on public.daily_deliveries for insert to authenticated
  with check (received_by = public.my_employee_uuid() and operator_id is not distinct from public.my_operator_id() and status = 'received');
create policy p_ddel_upd on public.daily_deliveries for update to authenticated
  using (received_by = public.my_employee_uuid() and status = 'received')
  with check (received_by = public.my_employee_uuid() and status = 'distributed');
revoke update on public.daily_deliveries from authenticated, anon;
grant update (status) on public.daily_deliveries to authenticated;

-- أسطر التسليم: القراءة تتبع التسليم؛ الإدراج للمستلم قبل التوزيع
create policy p_dline_sel on public.daily_delivery_lines for select to authenticated
  using (exists (select 1 from public.daily_deliveries d where d.id = delivery_id));
create policy p_dline_ins on public.daily_delivery_lines for insert to authenticated
  with check (exists (select 1 from public.daily_deliveries d where d.id = delivery_id
    and d.received_by = public.my_employee_uuid() and d.status = 'received'));
revoke update on public.daily_delivery_lines from authenticated, anon;

-- الأنصبة: الإدراج للمستلم صاحب التسليم (لبايكرز مشغّله، ونصيبه وحده يُعتمد تلقائياً)؛
-- القراءة لصاحب النصيب والمستلم والمالك والمشرف؛ التحديث لصاحب النصيب مرة واحدة من pending وعلى أعمدة التأكيد فقط
create policy p_dshare_ins on public.daily_shares for insert to authenticated
  with check (
    exists (select 1 from public.daily_deliveries d where d.id = delivery_id and d.received_by = public.my_employee_uuid() and d.status = 'received')
    and employee_id in (select t.id from public.daily_team() t)
    and (status = 'pending' or (status = 'confirmed' and employee_id = public.my_employee_uuid()))
    and qty_actual is null);
create policy p_dshare_sel on public.daily_shares for select to authenticated
  using (employee_id = public.my_employee_uuid() or public.daily_staff()
    or exists (select 1 from public.daily_deliveries d where d.id = delivery_id and d.received_by = public.my_employee_uuid()));
create policy p_dshare_upd on public.daily_shares for update to authenticated
  using (employee_id = public.my_employee_uuid() and status = 'pending')
  with check (employee_id = public.my_employee_uuid() and status in ('confirmed', 'short'));
revoke update on public.daily_shares from authenticated, anon;
grant update (status, qty_actual, note, confirmed_at) on public.daily_shares to authenticated;

-- الصرف والتسويات: إدراج وقراءة للمالك والمشرف؛ البايكر يقرأ صفوفه
create policy p_dadj_sel on public.daily_adjustments for select to authenticated
  using (employee_id = public.my_employee_uuid() or public.daily_staff());
create policy p_dadj_ins on public.daily_adjustments for insert to authenticated
  with check (public.daily_staff(true) and created_by = auth.uid());

-- ── التخزين: bucket خاص daily-receipts (صور فقط، حد 5MB) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('daily-receipts', 'daily-receipts', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

-- الرفع لكل مسجَّل داخل مسار {delivery_id}/… (تُرفع الصور قبل حفظ التسليم بمعرّف يولّده الجهاز)
create policy p_dreceipt_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'daily-receipts' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$');
-- القراءة (روابط موقّعة) لمن يرى التسليم نفسه، أو للمالك والمشرف
create policy p_dreceipt_sel on storage.objects for select to authenticated
  using (bucket_id = 'daily-receipts' and (public.daily_staff()
    or exists (select 1 from public.daily_deliveries d where d.id::text = (storage.foldername(name))[1])));

-- ── تنبيهات المالك ──
create or replace function public.daily_notify_delivery()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_who text; v_cour text; v_h int;
begin
  select full_name into v_who from public.employees where id = new.received_by;
  select name || ' · ' || phone into v_cour from public.sweater_couriers where id = new.courier_id;
  v_h := extract(hour from new.received_at at time zone 'Asia/Riyadh');
  insert into public.notifications (icon, title, body, type, audience, category, severity, module, entity_id, dedupe_key)
  values ('📦', 'استلام يومي جديد من مندوب سويتر',
    coalesce(v_who, '—') || ' استلم الساعة ' || to_char(new.received_at at time zone 'Asia/Riyadh', 'HH24:MI') || ' من ' || coalesce(v_cour, '—')
      || case when v_h >= 23 or v_h < 8 then ' · متأخر' else '' end,
    'daily', 'owner', 'supply', case when v_h >= 23 or v_h < 8 then 'warn' else 'info' end, 'daily', new.id::text, 'daily-del-' || new.id)
  on conflict (dedupe_key) do nothing;
  return new;
end $$;
create trigger daily_notify_delivery after insert on public.daily_deliveries
  for each row execute function public.daily_notify_delivery();

create or replace function public.daily_notify_short()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_who text;
begin
  if new.status = 'short' and old.status = 'pending' then
    select full_name into v_who from public.employees where id = new.employee_id;
    insert into public.notifications (icon, title, body, type, audience, category, severity, module, entity_id, dedupe_key)
    values ('⚠️', 'بلاغ «ناقص» في الاستلام اليومي',
      coalesce(v_who, '—') || ' أبلغ أن نصيبه ناقص' || coalesce(' — ' || nullif(new.note, ''), ''),
      'daily', 'owner', 'supply', 'warn', 'daily', new.delivery_id::text, 'daily-short-' || new.delivery_id || '-' || new.employee_id)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end $$;
create trigger daily_notify_short after update on public.daily_shares
  for each row execute function public.daily_notify_short();
