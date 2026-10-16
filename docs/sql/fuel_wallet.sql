-- ═══ «رصيد وقود متجدد 50 ﷼» بدل «طلب الوقود» ═══
-- المشروع: cnmggdrlkgsyrjxmvydv · المرجع: دراسة إجراءات الوقود + قرار المالك 2026-10-15
-- الحالة: A **طُبِّق 2026-10-16** (المالك من SQL Editor؛ تحقق YES|YES|true|true) · B **طُبِّق 2026-10-16** (عبر الأداة، معاملة واحدة؛ تحقق: الإعدادات الستة، 13 دالة، الصلاحيات، الأعمدة والفهرسان، لا تعديل بيانات) · C **طُبِّق 2026-10-16** (6 صفوف بالضبط: amount_actual=50، fee=0.58 لخمسة و0 لـ TEST01)
--
-- القرار: البايكر لا يطلب وقوداً. يستلم دفعة 50 ﷼، يسجّل تعبئاته بفواتيرها، وحين ينزل رصيده تحت 10 ﷼ يُنشأ طلب دفعة 50 ﷼
--   تلقائياً للإدارة. المتبقي يُرحَّل (الرصيد = كل ما حُوِّل − كل ما صُرف، منذ fuel_wallet_start، بلا تصفير دوري).
--
-- وقائع مقروءة من الإنتاج 2026-10-15 قبل الكتابة:
--   • fuel_requests: 8 صفوف. status check = requested/transferred/closed؛ odometer و odometer_photo_url إلزاميان (not null).
--     المحوَّلة كلها 50 ﷼ ونص التحويل البنكي في transfer_ref يذكر «رسوم … 0.58 SAR»؛ تحويلات عريف الثلاثة تحمل نص البنك نفسه (عملية واحدة).
--   • fuel_logs: لا check على status (القيم الحالية paid/submitted)؛ 8 صفوف legacy؛ الكتابة المباشرة ممنوحة للمسجّل على أعمدة محددة،
--     وسياسة fl_ins تقبل إدراج البايكر لصفّه ⇒ يستطيع تجاوز add_fuel_fill. لا شاشة في الواجهة تُدرج مباشرة (grep: لا insert/update على fuel_logs).
--   • fleet_alert_settings.key check بالقيم التسع فقط؛ value رقمي موجب.
--   • _fleet_notify_admins/_fleet_notify_biker في الإنتاج أحدث من fleet_requests.sql (بادئة «🧪 تجريبي» من test_sandbox.sql) ⇒ لا تُعاد كتابتهما هنا.
--
-- ترتيب التطبيق (كل قسم في معاملة مستقلة):
--   القسم A — من SQL Editor: docs/sql/fuel_wallet_A.sql كما هو (فيه drop constraint / drop not null وأداة MCP تتعطل عليها).
--   القسم B — عبر الأداة: الأعمدة والإعدادات والدوال والعرض والصلاحيات (بلا تعديل بيانات).
--   القسم C — عبر الأداة، معاملة مستقلة: amount_actual/fee للمحوَّل سابقاً (6 صفوف بالضبط، وإلا تراجع).
--   ثم docs/sql/fuel_fix_2026_10.sql (تصحيح عريف) عبر الأداة، ثم دمج PR الواجهة.
--   بين B ودمج الواجهة (نافذة قصيرة): «اطلب وقوداً» والتحويل في الواجهة القديمة يرفضان (permission denied — التنفيذ مسحوب)،
--   وتعبئة بلا لترات ترفض (LITERS_REQUIRED). ⇒ يُطبَّق B ثم C ثم الإصلاح ثم يُدمج PR الواجهة مباشرة.
--
-- قرارات تفصيلية (للمراجعة):
--   1) fuel_wallet_start محفوظ رقماً YYYYMMDD (20261012) لأن value رقمي؛ يُقرأ تاريخاً بتوقيت الرياض.
--   2) الرصيد: الدفعات بحالة transferred/closed و amount_actual غير فارغ وحُوِّلت منذ البداية (transferred_at) − التعبئات غير legacy وغير المرفوضة منذ البداية.
--      التعبئة المسجّلة تُخصم فوراً (لا تنتظر الاعتماد)؛ المرفوضة لا تُخصم.
--   3) _fuel_maybe_topup تُستدعى بعد: كل تعبئة، رفض تعبئة (يغيّر الرصيد)، وكل تحويل. لا تُستدعى بعد اعتماد تعبئة (لا يغيّر الرصيد)
--      ولا بعد «رفض طلب الدفعة» (وإلا أُعيد إنشاء المرفوض فوراً)؛
--      بعد الرفض: الدفعة المستعجلة، أو التعبئة التالية.
--   4) request_urgent_topup: يُقبل فقط بلا طلب مفتوح **وبرصيد أقل من العتبة** (الشرط الثاني إضافة للمراجعة: الزر يظهر بهذا الشرط فقط،
--      والقاعدة تفرضه حتى لا يُطلب مال عبر الواجهة البرمجية برصيد كافٍ).
--   5) الطلب التلقائي يأخذ عدّاد وصورة آخر تعبئة غير مرفوضة (إن وُجدت)، و created_by فارغ (ليس فعل البايكر — لا يُحسب «نشاط بوابة»).
--   6) الكتابة المباشرة في fuel_logs تُسحب من المسجّل (insert/update) — كل الكتابة عبر add_fuel_fill و review_fuel_fill.
--   7) request_fuel القديمة تبقى بالاسم (لا حذف عبر الأداة) لكنها ترفض بـ USE_WALLET ويُسحب تنفيذها؛ وكذلك transfer_fuel_request(uuid,text,timestamptz).
--   8b) المبالغ في الإشعارات عبر _fuel_sar (50 ⇒ «50»، 7.5 ⇒ «7.5») — to_char بـ '#' يقرّب للعدد الصحيح.
--   8c) transfer_fuel_request: المبلغ الافتراضي = مبلغ الطلب نفسه (لا 50 ثابتة)، والرسوم الافتراضية 0.58 كما قرّر المالك.
--   8d) حدود إعدادات الرصيد: المبلغ ≤ 1000، العتبة < المبلغ، التسامح ≤ 100، min < max للسعر.
--   8) transfer_fuel_request صار بنسختين (القديمة مغلقة): الاستدعاء بالأسماء (p_bank_txn) — كما تفعل PostgREST — لا بالموضع (غامض بين النسختين).
--   9) لا وقود في vendor_expenses اليوم (قراءة 2026-10-16: صفر صفوف بعنوان/فئة وقود) ⇒ لا ازدواج في تقرير المصروفات.
--  10) المصروفات: العرض fuel_expenses_monthly (security_invoker ⇒ يرى كلٌّ ما تسمح به سياسات الجدولين: الإدارة الكل، البايكر صفوفه).
--      الفواتير المعتمدة = «وقود» بشهر التعبئة، والرسوم = «رسوم بنكية» بشهر التحويل. الدفعة نفسها ليست مصروفاً.

