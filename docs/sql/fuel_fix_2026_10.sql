-- ═══ تصحيح طلبات وقود عريف (1624) — أكتوبر 2026 ═══
-- المشروع: cnmggdrlkgsyrjxmvydv · قرار المالك 2026-10-15 · يُطبَّق بعد docs/sql/fuel_wallet.sql (القسمين A و B)
-- الحالة: البند 1 **طُبِّق 2026-10-16** (صف واحد) · البند 2 **طُبِّق 2026-10-16** (صفّان) · البند 3 **لم يُطبَّق**
--
-- وقائع مقروءة من الإنتاج 2026-10-15 (الأوقات بتوقيت الرياض = UTC+3):
--   5f1f85eb-a38d-4b50-8176-5d84d3562dd2  طُلب 13/10 00:09  closed  حُوِّل 50 ﷼ — مؤكد من البنك (التحويل 12/10 07:40 PM، رسوم 0.58)
--   4044c7f7-939f-4682-a6a6-dc6f309fc622  طُلب 13/10 20:09  closed  نص البنك نفسه (تكرار — لم يُحوَّل له مال)
--   4523405b-489a-4a1a-97e6-12c0fdb41e35  طُلب 13/10 20:10  closed  نص البنك نفسه (تكرار — لم يُحوَّل له مال)
--   01ce2212-ed5d-47dd-ab23-836a73ac9f31  طُلب 15/10 19:50  requested  5050 ﷼ (خطأ إدخال)
--   تعبئتا عريف: cc3c783e-0d02-48f0-b597-68cf23b839de (20 ﷼، 13/10، بلا ربط) و 0c26ed61-1cc9-45e3-b1bd-6f3381baa311 (15 ﷼، 15/10، مربوطة بـ 4044c7f7)
--   TEST-0000 (TEST01) مستبعد: لا يُمسّ.
--
-- كل بند في معاملة مستقلة يتحقق من العدد المتوقع بالضبط، وإلا يتراجع. بلا كلمات الحذف ⇒ عبر الأداة.

-- ═══ البند 1: إلغاء طلب 5050 ﷼ (صف واحد بالضبط) ═══
do $$ declare n int; begin
  update public.fuel_requests set status = 'cancelled', closed_at = now(),
         reject_reason = 'خطأ إدخال 5050 ﷼ — أُلغي (قرار المالك 2026-10-15)'
   where id = '01ce2212-ed5d-47dd-ab23-836a73ac9f31' and biker_employee_id = '1624' and status = 'requested' and amount = 5050;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'البند 1: المتوقع صف واحد، تأثّر %', n; end if;
end $$;

-- ═══ البند 2: الطلبان المكرران (20:09 و 20:10) ⇒ ملغيان كغير محوَّلين (صفّان بالضبط) ═══
do $$ declare n int; begin
  -- transfer_ref (نص البنك) يبقى دليلاً على التكرار؛ يُفرَّغ التحويل نفسه فقط
  update public.fuel_requests set status = 'cancelled', transferred_at = null, transferred_by = null,
         bank_txn = null, amount_actual = null, fee = 0,
         reject_reason = 'تكرار لطلب 13/10 00:09 — نفس تحويل البنك، لم يُحوَّل له مال (قرار المالك 2026-10-15)'
   where id in ('4044c7f7-939f-4682-a6a6-dc6f309fc622', '4523405b-489a-4a1a-97e6-12c0fdb41e35')
     and biker_employee_id = '1624' and status = 'closed';
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'البند 2: المتوقع صفّان، تأثّر %', n; end if;
end $$;

-- ═══ البند 3: طلب 13/10 00:09 يبقى محوَّلاً بـ 50 ﷼ (رسوم 0.58)، وتعبئتا 20 و 15 ﷼ تُربطان به (صف + صفّان) ═══
do $$ declare n int; m int; begin
  update public.fuel_requests set status = 'transferred', closed_at = null, amount_actual = 50, fee = 0.58
   where id = '5f1f85eb-a38d-4b50-8176-5d84d3562dd2' and biker_employee_id = '1624' and status in ('closed', 'transferred') and transferred_at is not null;
  get diagnostics n = row_count;
  update public.fuel_logs set request_id = '5f1f85eb-a38d-4b50-8176-5d84d3562dd2'
   where id in ('cc3c783e-0d02-48f0-b597-68cf23b839de', '0c26ed61-1cc9-45e3-b1bd-6f3381baa311')
     and biker_employee_id = '1624' and not legacy and amount in (20, 15);
  get diagnostics m = row_count;
  if n <> 1 or m <> 2 then raise exception 'البند 3: المتوقع 1 طلب و 2 تعبئة، تأثّر % و %', n, m; end if;
end $$;

-- ═══ التحقق (قراءة فقط) ═══
-- الأرصدة المتوقعة: عريف 15، ميدول 50، رقيب 50
-- select b, public.fuel_balance(b) as balance from (values ('1624'), ('1648'), ('1700')) t(b) order by b;   -- 1624=15 · 1648=50 · 1700=50
-- select id, status, amount, amount_actual, fee, transferred_at is not null as tr, reject_reason from public.fuel_requests
--  where biker_employee_id = '1624' order by requested_at;   -- 5f1f85eb transferred 50/0.58 · الباقي cancelled
-- select id, amount, request_id from public.fuel_logs where biker_employee_id = '1624' and not legacy;   -- كلاهما ⇒ 5f1f85eb
-- select count(*) from public.fuel_requests where biker_employee_id = 'TEST01' and status = 'transferred';   -- 1 (لم يُمسّ)
-- لا طلب تلقائي لعريف: الرصيد 15 ≥ العتبة 10 ⇒ select count(*) from public.fuel_requests where biker_employee_id='1624' and status='requested';  -- 0

-- ═══ تراجع (عبر الأداة، كل بند بعكسه) ═══
-- البند 3: update public.fuel_requests set status='closed', closed_at='2026-10-15 16:50:16.307602+00' where id='5f1f85eb-a38d-4b50-8176-5d84d3562dd2';
--          update public.fuel_logs set request_id=null where id='cc3c783e-0d02-48f0-b597-68cf23b839de';
--          update public.fuel_logs set request_id='4044c7f7-939f-4682-a6a6-dc6f309fc622' where id='0c26ed61-1cc9-45e3-b1bd-6f3381baa311';
-- البند 2 (القيم المقروءة من الإنتاج 2026-10-15؛ transferred_by يُعاد من audit_log إن لزم):
--   update public.fuel_requests set status='closed', reject_reason=null, amount_actual=50, fee=0.58, transferred_at='2026-10-14 22:32:47.55625+00'
--    where id='4044c7f7-939f-4682-a6a6-dc6f309fc622';
--   update public.fuel_requests set status='closed', reject_reason=null, amount_actual=50, fee=0.58, transferred_at='2026-10-14 22:32:27.496155+00'
--    where id='4523405b-489a-4a1a-97e6-12c0fdb41e35';
-- البند 1: update public.fuel_requests set status='requested', closed_at=null, reject_reason=null where id='01ce2212-ed5d-47dd-ab23-836a73ac9f31';
--          (يتطلب ألا يوجد طلب «مطلوب» آخر لعريف — فهرس الطلب المفتوح الواحد)
