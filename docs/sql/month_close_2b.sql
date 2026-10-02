-- الإقفال الشهري — 2ب: حفظ كشف سويتر (PDF) مرفقاً بالمطابقة
-- لا يُشغَّل تلقائياً. الملف يُحفظ في bucket خاص موجود: legal-docs (public = false)، بمسار:
--   sweater-breakdowns/{YYYY-MM}/{timestamp}-{اسم الملف}.pdf
--
-- الوضع الحالي (فُحص قراءةً في 2026-10-02):
--   سياسات legal-docs كلها مشروطة بـ has_perm('renewals'…)، و has_perm يُرجع true للمالك دائماً.
--   ⇒ المالك يرفع الكشف ويعرضه الآن بلا أي تغيير.
--   ⇒ من له صلاحية settlement/payroll دون renewals: التعبئة تعمل، وتُحفظ المطابقة بدون الملف مع رسالة واضحة.
--
-- اختياري — للسماح لأصحاب صلاحية التسوية/الرواتب برفع الكشوف وقراءتها داخل مجلد sweater-breakdowns فقط:

create policy sweater_bd_read on storage.objects for select to authenticated
using (bucket_id = 'legal-docs' and name like 'sweater-breakdowns/%'
       and (has_perm('settlement') or has_perm('payroll')));

create policy sweater_bd_ins on storage.objects for insert to authenticated
with check (bucket_id = 'legal-docs' and name like 'sweater-breakdowns/%'
       and (has_perm('settlement', true) or has_perm('payroll', true)));
