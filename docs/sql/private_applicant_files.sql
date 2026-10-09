-- إغلاق الوصول العام لملفات المتقدمين: applicant-licenses و applicant-photos و applicant-videos.
-- الحالة: لم يُطبَّق — بانتظار موافقة المالك. لا يحذف أي ملف.
-- يُشغَّل من SQL Editor (أداة Supabase تنتهي مهلتها على أي أمر فيه drop).
--
-- قبل التطبيق: الحاويات الثلاث عامة، وعليها read_licenses/read_photos/read_videos (SELECT لـ anon) ⇒
-- أي أحد بالمفتاح العام يسرد الملفات وينزّلها (14 رخصة/إقامة/جواز، 12 صورة، 13 مقطعاً).
-- بعد التطبيق: خاصة؛ الرفع لـ anon باقٍ (upload_*) ليستمر نموذج التقديم؛ القراءة بروابط موقّعة:
--   الرخص (رخصة/إقامة/جواز) والمقاطع ⇒ المالك فقط؛ الصور الشخصية ⇒ المالك + من يملك «الأداء» أو «الجولات الميدانية» (قراءة).
-- has_perm(p_module text, p_need_edit boolean default false): false = عرض أو تعديل؛ تُرجع true للمالك وتشترط حساباً نشطاً.
-- الواجهة (نفس الـ PR) تعرض الملفات عبر createSignedUrl، والنموذج يرفع بلا upsert فلا يحتاج قراءة.

-- ═══ 0) تحقّق قبل (للقراءة فقط) ═══
-- select id, public, (select count(*) from storage.objects o where o.bucket_id = b.id) files
--   from storage.buckets b where id in ('applicant-licenses','applicant-photos','applicant-videos');
-- select policyname, cmd, roles from pg_policies
--   where schemaname = 'storage' and tablename = 'objects' and policyname ~ '^(read|upload)_(licenses|photos|videos)$|^applicant_files_owner_read$';

-- ═══ 1) التطبيق ═══
begin;
update storage.buckets set public = false
  where id in ('applicant-licenses', 'applicant-photos', 'applicant-videos');

drop policy if exists read_licenses on storage.objects;
drop policy if exists read_photos   on storage.objects;
drop policy if exists read_videos   on storage.objects;
-- upload_licenses / upload_photos / upload_videos (INSERT لـ anon) تبقى كما هي.

drop policy if exists applicant_files_owner_read on storage.objects;
create policy applicant_files_owner_read on storage.objects
  for select to authenticated
  using (bucket_id in ('applicant-licenses', 'applicant-photos', 'applicant-videos') and public.is_owner());

-- صور البايكرز في «الأداء» وتقرير الجولة الميدانية (applicant-photos فقط)
drop policy if exists applicant_photos_staff_read on storage.objects;
create policy applicant_photos_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'applicant-photos' and (public.has_perm('performance', false) or public.has_perm('field_rounds', false)));
commit;

-- ═══ 2) تحقّق بعد ═══
-- (أ) في SQL Editor — المتوقع: public = false للثلاث، والسياسات: upload_* لـ anon + applicant_files_owner_read + applicant_photos_staff_read فقط:
select id, public from storage.buckets where id in ('applicant-licenses','applicant-photos','applicant-videos') order by id;
select policyname, cmd, roles::text from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'applicant-(licenses|photos|videos)' order by 1;
-- (ب) أمان الصفوف كما يراه الزائر — المتوقع: لا صفوف (قبل التطبيق: 14 و12 و13):
begin read only; set local role anon;
select bucket_id, count(*) from storage.objects
  where bucket_id in ('applicant-licenses','applicant-photos','applicant-videos') group by 1;
rollback;
-- (ج) من جهاز متصل بالإنترنت: node scripts/check-applicant-storage.mjs --file=<bucket>/<path> ⇒ السرد والتنزيل يفشلان؛
--     ومع --upload يُرفع ملف نصي صغير إلى applicant-photos/_check/ ويجب أن ينجح (يبقى الملف؛ الزائر لا يحذف).
-- (د) المالك يفتح «المتقدمون» ← متقدم ← «الملفات» ⇒ تظهر الصور وتعمل «مشاهدة» للفيديو.

-- ═══ 3) التراجع (يعيد الوضع السابق كما كان تماماً) ═══
-- begin;
-- update storage.buckets set public = true where id in ('applicant-licenses','applicant-photos','applicant-videos');
-- drop policy if exists applicant_files_owner_read on storage.objects;
-- drop policy if exists applicant_photos_staff_read on storage.objects;
-- create policy read_licenses on storage.objects for select to anon using (bucket_id = 'applicant-licenses');
-- create policy read_photos   on storage.objects for select to anon using (bucket_id = 'applicant-photos');
-- create policy read_videos   on storage.objects for select to anon using (bucket_id = 'applicant-videos');
-- commit;

-- ═══ 4) مقترح — لا يُطبَّق الآن: field-evidence و sweater-tickets ═══
-- الوضع: عامتان بلا سياسة SELECT (لا سرد عبر الواجهة البرمجية)، لكن أي رابط معروف يُفتح بلا تسجيل دخول.
-- field-evidence (155 ملفاً: صور الجولات الميدانية، واستلام الدراجة، والوقود، وإقرار العهدة).
--   الصفحات التي تتأثر عند جعلها خاصة:
--   - src/BikerPortal.jsx: uploadPhoto() يحفظ getPublicUrl؛ تُعرض صور الاستلام والوقود والعهدة.
--   - src/FieldRounds.jsx + src/fieldReport.js + src/fieldAnalysis.js: الرفع عبر uploadAuthed، وصور تقرير الجولة،
--     وتحليل الصور الآلي (إن كان مزوّد التحليل يجلب الصور بالرابط فسيحتاج رابطاً موقّعاً).
--   - src/FieldChecklistForm.jsx، src/HandoverReport.jsx، src/handover.js: عرض صور الاستلام في التقرير.
--   - supabase/functions/field-evidence-upload (src/supabase.js uploadAuthed): يُرجع الرابط العام.
-- sweater-tickets (92 ملفاً: صور تذاكر سويتر).
--   - src/SweaterTickets.jsx: publicUrl() يبني /object/public/… يدوياً.
--   - supabase/functions/ticket-image-pull: يحفظ الصورة ويُرجع مسارها.
-- الخطوات المقترحة لاحقاً:
--   1) في الواجهة: عرض كل رابط عبر signedUrl() من src/storageUrl.js (يقبل الرابط العام القديم كما هو).
--   2) سياسات قراءة للمسجّلين: field-evidence ⇒ has_perm('field_rounds') أو has_perm('fleet') أو صاحب الصورة (المسار biker-portal/<المجلد>/<رقم البايكر>/…)؛
--      sweater-tickets ⇒ has_perm('complaints').
--   3) بعد نشر الواجهة: update storage.buckets set public = false where id in ('field-evidence','sweater-tickets');
