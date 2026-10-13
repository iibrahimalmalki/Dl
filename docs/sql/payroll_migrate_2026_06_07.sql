-- ═══════════════════════════════════════════════════════════════════════════
-- payroll_migrate_2026_06_07.sql — ترحيل مسيري يونيو ويوليو 2026 إلى الدفع (PR-C، البند 16)
-- الحالة: **لم يُطبَّق** — بعد payroll_payments.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح (قرارات المالك 2026-10-13)
--   يوليو (5d91c7f8…، مقفل approved): الأسطر محسوبة بالمحرك الحالي (src/payrollEngine.js) على الصافي الجديد
--     = المكتملة + إلغاء العميل، والإكراميات من ملف tips — وتطابق المدفوع حرفياً:
--       عارف 48 × 3.75 = 180.00 · ميدول 190 × 2.75 + 42.90 = 565.40 · راكب 201 × 3.75 + 39 + 25 = 817.75 · سلمان 439 × 1.42 = 623.38
--     الدفع 2026-10-13 بمراجع الحوالات، ورسوم 0.58 لكل حوالة (مصروف على المؤسسة).
--     سلمان: deferred بمبلغ 623.38. عابد: لا مكافأة (بدون غسلات)، والأساس 1,000 صُرف كاملاً باتفاق ⇒ base_paid = true.
--     ملاحظة المسير بنص المالك.
--   يونيو (ee06d014…): final ⇒ approved في payroll_payments.sql. مكافآت البايكرز الثلاثة = 360.75 + 800.13 + 502.00 = 1,662.88
--     = المدفوع بتاريخ 2026-10-04 ⇒ paid بلا مرجع حوالة (غير متوفر) مع ملاحظة. سطر المشرف (533.52) ليس ضمن 1,662.88 ⇒ يبقى pending.
--   حالة المسير تُشتق تلقائياً: يوليو ⇒ partially_paid (سلمان مؤجَّل) · يونيو ⇒ partially_paid (المشرف pending).
--   كل بند معاملة مستقلة (كتلة do): يُحدَّث العدد المتوقع بالضبط، أو 0 إذا كانت الحالة المستهدفة قائمة فعلاً (إعادة تشغيل) — وإلا تراجع.
--   التطبيق عبر الأداة (الحارس يسمح لغير authenticated).
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 1) يوليو — أسطر البايكرز الثلاثة بالأرقام الجديدة (3 صفوف) ═══
do $$ declare n int; begin
  update public.payroll_lines l set net_bonus = v.nb, total = v.tot, inputs = v.inp, computed = v.cmp
  from (values
('58865df7-ed94-4387-807f-93afefdb8a02', 180, 1180, '{"level":"M1","net_washes":48,"rating":4.55,"complaint_approved":0,"tips":0,"qd":"","dmg":"","abs":"","mat":"","trn":""}'::jsonb, '{"role":"biker","level":"M1","base":1000,"net_washes":48,"rating":4.55,"complaint_pct":0,"quality_riyal":0.75,"safety_riyal":1,"rate_per_wash":3.75,"fixed":96,"quality":36,"safety":48,"bonus_base":180,"tips":0,"production":0,"deduction_parts":{"quality_deduction":0,"damage":0,"absence":0,"materials":0,"training":0},"deductions":0,"deduction_capped":false,"deduction_cap":500,"base_deducted":0,"net_bonus":180,"total":1180,"in_kind":1697}'::jsonb),  -- عارف 1624
    ('700d065f-231f-4018-9141-9e2af9e9e2f6', 565.4, 1565.4, '{"level":"M1","net_washes":190,"rating":4.48,"complaint_approved":4,"tips":42.9,"qd":"","dmg":"","abs":"","mat":"","trn":""}'::jsonb, '{"role":"biker","level":"M1","base":1000,"net_washes":190,"rating":4.48,"complaint_pct":2.1052631578947367,"quality_riyal":0.5,"safety_riyal":0.25,"rate_per_wash":2.75,"fixed":380,"quality":95,"safety":47.5,"bonus_base":522.5,"tips":42.9,"production":0,"deduction_parts":{"quality_deduction":0,"damage":0,"absence":0,"materials":0,"training":0},"deductions":0,"deduction_capped":false,"deduction_cap":500,"base_deducted":0,"net_bonus":565.4,"total":1565.4,"in_kind":1697}'::jsonb),  -- ميدول 1648
    ('05cf92bd-3050-4732-b329-80816d0c289a', 817.75, 1817.75, '{"level":"M1","net_washes":201,"rating":4.5,"complaint_approved":1,"tips":39,"qd":"","dmg":"","abs":"","mat":"","trn":""}'::jsonb, '{"role":"biker","level":"M1","base":1000,"net_washes":201,"rating":4.5,"complaint_pct":0.4975124378109453,"quality_riyal":0.75,"safety_riyal":1,"rate_per_wash":3.75,"fixed":402,"quality":150.75,"safety":201,"bonus_base":753.75,"tips":39,"production":25,"deduction_parts":{"quality_deduction":0,"damage":0,"absence":0,"materials":0,"training":0},"deductions":0,"deduction_capped":false,"deduction_cap":500,"base_deducted":0,"net_bonus":817.75,"total":1817.75,"in_kind":1697}'::jsonb)  -- راكب 1700
  ) v(id, nb, tot, inp, cmp)
  where l.id = v.id::uuid and l.run_id = '5d91c7f8-f011-48b9-8860-abc5cf9f3d89' and l.net_bonus is distinct from v.nb;
  get diagnostics n = row_count;
  if n <> 3 and not (n = 0 and (select count(*) from public.payroll_lines where run_id = '5d91c7f8-f011-48b9-8860-abc5cf9f3d89'
        and (id, net_bonus) in (('58865df7-ed94-4387-807f-93afefdb8a02'::uuid, 180), ('700d065f-231f-4018-9141-9e2af9e9e2f6'::uuid, 565.4), ('05cf92bd-3050-4732-b329-80816d0c289a'::uuid, 817.75))) = 3)
  then raise exception 'يوليو/البايكرز: تأثّر % صفوف بدل 3 — تراجع', n; end if;