-- ════════════════════════════════════════════════════════════════════════
-- ═══ A) من SQL Editor (معاملة واحدة) ═══
-- ════════════════════════════════════════════════════════════════════════
-- في ملف مستقل جاهز للصق كما هو: docs/sql/fuel_wallet_A.sql (begin … commit + استعلام تحقق: YES | YES | true | true).
--   حالتا rejected/cancelled، والمفاتيح الستة، والعدّاد وصورته اختياريان في الطلب.

-- ════════════════════════════════════════════════════════════════════════
-- ═══ B) عبر الأداة (معاملة واحدة؛ آمن لإعادة التشغيل؛ بلا كلمات الحذف) ═══
-- ════════════════════════════════════════════════════════════════════════

-- B.1 الأعمدة
alter table public.fuel_requests add column if not exists amount_actual numeric check (amount_actual is null or (amount_actual > 0 and amount_actual <= 1000));
alter table public.fuel_requests add column if not exists fee numeric not null default 0 check (fee >= 0 and fee <= 50);
alter table public.fuel_requests add column if not exists bank_txn text check (length(bank_txn) between 1 and 200);
alter table public.fuel_requests add column if not exists reject_reason text check (length(reject_reason) <= 500);
alter table public.fuel_requests add column if not exists reason text check (length(reason) <= 500);       -- سبب الدفعة المستعجلة
alter table public.fuel_requests add column if not exists source text not null default 'manual' check (source in ('auto', 'urgent', 'manual'));
alter table public.fuel_requests add column if not exists rejected_at timestamptz;
alter table public.fuel_requests add column if not exists rejected_by uuid;
create unique index if not exists fuel_requests_bank_txn_uq on public.fuel_requests (bank_txn) where bank_txn is not null;
-- طلب مفتوح واحد على الأكثر لكل بايكر (حارس على مستوى القاعدة فوق القفل)
create unique index if not exists fuel_requests_one_open_uq on public.fuel_requests (biker_employee_id) where status = 'requested';

alter table public.fuel_logs add column if not exists price_warn boolean not null default false;       -- سعر اللتر خارج [min, max] — للمراجع لا رفض
alter table public.fuel_logs add column if not exists reject_reason text check (length(reject_reason) <= 500);

