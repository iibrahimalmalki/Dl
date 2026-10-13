-- ═══════════════════════════════════════════════════════════════════════════
-- payroll_net_washes.sql — تصحيح الصافي ليوليو–سبتمبر 2026 (البند 5، docs/design/payroll_pipeline.md)
-- الحالة: **لم يُطبَّق**
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   الصافي (HR-POL-003) = المكتملة + إلغاء العميل. الاستيراد كان يحفظ المكتملة فقط (sspImport.js:129)، فالمحفوظ = collect_payment.
--   هذا الملف يصحّح net_washes ويعيد حساب complaint_pct على الصافي الجديد، لكل شهر في معاملة مستقلة
--   تتراجع إن تأثّر غير 3 صفوف. يناير–يونيو لا تُمسّ (قرار المالك 2026-10-13).
--   trigger sync_approved_complaints يقسم على m.net_washes المخزَّن ⇒ يستخدم الصافي الجديد تلقائياً بعد هذا الملف، بلا تعديل.
--
-- المتوقع (net_washes):  يوليو 48/190/201 · أغسطس 188/138/236 · سبتمبر 226/83/232  (1624/1648/1700)
-- قبل التطبيق (2026-10-13): net_washes = collect_payment في الأشهر الثلاثة.
--
-- ⚠️ لا رفع للإقفال الشهري بالواجهة القديمة بعد تطبيق هذا الملف وقبل دمج PR-B (يعيد الصافي القديم).
-- مسير يوليو معتمد ومقفل: هذا الملف لا يمسّ payroll_lines (ترحيل يوليو في PR-C).
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ التنفيذ (آمن لإعادة التشغيل: الصف المصحَّح لا يتغيّر مرة أخرى) ═══
do $$ declare n int; p text; begin
  foreach p in array array['2026-07','2026-08','2026-09'] loop
    update public.ops_biker_month
       set net_washes    = collect_payment + coalesce(cancel_client, 0),
           complaint_pct = case when collect_payment + coalesce(cancel_client, 0) > 0
                                then round(coalesce(approved_complaints, 0)::numeric / (collect_payment + coalesce(cancel_client, 0)) * 100, 2) else 0 end,
           updated_at    = now()
     where period = p and operator_id = 'b57f396c-2d39-4fa4-a568-143585f3db14'
       and net_washes is distinct from collect_payment + coalesce(cancel_client, 0);
    get diagnostics n = row_count;
    if n not in (0, 3) then raise exception 'الشهر %: تأثّر % صفوف بدل 3 — تراجع', p, n; end if;
    raise notice 'الشهر %: % صفوف', p, n;
  end loop;
end $$;
-- ملاحظة: كتلة do واحدة = معاملة واحدة؛ لتطبيق كل شهر وحده شغّل الكتلة بمصفوفة شهر واحد.

-- ═══ التحقق ═══
-- select period, sweater_id, net_washes, collect_payment, cancel_client, approved_complaints, complaint_pct
--   from public.ops_biker_month where period between '2026-07' and '2026-09' order by 1, 2;
--   -- يوليو 48/190/201 (شكاوى 0/4/1 ⇒ 0.00/2.11/0.50) · أغسطس 188/138/236 · سبتمبر 226/83/232
-- select count(*) from public.ops_biker_month where period < '2026-07' and net_washes <> collect_payment;   -- كما قبل (لا تغيير)

-- ═══ التراجع ═══
-- update public.ops_biker_month
--    set net_washes = collect_payment,
--        complaint_pct = case when collect_payment > 0 then round(coalesce(approved_complaints,0)::numeric / collect_payment * 100, 2) else 0 end
--  where period between '2026-07' and '2026-09' and operator_id = 'b57f396c-2d39-4fa4-a568-143585f3db14';