end $$;

-- ═══ 2) يوليو — المشرف: 623.38 ومؤجَّل، وربطه بسجل سلمان (1 صف) ═══
do $$ declare n int; begin
  update public.payroll_lines set net_bonus = 623.38, total = 2123.38,
         employee_id = '80d65b02-9428-4484-8b27-ffb0ad8a96a8',
         inputs = jsonb_build_object('auto', true, 'name', 'سلمان المالكي', 'team_orders', 439, 'team_complaint_approved', 5, 'deductions', ''),
         computed = '{"role":"supervisor","name":"سلمان المالكي","base":1500,"team_orders":439,"team_rating":4.510000000000001,"team_complaint_pct":1.1389521640091116,"quality_riyal":0.53,"safety_riyal":0.49,"rate_per_order":1.42,"orders_riyal":175.6,"quality":232.67,"safety":215.11,"variable":623.38,"deductions":0,"deduction_capped":false,"deduction_cap":750,"net_bonus":623.38,"total":2123.38}'::jsonb,
         payment_status = 'deferred', pay_note = 'مؤجَّل: 623.38 = 439 × 1.42'
   where id = '8019df96-d5f8-43f7-b228-89c2c368981f' and run_id = '5d91c7f8-f011-48b9-8860-abc5cf9f3d89' and payment_status = 'pending' and net_bonus = 609.18;
  get diagnostics n = row_count;
  if n <> 1 and not (n = 0 and exists(select 1 from public.payroll_lines where id = '8019df96-d5f8-43f7-b228-89c2c368981f' and net_bonus = 623.38))
  then raise exception 'يوليو/المشرف: تأثّر % صفوف بدل 1 — تراجع', n; end if;