-- B.2 الإعدادات (fuel_wallet_start = YYYYMMDD)
insert into public.fleet_alert_settings (key, value, note) values
  ('fuel_topup_amount',    50,       'رصيد الوقود: مبلغ الدفعة التلقائية'),
  ('fuel_topup_threshold', 10,       'رصيد الوقود: تُنشأ دفعة تلقائية حين ينزل الرصيد تحت هذا'),
  ('fuel_fill_tolerance',  10,       'رصيد الوقود: أقصى تجاوز للرصيد في تعبئة واحدة'),
  ('fuel_price_min',       2.0,      'سعر اللتر: أقل من هذا ⇒ تحذير للمراجع'),
  ('fuel_price_max',       2.6,      'سعر اللتر: أعلى من هذا ⇒ تحذير للمراجع'),
  ('fuel_wallet_start',    20261012, 'رصيد الوقود: بداية الحساب (YYYYMMDD بتوقيت الرياض)')
on conflict do nothing;

-- B.4 دوال داخلية
create or replace function public._fuel_setting(p_key text)
returns numeric language sql stable security definer set search_path = public as $$
  select public._fleet_setting(p_key, null);
$$;

-- مبلغ للعرض في الإشعارات: 50 ⇒ «50»، 7.5 ⇒ «7.5»، 2.326 ⇒ «2.33»
create or replace function public._fuel_sar(p numeric)
returns text language sql immutable set search_path = public as $$
  select case when p is null then '—' else rtrim(rtrim(to_char(round(p, 2), 'FM9999999990.00'), '0'), '.') end;
$$;

create or replace function public._fuel_start()
returns timestamptz language sql stable security definer set search_path = public as $$
  select (to_date(coalesce(public._fuel_setting('fuel_wallet_start'), 20261012)::bigint::text, 'YYYYMMDD')::timestamp) at time zone 'Asia/Riyadh';
$$;

-- الرصيد: المحوَّل − المصروف (غير legacy، غير مرفوض) منذ البداية
create or replace function public.fuel_balance(p_biker text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select sum(r.amount_actual) from public.fuel_requests r
                    where r.biker_employee_id = p_biker and r.status in ('transferred', 'closed') and r.amount_actual is not null
                      and r.transferred_at >= public._fuel_start()), 0)
       - coalesce((select sum(l.amount) from public.fuel_logs l
                    where l.biker_employee_id = p_biker and not l.legacy and l.status is distinct from 'rejected'
                      and l.amount is not null and l.fill_at >= public._fuel_start()), 0);
$$;

