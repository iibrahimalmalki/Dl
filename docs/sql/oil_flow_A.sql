-- ═══ oil_flow.sql — القسم A (يُلصق في SQL Editor كما هو) ═══
-- الحالة: **لم يُطبَّق**. يسبق القسم B من docs/sql/oil_flow.sql.
-- آمن لإعادة التشغيل. معاملة واحدة: إن فشل سطر لا يتغير شيء. لا يمسّ أي صف.
-- السبب: حالة «ملغى» (cancelled) جديدة لطلبات الزيت، وتغيير check يحتاج drop constraint (أداة MCP تتعطل عليه).

begin;
alter table public.maintenance_requests drop constraint if exists maintenance_requests_status_check;
alter table public.maintenance_requests add constraint maintenance_requests_status_check
  check (status in ('requested', 'sent', 'done', 'approved', 'cancelled'));
commit;

-- ═══ التحقق — المتوقع صف واحد: true | 3 ═══
select (select pg_get_constraintdef(oid) like '%cancelled%' from pg_constraint where conname = 'maintenance_requests_status_check') as status_ok,
       (select count(*) from public.maintenance_requests) as rows_unchanged;