end $$;

-- ═══ 3) يوليو — دفع البايكرز الثلاثة (3 صفوف) ═══
do $$ declare n int; begin
  update public.payroll_lines l set payment_status = 'paid', paid_at = '2026-10-13', paid_amount = v.amt, payment_ref = v.ref, bank_fee = 0.58
  from (values
    ('58865df7-ed94-4387-807f-93afefdb8a02', 180.00, '9113102600102912'),  -- عارف
    ('700d065f-231f-4018-9141-9e2af9e9e2f6', 565.40, '9113102600103372'),  -- ميدول
    ('05cf92bd-3050-4732-b329-80816d0c289a', 817.75, '9113102600103684')   -- راكب
  ) v(id, amt, ref)
  where l.id = v.id::uuid and l.run_id = '5d91c7f8-f011-48b9-8860-abc5cf9f3d89' and l.net_bonus = v.amt and l.payment_status = 'pending';
  get diagnostics n = row_count;
  if n <> 3 and not (n = 0 and (select count(*) from public.payroll_lines where run_id = '5d91c7f8-f011-48b9-8860-abc5cf9f3d89'
        and payment_ref in ('9113102600102912', '9113102600103372', '9113102600103684')) = 3)
  then raise exception 'يوليو/الدفع: تأثّر % صفوف بدل 3 — تراجع (تحقّق أن البند 1 طُبِّق)', n; end if;
end $$;

-- ═══ 4) يوليو — عابد: لا مكافأة، والأساس مدفوع باتفاق (1 صف) ═══
do $$ declare n int; begin
  update public.payroll_lines set payment_status = 'paid', paid_amount = 0, base_paid = true,
         pay_note = 'بدون غسلات — لا مكافأة متغيرة. الأساس 1,000 صُرف كاملاً باتفاق (مباشرة 2026-07-12).'
   where id = '509373ab-955b-4430-ac3e-5a3c9111231f' and run_id = '5d91c7f8-f011-48b9-8860-abc5cf9f3d89' and net_bonus = 0 and payment_status = 'pending';
  get diagnostics n = row_count;
  if n <> 1 and not (n = 0 and exists(select 1 from public.payroll_lines where id = '509373ab-955b-4430-ac3e-5a3c9111231f' and base_paid))
  then raise exception 'يوليو/عابد: تأثّر % صفوف بدل 1 — تراجع', n; end if;
end $$;

-- ═══ 5) يوليو — ملاحظة المسير (1 صف) ═══
do $$ declare n int; begin
  update public.payroll_runs set notes = 'الدفع حسب HR-POL-003: الصافي يشمل إلغاءات العميل + الإكراميات (81.90) + إنتاج راكب (25)', updated_at = now()
   where id = '5d91c7f8-f011-48b9-8860-abc5cf9f3d89' and notes is null;
  get diagnostics n = row_count;
  if n <> 1 and not (n = 0 and exists(select 1 from public.payroll_runs where id = '5d91c7f8-f011-48b9-8860-abc5cf9f3d89' and notes like 'الدفع حسب HR-POL-003%'))
  then raise exception 'يوليو/الملاحظة: تأثّر % صفوف بدل 1 — تراجع', n; end if;
end $$;