-- دفعة تلقائية: الرصيد < العتبة ولا طلب «مطلوب» ⇒ طلب 50 ﷼ (source='auto') + إشعار الإدارة. يُرجع رقم الطلب أو فارغ.
create or replace function public._fuel_maybe_topup(p_biker text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_bal numeric; v_thr numeric := coalesce(public._fuel_setting('fuel_topup_threshold'), 10);
        v_amt numeric := coalesce(public._fuel_setting('fuel_topup_amount'), 50);
        f record; v record; v_name text; v_id uuid;
begin
  if p_biker is null then return null; end if;
  perform pg_advisory_xact_lock(hashtext('fuel-wallet:' || p_biker));
  if exists (select 1 from public.fuel_requests where biker_employee_id = p_biker and status = 'requested') then return null; end if;
  v_bal := public.fuel_balance(p_biker);
  if v_bal >= v_thr then return null; end if;
  -- الدراجة والعدّاد من آخر تعبئة غير مرفوضة، وإلا آخر طلب للبايكر
  select l.vehicle_id, l.plate, l.operator_id, l.odometer, l.odometer_photo_url, l.biker_name into f
    from public.fuel_logs l where l.biker_employee_id = p_biker and not l.legacy and l.vehicle_id is not null and l.status is distinct from 'rejected'
   order by l.fill_at desc limit 1;
  if f.vehicle_id is null then
    select r.vehicle_id, r.plate, r.operator_id, null::numeric as odometer, null::text as odometer_photo_url, r.biker_name into f
      from public.fuel_requests r where r.biker_employee_id = p_biker order by r.requested_at desc limit 1;
  end if;
  if f.vehicle_id is null then return null; end if;   -- لا دراجة معروفة ⇒ لا طلب (تبدأ بأول تعبئة أو دفعة مستعجلة)
  select full_name into v_name from public.employees where employee_id = p_biker limit 1;
  insert into public.fuel_requests (operator_id, vehicle_id, plate, biker_employee_id, biker_name, odometer, odometer_photo_url, amount, source, created_by)
  values (f.operator_id, f.vehicle_id, f.plate, p_biker, coalesce(v_name, f.biker_name), f.odometer, f.odometer_photo_url, v_amt, 'auto', null)
  returning id into v_id;
  perform public._fleet_notify_admins('دفعة وقود تلقائية — ' || coalesce(f.plate, '—'),
    coalesce(v_name, f.biker_name, p_biker) || ' · ' || public._fuel_sar(v_amt) || ' ﷼ · الرصيد ' || public._fuel_sar(v_bal) || ' ﷼',
    v_id::text, 'fuel-auto-' || v_id);
  return v_id;
end $$;

-- B.5 البايكر: رصيده فقط (مع العتبة ومبلغ الدفعة للعرض)
create or replace function public.my_fuel_balance()
returns table (balance numeric, threshold numeric, topup_amount numeric, tolerance numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_bid text := public.my_biker_id();
begin
  if v_bid is null then raise exception 'NOT_A_BIKER'; end if;
  return query select public.fuel_balance(v_bid), coalesce(public._fuel_setting('fuel_topup_threshold'), 10),
                      coalesce(public._fuel_setting('fuel_topup_amount'), 50), coalesce(public._fuel_setting('fuel_fill_tolerance'), 10);
end $$;

-- B.6 الإدارة: رصيد كل بايكر (من له fleet_alerts) — البايكر: كل حساب نشط برقم بايكر + كل من له حركة منذ البداية
create or replace function public.fuel_balances()
returns table (biker_employee_id text, biker_name text, transferred numeric, spent numeric, balance numeric,
               pending_fills int, open_request_id uuid, open_source text, open_since timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('fleet_alerts') then return; end if;
  return query
  with b as (
    select btrim(au.biker_employee_id) as bid from public.app_users au where au.active and nullif(btrim(au.biker_employee_id), '') is not null
    union select r.biker_employee_id from public.fuel_requests r where coalesce(r.transferred_at, r.requested_at) >= public._fuel_start()
    union select l.biker_employee_id from public.fuel_logs l where not l.legacy and l.biker_employee_id is not null and l.fill_at >= public._fuel_start()
  )
  select b.bid,
         (select e.full_name from public.employees e where e.employee_id = b.bid limit 1),
         t.tr, t.sp, t.tr - t.sp,
         (select count(*)::int from public.fuel_logs l where l.biker_employee_id = b.bid and not l.legacy and l.status = 'submitted' and l.fill_at >= public._fuel_start()),
         o.id, o.source, o.requested_at
    from b
    -- نفس معادلة fuel_balance (المحوَّل − المصروف)، مرة واحدة لكل بايكر
    cross join lateral (select
         coalesce((select sum(r.amount_actual) from public.fuel_requests r where r.biker_employee_id = b.bid and r.status in ('transferred', 'closed')
                     and r.amount_actual is not null and r.transferred_at >= public._fuel_start()), 0) as tr,
         coalesce((select sum(l.amount) from public.fuel_logs l where l.biker_employee_id = b.bid and not l.legacy and l.status is distinct from 'rejected'
                     and l.amount is not null and l.fill_at >= public._fuel_start()), 0) as sp) t
    left join lateral (select r.id, r.source, r.requested_at from public.fuel_requests r where r.biker_employee_id = b.bid and r.status = 'requested' limit 1) o on true
   where b.bid is not null;
end $$;

-- B.7 البايكر: دفعة مستعجلة (بلا مبلغ) — فقط بلا طلب مفتوح وبرصيد تحت العتبة
create or replace function public.request_urgent_topup(p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.fleet_vehicles; v_bid text := public.my_biker_id(); v_name text; v_id uuid; v_bal numeric;
        v_amt numeric := coalesce(public._fuel_setting('fuel_topup_amount'), 50); f record;
begin
  if v_bid is null then raise exception 'NOT_A_BIKER'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  if length(p_reason) > 500 then raise exception 'REASON_TOO_LONG'; end if;
  v := public._fleet_my_vehicle();
  if v.id is null then raise exception 'NO_BIKE'; end if;
  perform pg_advisory_xact_lock(hashtext('fuel-wallet:' || v_bid));
  if exists (select 1 from public.fuel_requests where biker_employee_id = v_bid and status = 'requested') then raise exception 'OPEN_REQUEST'; end if;
  v_bal := public.fuel_balance(v_bid);
  if v_bal >= coalesce(public._fuel_setting('fuel_topup_threshold'), 10) then raise exception 'BALANCE_OK'; end if;
  select full_name into v_name from public.employees where id = public.my_employee_uuid();
  select l.odometer, l.odometer_photo_url into f from public.fuel_logs l
   where l.vehicle_id = v.id and not l.legacy and l.status is distinct from 'rejected' order by l.fill_at desc limit 1;
  insert into public.fuel_requests (operator_id, vehicle_id, plate, biker_employee_id, biker_name, odometer, odometer_photo_url, amount, source, reason, created_by)
  values (v.operator_id, v.id, v.plate, v_bid, v_name, f.odometer, f.odometer_photo_url, v_amt, 'urgent', btrim(p_reason), auth.uid())
  returning id into v_id;
  perform public._fleet_notify_admins('⚠️ دفعة وقود مستعجلة — ' || coalesce(v.plate, '—'),
    coalesce(v_name, v_bid) || ' · الرصيد ' || public._fuel_sar(v_bal) || ' ﷼ · ' || btrim(p_reason), v_id::text, 'fuel-urgent-' || v_id);
  return v_id;
end $$;

-- B.8 البايكر: تعبئة. العدّاد > آخر قراءة، اللترات إلزامية، المبلغ ≤ الرصيد + التسامح، رفض التكرار، تحذير السعر، ربط FIFO.
create or replace function public.add_fuel_fill(p_odometer numeric, p_amount numeric, p_liters numeric,
  p_odometer_photo_url text, p_receipt_photo_url text, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.fleet_vehicles; v_bid text := public.my_biker_id(); v_name text; v_req uuid; v_id uuid; v_bal numeric; v_last numeric;
        v_min numeric := coalesce(public._fuel_setting('fuel_price_min'), 2.0); v_max numeric := coalesce(public._fuel_setting('fuel_price_max'), 2.6);
        v_price numeric;
begin
  if v_bid is null then raise exception 'NOT_A_BIKER'; end if;
  v := public._fleet_my_vehicle();
  if v.id is null then raise exception 'NO_BIKE'; end if;
  if p_odometer is null or p_odometer < 0 then raise exception 'ODOMETER_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'AMOUNT_REQUIRED'; end if;
  if p_liters is null or p_liters <= 0 then raise exception 'LITERS_REQUIRED'; end if;
  if coalesce(btrim(p_odometer_photo_url), '') = '' or coalesce(btrim(p_receipt_photo_url), '') = ''
     or length(p_odometer_photo_url) > 1000 or length(p_receipt_photo_url) > 1000 then raise exception 'PHOTO_REQUIRED'; end if;
  if length(p_notes) > 1000 then raise exception 'NOTES_TOO_LONG'; end if;
  perform pg_advisory_xact_lock(hashtext('fuel-wallet:' || v_bid));
  -- التكرار: نفس العدّاد للدراجة، أو تعبئة للبايكر خلال 10 دقائق (غير المرفوضة فقط)
  if exists (select 1 from public.fuel_logs l where not l.legacy and l.status is distinct from 'rejected'
               and ((l.vehicle_id = v.id and l.odometer = p_odometer) or (l.biker_employee_id = v_bid and l.fill_at > now() - interval '10 minutes'))) then
    raise exception 'DUPLICATE_FILL';
  end if;
  select max(l.odometer) into v_last from public.fuel_logs l
   where l.vehicle_id = v.id and not l.legacy and l.status is distinct from 'rejected' and l.odometer is not null;
  if v_last is not null and p_odometer <= v_last then raise exception 'ODOMETER_NOT_INCREASING'; end if;
  v_bal := public.fuel_balance(v_bid);
  if p_amount > v_bal + coalesce(public._fuel_setting('fuel_fill_tolerance'), 10) then raise exception 'OVER_BALANCE'; end if;
  v_price := p_amount / p_liters;
  -- FIFO: أقدم دفعة محوَّلة لم تُغطَّ بتعبئات غير مرفوضة
  select r.id into v_req from public.fuel_requests r
   where r.biker_employee_id = v_bid and r.status in ('transferred', 'closed') and r.amount_actual is not null and r.transferred_at >= public._fuel_start()
     and coalesce((select sum(l.amount) from public.fuel_logs l where l.request_id = r.id and l.status is distinct from 'rejected'), 0) < r.amount_actual
   order by r.transferred_at, r.requested_at limit 1;
  select full_name into v_name from public.employees where id = public.my_employee_uuid();
  insert into public.fuel_logs (operator_id, vehicle_id, plate, biker_employee_id, biker_name, fuel_type, odometer, amount, liters,
                                odometer_photo_url, receipt_photo_url, notes, created_by, request_id, price_warn)
  values (v.operator_id, v.id, v.plate, v_bid, v_name, 'petrol', p_odometer, p_amount, p_liters,
          btrim(p_odometer_photo_url), btrim(p_receipt_photo_url), nullif(btrim(p_notes), ''), auth.uid(), v_req, v_price < v_min or v_price > v_max)
  returning id into v_id;
  perform public._fuel_maybe_topup(v_bid);
  return v_id;
end $$;

-- B.9 الإدارة: اعتماد التعبئة أو رفضها بسبب (المرفوضة لا تُخصم). إشعار عربي + بنغالي.
create or replace function public.review_fuel_fill(p_id uuid, p_ok boolean, p_reason text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.fuel_logs;
begin
  if not public.has_perm('fleet_alerts', true) then raise exception 'FORBIDDEN'; end if;
  if p_ok is null then raise exception 'DECISION_REQUIRED'; end if;
  if not p_ok and coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  if length(p_reason) > 500 then raise exception 'REASON_TOO_LONG'; end if;
  select * into r from public.fuel_logs where id = p_id for update;
  if not found or r.legacy then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'submitted' then raise exception 'ALREADY_REVIEWED'; end if;
  update public.fuel_logs set status = case when p_ok then 'approved' else 'rejected' end, reviewed_by = auth.uid(), reviewed_at = now(),
         reject_reason = case when p_ok then null else btrim(p_reason) end
   where id = p_id;
  if p_ok then
    perform public._fleet_notify_biker(r.biker_employee_id, 'اعتُمدت تعبئتك · আপনার রিফুয়েল অনুমোদিত',
      public._fuel_sar(r.amount) || ' ﷼', p_id::text, 'fuel-fill-ok-' || p_id);
  else
    perform public._fleet_notify_biker(r.biker_employee_id, 'رُفضت تعبئتك · আপনার রিফুয়েল প্রত্যাখ্যাত',
      public._fuel_sar(r.amount) || ' ﷼ — ' || btrim(p_reason) || ' · المبلغ عاد لرصيدك · টাকা আপনার ব্যালেন্সে ফেরত', p_id::text, 'fuel-fill-no-' || p_id);
  end if;
  if not p_ok then perform public._fuel_maybe_topup(r.biker_employee_id); end if;   -- الاعتماد لا يغيّر الرصيد
  return true;
end $$;

-- B.10 الإدارة: تحويل الدفعة (رقم العملية فريد، المبلغ الفعلي، الرسوم) ⇒ «حُوِّل»
create or replace function public.transfer_fuel_request(p_id uuid, p_bank_txn text, p_amount_actual numeric default null, p_fee numeric default 0.58)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.fuel_requests;
begin
  if not public.has_perm('fleet_alerts', true) then raise exception 'FORBIDDEN'; end if;
  if coalesce(btrim(p_bank_txn), '') = '' or length(p_bank_txn) > 200 then raise exception 'TXN_REQUIRED'; end if;
  if p_fee is null or p_fee < 0 or p_fee > 50 then raise exception 'BAD_FEE'; end if;
  select * into r from public.fuel_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'requested' then raise exception 'NOT_REQUESTED'; end if;
  p_amount_actual := coalesce(p_amount_actual, r.amount);   -- الافتراضي: مبلغ الطلب نفسه (50 عادةً)
  if p_amount_actual <= 0 or p_amount_actual > 1000 then raise exception 'BAD_AMOUNT'; end if;
  if exists (select 1 from public.fuel_requests where bank_txn = btrim(p_bank_txn) and id <> p_id) then raise exception 'DUPLICATE_TXN'; end if;
  update public.fuel_requests set status = 'transferred', bank_txn = btrim(p_bank_txn), transfer_ref = btrim(p_bank_txn),
         amount_actual = p_amount_actual, fee = p_fee, transferred_at = now(), transferred_by = auth.uid()
   where id = p_id;
  perform public._fleet_notify_biker(r.biker_employee_id, 'حُوِّلت دفعة الوقود · জ্বালানির টাকা পাঠানো হয়েছে',
    public._fuel_sar(p_amount_actual) || ' ﷼ أُضيفت لرصيدك — سجّل كل تعبئة بفاتورتها · ব্যালেন্সে যোগ হয়েছে — প্রতিটি রিফুয়েলের রসিদ দিন',
    p_id::text, 'fuel-tr-' || p_id);
  perform public._fuel_maybe_topup(r.biker_employee_id);
  return true;
end $$;

-- B.11 الإدارة: رفض طلب الدفعة بسبب (لا يُعاد إنشاؤه تلقائياً هنا)
create or replace function public.reject_fuel_request(p_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.fuel_requests;
begin
  if not public.has_perm('fleet_alerts', true) then raise exception 'FORBIDDEN'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  if length(p_reason) > 500 then raise exception 'REASON_TOO_LONG'; end if;
  select * into r from public.fuel_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'requested' then raise exception 'NOT_REQUESTED'; end if;
  update public.fuel_requests set status = 'rejected', reject_reason = btrim(p_reason), rejected_at = now(), rejected_by = auth.uid() where id = p_id;
  perform public._fleet_notify_biker(r.biker_employee_id, 'رُفض طلب دفعة الوقود · জ্বালানির টাকার অনুরোধ প্রত্যাখ্যাত',
    btrim(p_reason), p_id::text, 'fuel-rej-' || p_id);
  return true;
end $$;

-- B.12 القديمتان: تبقيان بالاسم وترفضان (لا حذف عبر الأداة)، ويُسحب تنفيذهما
create or replace function public.request_fuel(p_odometer numeric, p_odometer_photo_url text, p_amount numeric default 50)
returns uuid language plpgsql security definer set search_path = public as $$
begin raise exception 'USE_WALLET'; end $$;
create or replace function public.transfer_fuel_request(p_id uuid, p_ref text, p_at timestamptz default now())
returns boolean language plpgsql security definer set search_path = public as $$
begin raise exception 'USE_NEW_TRANSFER'; end $$;

-- B.13 ضبط الحدود: المفاتيح الجديدة + تحقق تاريخ البداية
create or replace function public.set_fleet_alert_setting(p_key text, p_value numeric, p_vehicle_id uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('fleet_alerts', true) then raise exception 'FORBIDDEN'; end if;
  if p_key is null or p_key not in ('fuel_low_pct', 'fuel_min_km_per_50', 'fill_gap_km', 'fill_gap_hours', 'receipt_grace_days',
                                    'odo_max_km_per_day', 'oil_interval_km', 'oil_exec_days', 'fuel_price_91',
                                    'fuel_topup_amount', 'fuel_topup_threshold', 'fuel_fill_tolerance', 'fuel_price_min', 'fuel_price_max', 'fuel_wallet_start') then raise exception 'BAD_KEY'; end if;
  if (p_vehicle_id is null and p_value is null) or p_value <= 0 or (p_key = 'fuel_low_pct' and p_value >= 100) then raise exception 'BAD_VALUE'; end if;
  -- إعدادات الرصيد عامة فقط (لا تجاوز لدراجة)، وتاريخ البداية YYYYMMDD صالح
  if p_key like 'fuel\_%' escape '\' and p_key not in ('fuel_low_pct', 'fuel_min_km_per_50', 'fuel_price_91') and p_vehicle_id is not null then raise exception 'BAD_KEY'; end if;
  if p_key = 'fuel_wallet_start' then
    if p_value <> trunc(p_value) or p_value < 20200101 or p_value > 20991231 then raise exception 'BAD_VALUE'; end if;
    begin
      if to_char(to_date(p_value::bigint::text, 'YYYYMMDD'), 'YYYYMMDD') <> p_value::bigint::text then raise exception 'BAD_VALUE'; end if;
    exception when others then raise exception 'BAD_VALUE';
    end;
  end if;
  -- حدود إعدادات الرصيد وتناسقها
  if (p_key = 'fuel_topup_amount' and (p_value > 1000 or p_value <= coalesce(public._fuel_setting('fuel_topup_threshold'), 10)))
     or (p_key = 'fuel_topup_threshold' and p_value >= coalesce(public._fuel_setting('fuel_topup_amount'), 50))
     or (p_key = 'fuel_fill_tolerance' and p_value > 100)
     or (p_key = 'fuel_price_min' and p_value >= coalesce(public._fuel_setting('fuel_price_max'), 2.6))
     or (p_key = 'fuel_price_max' and p_value <= coalesce(public._fuel_setting('fuel_price_min'), 2.0)) then raise exception 'BAD_VALUE'; end if;
  insert into public.fleet_alert_settings (key, vehicle_id, value, updated_by) values (p_key, p_vehicle_id, p_value, auth.uid())
  on conflict (key, coalesce(vehicle_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  return true;
end $$;

-- B.14 المصروفات الشهرية: الفواتير المعتمدة = «وقود»، رسوم التحويل = «رسوم بنكية». الدفعات ليست مصروفاً.
create or replace view public.fuel_expenses_monthly with (security_invoker = true) as
  select to_char(l.fill_at at time zone 'Asia/Riyadh', 'YYYY-MM') as period, 'وقود'::text as category, sum(l.amount) as amount, count(*)::int as n
    from public.fuel_logs l where not l.legacy and l.status = 'approved' and l.amount > 0
   group by 1
  union all
  select to_char(r.transferred_at at time zone 'Asia/Riyadh', 'YYYY-MM'), 'رسوم بنكية', sum(r.fee), count(*)::int
    from public.fuel_requests r where r.status in ('transferred', 'closed') and r.transferred_at is not null and r.fee > 0
   group by 1;

-- B.15 الصلاحيات
revoke all on public.fuel_logs from authenticated;                    -- كل الكتابة عبر add_fuel_fill و review_fuel_fill (ولا إزالة: تُرجع المال للرصيد)
grant select on public.fuel_logs to authenticated;
revoke all on public.fuel_expenses_monthly from anon;
grant select on public.fuel_expenses_monthly to authenticated;
revoke all on function public._fuel_setting(text), public._fuel_sar(numeric), public._fuel_start(), public.fuel_balance(text), public._fuel_maybe_topup(text) from public, anon, authenticated;
revoke all on function public.my_fuel_balance(), public.fuel_balances(), public.request_urgent_topup(text),
  public.review_fuel_fill(uuid, boolean, text), public.transfer_fuel_request(uuid, text, numeric, numeric), public.reject_fuel_request(uuid, text) from public, anon;
grant execute on function public.my_fuel_balance(), public.fuel_balances(), public.request_urgent_topup(text),
  public.review_fuel_fill(uuid, boolean, text), public.transfer_fuel_request(uuid, text, numeric, numeric), public.reject_fuel_request(uuid, text) to authenticated;
revoke execute on function public.request_fuel(numeric, text, numeric), public.transfer_fuel_request(uuid, text, timestamptz) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- ═══ C) عبر الأداة — معاملة مستقلة: الدفعات المحوَّلة قبل الرصيد ═══
-- ════════════════════════════════════════════════════════════════════════
-- المبلغ الفعلي = المبلغ المطلوب، والرسوم من نص البنك إن وُجدت (وإلا 0). وقائع 2026-10-15: 6 صفوف بالضبط
-- (TEST01، عريف ×3، ميدول، رقيب)؛ إعادة التشغيل ⇒ 0 صفوف (مقبول). أي عدد آخر ⇒ تراجع.
do $$ declare n int; begin
  update public.fuel_requests
     set amount_actual = amount,
         fee = coalesce(nullif(substring(transfer_ref from 'رسوم[^:]*:[[:space:]]*([0-9]+(\.[0-9]+)?)[[:space:]]*SAR'), '')::numeric, 0)
   where status in ('transferred', 'closed') and transferred_at is not null and amount_actual is null;
  get diagnostics n = row_count;
  if n not in (0, 6) then raise exception 'القسم C: المتوقع 6 صفوف (أو 0 عند الإعادة)، تأثّر %', n; end if;
end $$;

-- ═══ تحقق بالقراءة بعد B و C ═══
-- select key, value from fleet_alert_settings where key like 'fuel\_%' escape '\' and vehicle_id is null order by key;  -- 6 جديدة + fuel_low_pct/min_km/price_91
-- select proname, prosecdef from pg_proc where proname in ('fuel_balance','_fuel_maybe_topup','my_fuel_balance','fuel_balances','request_urgent_topup',
--   'add_fuel_fill','review_fuel_fill','transfer_fuel_request','reject_fuel_request','_fuel_setting','_fuel_start');   -- كلها t (transfer_fuel_request مرتان)
-- select has_function_privilege('authenticated','public.fuel_balance(text)','execute'), has_function_privilege('authenticated','public.request_fuel(numeric,text,numeric)','execute'),
--        has_function_privilege('authenticated','public.my_fuel_balance()','execute'), has_function_privilege('anon','public.my_fuel_balance()','execute'),
--        has_table_privilege('authenticated','public.fuel_logs','insert'), has_table_privilege('authenticated','public.fuel_logs','delete');   -- f, f, t, f, f, f
-- select status, source, amount, amount_actual, fee, biker_employee_id from fuel_requests order by requested_at;  -- المحوَّل: amount_actual=50، fee=0.58 (TEST01: fee 0)
-- (قبل fuel_fix_2026_10.sql) select biker_employee_id, public.fuel_balance(biker_employee_id) from (values ('1624'),('1648'),('1700')) t(biker_employee_id);
--   ⇒ عريف 115 (ثلاث دفعات مكررة − 35) — يصحّحه ملف الإصلاح إلى 15؛ ميدول 50؛ رقيب 50.

-- ═══ تراجع ═══
-- عبر الأداة (يغلق الباب فوراً، بلا حذف):
--   revoke execute on function public.my_fuel_balance(), public.fuel_balances(), public.request_urgent_topup(text), public.review_fuel_fill(uuid,boolean,text),
--     public.transfer_fuel_request(uuid,text,numeric,numeric), public.reject_fuel_request(uuid,text) from authenticated;
--   grant update, delete on public.fuel_logs to authenticated;   -- كما كانت قبل B.15
--   grant insert (id, operator_id, vehicle_id, plate, biker_employee_id, biker_name, fuel_type, fill_at, odometer, liters, amount,
--     odometer_photo_url, receipt_photo_url, notes, status, reviewed_by, reviewed_at, created_by, created_at) on public.fuel_logs to authenticated;
--   ثم أعد request_fuel / add_fuel_fill / transfer_fuel_request(uuid,text,timestamptz) / set_fleet_alert_setting من docs/sql/fleet_requests.sql وامنح تنفيذها.
-- من SQL Editor (كامل):
--   drop view if exists public.fuel_expenses_monthly;
--   drop function if exists public.my_fuel_balance(), public.fuel_balances(), public.request_urgent_topup(text), public.review_fuel_fill(uuid,boolean,text),
--     public.transfer_fuel_request(uuid,text,numeric,numeric), public.reject_fuel_request(uuid,text), public._fuel_maybe_topup(text), public.fuel_balance(text),
--     public._fuel_start(), public._fuel_setting(text);
--   delete from public.fleet_alert_settings where key in ('fuel_topup_amount','fuel_topup_threshold','fuel_fill_tolerance','fuel_price_min','fuel_price_max','fuel_wallet_start');
--   (الأعمدة الجديدة تبقى — لا تضر؛ والقيود تعاد إلى قيمها في القسم A بعكس الترتيب إن لزم)
