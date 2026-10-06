-- ═══ تنظيف ملفات «صور» الشكاوى غير الصورية — مقترح، لا يُطبَّق قبل موافقة المالك ═══
-- السبب (06/10/2026): لصق رابط صفحة التذكرة (ssp-portal.sweater.sa/tickets/<n>) في «رابط الصورة»
-- جعل ticket-image-pull يحفظ صفحة HTML (2,431 بايت) باسم .jpg.
-- الحالة المقروءة من الإنتاج 06/10/2026:
--   • 7 ملفات text/html في sweater-tickets (5330679 ×3، 5332480 ×4) — لا يشير إليها أي صف حالياً
--     (فُحص: stored_pics و stored_pic_path ⇒ 0 مراجع)، أي أنها يتيمة.
--   • شكويان تحفظان رابط الصفحة في sweater_pic_url:
--       #135 (سويتر 101463، حجز 5330679، Ariful)  → https://ssp-portal.sweater.sa/tickets/101496  ← رقم مخالف لشكواها!
--       #134 (سويتر 101496، حجز 5332480، Rakib)   → https://ssp-portal.sweater.sa/tickets/101496
--     #135: has_image=false و stored_pics فارغ. #134: صورها الثلاث JPEG سليمة (124,710 · 81,412 · 134,003 بايت).

-- ── 1) السرد (قراءة فقط) ──
select o.name, o.metadata->>'mimetype' as mime, (o.metadata->>'size')::int as size, o.created_at,
       (select string_agg('#'||t.ticket_no||' / '||coalesce(t.sweater_ticket_no,'—'), ', ')
          from public.ops_tickets t where t.stored_pics ? o.name or t.stored_pic_path = o.name) as referenced_by
from storage.objects o
where o.bucket_id = 'sweater-tickets' and coalesce(o.metadata->>'mimetype','') not like 'image/%'
order by o.name;

select ticket_no, sweater_ticket_no, booking_ref, biker_name, has_image, stored_pic_path, stored_pics, sweater_pic_url
from public.ops_tickets
where sweater_pic_url ~* 'ssp-portal\.sweater\.sa/tickets/\d+'
   or exists (select 1 from storage.objects o where o.bucket_id='sweater-tickets'
              and coalesce(o.metadata->>'mimetype','') not like 'image/%'
              and (ops_tickets.stored_pics ? o.name or ops_tickets.stored_pic_path = o.name));

-- ── 2) التصحيح المقترح (بعد الموافقة) ──
/*
begin;
-- أ) إزالة أي مرجع لملف غير صوري من stored_pics، وتصحيح stored_pic_path و has_image تبعاً لذلك
with bad as (
  select name from storage.objects
  where bucket_id = 'sweater-tickets' and coalesce(metadata->>'mimetype','') not like 'image/%'
), fixed as (
  select t.id,
         coalesce((select jsonb_agg(p) from jsonb_array_elements_text(t.stored_pics) p where p not in (select name from bad)), '[]'::jsonb) as pics
  from public.ops_tickets t
  where t.stored_pics ?| array(select name from bad) or t.stored_pic_path in (select name from bad)
)
update public.ops_tickets t
   set stored_pics = f.pics,
       stored_pic_path = case when t.stored_pic_path in (select name from bad) or t.stored_pic_path is null then f.pics->>0 else t.stored_pic_path end,
       has_image = jsonb_array_length(f.pics) > 0
  from fixed f where f.id = t.id;          -- اليوم: 0 صفوف (لا مراجع)

-- ب) رابط صفحة التذكرة ليس رابط صورة: يُفرَّغ (لا يُعرض صورة ولا يُسحب منه)
update public.ops_tickets set sweater_pic_url = null
 where sweater_pic_url ~* 'ssp-portal\.sweater\.sa/tickets/\d+';   -- اليوم: #134 و #135

commit;

-- ج) حذف الملفات اليتيمة السبعة — من لوحة Supabase (Storage ← sweater-tickets) أو بواجهة التخزين،
--    لا بـ delete على storage.objects مباشرة (لا يحذف الملف الفعلي من التخزين):
--    2026-07/5330679.jpg
--    2026-07/5330679-u1791303928898.jpg
--    2026-07/5330679-u1791304055656.jpg
--    2026-07/5332480-u1791302542994.jpg
--    2026-07/5332480-u1791302602389.jpg
--    2026-07/5332480-u1791302978820.jpg
--    2026-07/5332480-u1791303000248.jpg
*/
