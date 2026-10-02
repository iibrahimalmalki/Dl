-- الإقفال الشهري — الخطوة 2: المطابقة مع كشف سويتر
-- للتوثيق فقط: طُبّق هذان الأمران على الإنتاج (cnmggdrlkgsyrjxmvydv) بموافقة المالك في 2026-10-02
-- عبر الترحيل swadj_insert_policy_and_settlement_recon، وتحقّقنا قراءةً من وجودهما. لا تُعد تشغيلهما.

alter table public.sweater_settlements add column if not exists recon jsonb;

-- معلّق من الخطوة 1 (لازم لحفظ الإضافات/الخصومات من صفحة الإقفال) — إدراج فقط
create policy p_swadj_ins on public.sweater_adjustments for insert to authenticated
with check (is_owner() or has_perm('operations', true));

-- ملاحظات من فحص القاعدة (قراءة فقط، لم يُغيَّر شيء):
-- • sweater_settlements بلا قيد فريد على (operator_id, period) — المفتاح الوحيد id، وكل التسويات الحالية operator_id = null.
--   لذلك تحدّث المطابقة الصف القائم للشهر بالمعرّف، وتُنشئ مسودة فقط إن لم يوجد صف.
--   إن أردت upsert حقيقياً لاحقاً (اختياري، لا يُشغَّل الآن):
--   create unique index if not exists sweater_settlements_op_period on public.sweater_settlements (coalesce(operator_id,'00000000-0000-0000-0000-000000000000'::uuid), period);
-- • sweater_claims: المفتاح period، والكتابة للمالك فقط (sweater_claims_write = is_owner()).
