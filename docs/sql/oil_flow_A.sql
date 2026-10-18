-- ═══ oil_flow.sql — القسم A (يُلصق في SQL Editor كما هو) ═══
-- الحالة: **لم يُطبَّق**. يسبق القسم B من docs/sql/oil_flow.sql.
-- آمن لإعادة التشغيل. معاملة واحدة: إن فشل سطر لا يتغير شيء. لا يمسّ أي صف.
-- السبب: حالة «ملغى» (cancelled) جديدة لطلبات الزيت، وتغيير check يحتاج drop constraint (أداة MCP تتعطل عليه).
-- وسياسة رفع لصور «إضافة الإدارة» في field-evidence: الرفع اليوم للبايكر (fe_upload_biker) أو لمحرّر الجولات (fe_upload) فقط،
--   فمحرّر «تنبيهات الأسطول» لا يستطيع رفع صورة العدّاد. السياسة الجديدة: إدراج فقط، تحت المجلد fleet-admin/ فقط، لصاحب fleet_alerts تعديل.
--   (سياسات storage.objects تُنشأ من SQL Editor لا من الأداة.)

begin;
alter table public.maintenance_requests drop constraint if exists maintenance_requests_status_check;
alter table public.maintenance_requests add constraint maintenance_requests_status_check
  check (status in ('requested', 'sent', 'done', 'approved', 'cancelled'));
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'fe_upload_fleet_admin') then
    create policy fe_upload_fleet_admin on storage.objects for insert to authenticated
      with check (bucket_id = 'field-evidence' and (storage.foldername(name))[1] = 'fleet-admin' and public.has_perm('fleet_alerts', true));
  end if;
end $$;
commit;

-- ═══ التحقق — المتوقع صف واحد: true | true | 3 ═══
select (select pg_get_constraintdef(oid) like '%cancelled%' from pg_constraint where conname = 'maintenance_requests_status_check') as status_ok,
       exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'fe_upload_fleet_admin') as upload_ok,
       (select count(*) from public.maintenance_requests) as rows_unchanged;
