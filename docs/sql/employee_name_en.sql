-- ═══════════════════════════════════════════════════════════════════════════
-- employee_name_en.sql — خانة «الاسم بالإنجليزي» في ملف الموظف (قرار المالك 2026-10-14)
-- الحالة: **طُبِّق 2026-10-14** (عبر الأداة: 5 صفوف مُعبّأة — Rakib لا Mohamad، وعدد الموظفين 8 قبل وبعد)
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   رسالة الواتساب (src/payrollMessage.js) تأخذ السطر الإنجليزي من name_en، وعند الفراغ الاسم الأول من full_name المسجّل.
--   السبب: الاسم المسجّل لرقيب «Mohamad Rakib» مطابق للإقامة والبنك ولا يُعدَّل، والمطلوب في الرسالة «Rakib».
--   نفس أسلوب employee_display_names.sql (name_ar/name_bn): تعبئة مبدئية للخمسة بالمعرّف، والخانة الفارغة فقط، والخمسة يجب أن يوجدوا.
--   القيم من المالك: Ariful · Midul · Rakib · Abed · Salman. العمود يرث صلاحيات employees القائمة — لا تغيير في السياسات.
-- الترتيب: يُطبَّق قبل دمج PR الواجهة (صفحة الرواتب تقرأ العمود؛ قبل وجوده يفشل تحميلها).
-- بلا drop ولا delete ⇒ يُطبَّق عبر الأداة. آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 1) العمود ═══
alter table public.employees add column if not exists name_en text;
comment on column public.employees.name_en is 'اسم العرض بالإنجليزي (رسائل الواتساب) — فارغ ⇒ الاسم الأول من full_name';

-- ═══ 2) التعبئة المبدئية — الخمسة موجودون كلهم، ويُحدَّث بالضبط من كانت خانته فارغة (وإلا تراجع) ═══
do $$ declare n int; found_ int; expected int;
  v_ids uuid[] := array['e5d45ef0-0f7c-4c87-8c33-6c9d44dfa2a2',   -- 1624 Ariful Islam
                        '47793dbb-f84f-495c-9458-1d8ac9a277aa',   -- 1648 Midul Hassan
                        '6bc2d2be-3c7c-40d2-85fd-e7a0e290ec08',   -- 1700 Mohamad Rakib
                        'f3bb50ed-86f4-468f-a2d9-1eaf5369d859',   -- 2637651411 Abed mia
                        '80d65b02-9428-4484-8b27-ffb0ad8a96a8']::uuid[];  -- سلمان المالكي، المشرف
  v_en text[] := array['Ariful', 'Midul', 'Rakib', 'Abed', 'Salman'];
begin
  select count(*), count(*) filter (where nullif(btrim(e.name_en), '') is null)
    into found_, expected from public.employees e where e.id = any(v_ids);
  if found_ <> 5 then raise exception 'الاسم بالإنجليزي: وُجد % من 5 موظفين — تراجع', found_; end if;
  update public.employees e set name_en = v.en
    from unnest(v_ids, v_en) as v(id, en)
   where e.id = v.id and nullif(btrim(e.name_en), '') is null;
  get diagnostics n = row_count;
  if n <> expected then raise exception 'الاسم بالإنجليزي: تأثّر % صفوف بدل % — تراجع', n, expected; end if;
end $$;

-- ═══ التحقق ═══
-- select employee_id, full_name, name_en from public.employees where name_en is not null order by 1;  -- 5 صفوف
-- select count(*) from public.employees;                                                             -- كما قبل (8)

-- ═══ التراجع ═══
-- عبر الأداة (بلا حذف): update public.employees set name_en = null;
-- من SQL Editor:        alter table public.employees drop column if exists name_en;
