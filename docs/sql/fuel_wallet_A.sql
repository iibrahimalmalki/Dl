-- ═══ fuel_wallet.sql — القسم A (يُلصق في SQL Editor كما هو) ═══
-- الحالة: **طُبِّق 2026-10-16** (المالك من SQL Editor؛ تحقق YES | YES | true | true). يسبق القسم B من docs/sql/fuel_wallet.sql.
-- آمن لإعادة التشغيل. معاملة واحدة: إن فشل سطر لا يتغير شيء.

begin;
alter table public.fuel_requests drop constraint if exists fuel_requests_status_check;
alter table public.fuel_requests add constraint fuel_requests_status_check
  check (status in ('requested', 'transferred', 'closed', 'rejected', 'cancelled'));
alter table public.fuel_requests alter column odometer drop not null, alter column odometer_photo_url drop not null;
alter table public.fleet_alert_settings drop constraint if exists fleet_alert_settings_key_check;
alter table public.fleet_alert_settings add constraint fleet_alert_settings_key_check
  check (key in ('fuel_low_pct', 'fuel_min_km_per_50', 'fill_gap_km', 'fill_gap_hours', 'receipt_grace_days',
                 'odo_max_km_per_day', 'oil_interval_km', 'oil_exec_days', 'fuel_price_91',
                 'fuel_topup_amount', 'fuel_topup_threshold', 'fuel_fill_tolerance', 'fuel_price_min', 'fuel_price_max', 'fuel_wallet_start'));
commit;

-- ═══ التحقق — المتوقع صف واحد: YES | YES | true | true ═══
select (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'fuel_requests' and column_name = 'odometer') as odometer_nullable,
       (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'fuel_requests' and column_name = 'odometer_photo_url') as photo_nullable,
       (select pg_get_constraintdef(oid) like '%cancelled%' from pg_constraint where conname = 'fuel_requests_status_check') as status_ok,
       (select pg_get_constraintdef(oid) like '%fuel_wallet_start%' from pg_constraint where conname = 'fleet_alert_settings_key_check') as keys_ok;
