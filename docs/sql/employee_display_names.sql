-- ═══════════════════════════════════════════════════════════════════════════
-- employee_display_names.sql — خانتا «الاسم بالعربي» و«الاسم بالبنغالي» في ملف الموظف (قرار المالك 2026-10-14)
-- الحالة: **لم يُطبَّق**
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   رسالة الواتساب (src/payrollMessage.js) تقرأ اسم العرض من ملف الموظف بدل الأسماء المكتوبة في الكود:
--     • name_ar — الاسم بالعربي (مثل «ميدول»)        • name_bn — الاسم بالحروف البنغالية (مثل «মিদুল»)
--     فارغة ⇒ الرسالة تستخدم الاسم الأول من full_name المسجّل.
--   تُعبّأ مبدئياً للخمسة (بالمعرّف لا بالاسم): البايكرز الأربعة + المشرف سلمان.
--   القيم من المالك: عريف/আরিফুল · رقيب/রাকিব · ميدول/মিদুল. ومقترحة للمراجعة: عابد/আবেদ · سلمان/সালমান.
--   تُعبَّأ الخانة الفارغة فقط (لا تكتب فوق ما يُدخل لاحقاً من ملف الموظف)، والخمسة يجب أن يوجدوا كلهم.
--   الأعمدة ترث صلاحيات employees القائمة (القراءة والتعديل لمن له الصلاحية) — لا تغيير في السياسات.
--
-- وقائع 2026-10-14 (قراءة): employees بلا name_ar/name_bn (أعمدة الأسماء: full_name, referrer_name, relative_name).
--   الخمسة: 1624 Ariful Islam · 1648 Midul Hassan · 1700 Mohamad Rakib · 2637651411 Abed mia · سلمان المالكي (supervisor).
-- الترتيب: يُطبَّق هذا الملف قبل دمج PR الواجهة (الواجهة تقرأ العمودين؛ قبل وجودهما يفشل تحميل صفحة الرواتب).
-- بلا drop ولا delete ⇒ يُطبَّق عبر الأداة. آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 1) العمودان ═══
alter table public.employees add column if not exists name_ar text;
alter table public.employees add column if not exists name_bn text;
comment on column public.employees.name_ar is 'اسم العرض بالعربي (رسائل الواتساب) — فارغ ⇒ الاسم الأول من full_name';
comment on column public.employees.name_bn is 'اسم العرض بالحروف البنغالية (رسائل الواتساب) — فارغ ⇒ الاسم الأول من full_name';

-- ═══ 2) التعبئة المبدئية — الخمسة موجودون كلهم، ويُحدَّث بالضبط من كانت له خانة فارغة (وإلا تراجع) ═══
do $$ declare n int; found_ int; expected int; begin
  create temp table _names (id uuid primary key, ar text, bn text) on commit drop;
  insert into _names values
    ('e5d45ef0-0f7c-4c87-8c33-6c9d44dfa2a2', 'عريف',  'আরিফুল'),  -- 1624 Ariful Islam
    ('47793dbb-f84f-495c-9458-1d8ac9a277aa', 'ميدول', 'মিদুল'),   -- 1648 Midul Hassan
    ('6bc2d2be-3c7c-40d2-85fd-e7a0e290ec08', 'رقيب',  'রাকিব'),   -- 1700 Mohamad Rakib
    ('f3bb50ed-86f4-468f-a2d9-1eaf5369d859', 'عابد',  'আবেদ'),    -- 2637651411 Abed mia (مقترح)
    ('80d65b02-9428-4484-8b27-ffb0ad8a96a8', 'سلمان', 'সালমান');  -- سلمان المالكي، المشرف (مقترح)
  select count(*), count(*) filter (where nullif(btrim(e.name_ar), '') is null or nullif(btrim(e.name_bn), '') is null)
    into found_, expected from public.employees e join _names v on v.id = e.id;
  if found_ <> 5 then raise exception 'أسماء العرض: وُجد % من 5 موظفين — تراجع', found_; end if;
  update public.employees e set name_ar = coalesce(nullif(btrim(e.name_ar), ''), v.ar), name_bn = coalesce(nullif(btrim(e.name_bn), ''), v.bn)
    from _names v
   where e.id = v.id and (nullif(btrim(e.name_ar), '') is null or nullif(btrim(e.name_bn), '') is null);
  get diagnostics n = row_count;
  if n <> expected then raise exception 'أسماء العرض: تأثّر % صفوف بدل % — تراجع', n, expected; end if;
end $$;

-- ═══ التحقق ═══
-- select employee_id, full_name, name_ar, name_bn from public.employees where name_ar is not null or name_bn is not null order by 1;  -- 5 صفوف
-- select count(*) from public.employees;                                                                                              -- كما قبل

-- ═══ التراجع ═══
-- عبر الأداة (بلا حذف): update public.employees set name_ar = null, name_bn = null;
-- من SQL Editor:        alter table public.employees drop column if exists name_ar, drop column if exists name_bn;