-- ═══ 6) يونيو — البايكرز الثلاثة مدفوعون 2026-10-04 (المجموع 1,662.88) بلا مرجع (3 صفوف) ═══
do $$ declare n int; s numeric; begin
  select sum(net_bonus) into s from public.payroll_lines where run_id = 'ee06d014-ed5a-4e82-8513-fc041188a116' and role = 'biker';
  if s is distinct from 1662.88 then raise exception 'يونيو: مجموع مكافآت البايكرز % ≠ 1,662.88 — تراجع', s; end if;
  update public.payroll_lines set payment_status = 'paid', paid_at = '2026-10-04', paid_amount = net_bonus,
         pay_note = 'دُفع ضمن 1,662.88 بتاريخ 2026-10-04 — مرجع الحوالة غير مسجّل'
   where run_id = 'ee06d014-ed5a-4e82-8513-fc041188a116' and role = 'biker' and payment_status = 'pending';
  get diagnostics n = row_count;
  if n <> 3 and not (n = 0 and (select count(*) from public.payroll_lines where run_id = 'ee06d014-ed5a-4e82-8513-fc041188a116' and role = 'biker' and paid_at = '2026-10-04') = 3)
  then raise exception 'يونيو/الدفع: تأثّر % صفوف بدل 3 — تراجع', n; end if;
  update public.payroll_runs set notes = coalesce(notes, '') || ' | الدفع: مكافآت البايكرز 1,662.88 بتاريخ 2026-10-04 (بلا مراجع حوالات مسجّلة). المشرف 533.52 لم يُسجَّل دفعه.', updated_at = now()
   where id = 'ee06d014-ed5a-4e82-8513-fc041188a116' and coalesce(notes, '') not like '%1,662.88%';
end $$;

-- ═══ التحقق ═══
-- select r.period, r.status, l.name, l.net_bonus, l.payment_status, l.paid_at, l.paid_amount, l.payment_ref, l.bank_fee, l.base_paid
--   from payroll_lines l join payroll_runs r on r.id = l.run_id where r.period in ('2026-06','2026-07') order by r.period, l.sort;
--   -- يوليو: 180.00/565.40/817.75 paid 2026-10-13 + المراجع + 0.58 · عابد paid 0 base_paid · سلمان 623.38 deferred · المسير partially_paid
--   -- يونيو: 360.75/800.13/502.00 paid 2026-10-04 · المشرف pending · المسير partially_paid
-- select sum(paid_amount), sum(bank_fee) from payroll_lines l join payroll_runs r on r.id=l.run_id where r.period='2026-07';  -- 1563.15 / 1.74

-- ═══ التراجع (SQL Editor) — يعيد الحالة قبل الملف ═══
-- begin;
-- update public.payroll_lines set payment_status='pending', paid_at=null, paid_amount=null, payment_ref=null, bank_fee=0, base_paid=null, base_paid_at=null, pay_note=null
--  where run_id in ('5d91c7f8-f011-48b9-8860-abc5cf9f3d89','ee06d014-ed5a-4e82-8513-fc041188a116');
-- update public.payroll_lines l set net_bonus=v.nb, total=v.tot, inputs=jsonb_set(jsonb_set(l.inputs,'{net_washes}',to_jsonb(v.w)),'{tips}','""'), computed=null
--   from (values ('58865df7-ed94-4387-807f-93afefdb8a02'::uuid,172.50,1172.50,46),('700d065f-231f-4018-9141-9e2af9e9e2f6'::uuid,514.25,1514.25,187),
--                ('05cf92bd-3050-4732-b329-80816d0c289a'::uuid,735.00,1735.00,196)) v(id,nb,tot,w) where l.id=v.id;
-- update public.payroll_lines set net_bonus=609.18, total=2109.18, employee_id=null, computed=null,
--        inputs='{"auto": true, "name": "سلمان المالكي", "deductions": "", "team_orders": "", "team_rating": "", "team_complaint_approved": ""}'
--  where id='8019df96-d5f8-43f7-b228-89c2c368981f';
-- update public.payroll_runs set notes=null where id='5d91c7f8-f011-48b9-8860-abc5cf9f3d89';
-- update public.payroll_runs set notes=split_part(notes,' | الدفع: مكافآت البايكرز',1) where id='ee06d014-ed5a-4e82-8513-fc041188a116';
-- commit;
-- ملاحظة: computed القديم لأسطر يوليو لا يُستعاد هنا (الواجهة تعيد حسابه من inputs)؛ القيم القديمة في سجل التدقيق أيضاً.
