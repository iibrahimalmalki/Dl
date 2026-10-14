-- ═══════════════════════════════════════════════════════════════════════════
-- custody_first_order_dates.sql — تاريخ استلام العهدة = تاريخ أول طلب للبايكر في سويتر (قاعدة المالك 2026-10-14)
-- الحالة: **طُبِّق جزئياً** — البند 1 (عريف) **طُبِّق 2026-10-14** (20 صفاً: 12 active + 8 due، المجموع 40 ⇒ 60). البندان 2 و3 (ميدول، رقيب) **لم يُطبَّقا** — كلٌّ بأمر «نفّذ».
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   أ) عريف (1624): لا عهدة له في custody_assets اليوم. تُسجَّل القائمة القياسية (20 صنفاً = الكتالوج عدا الجوال وخزان الماء)
--      بتاريخ أول طلب (تقديراً: أول شهر عمل)، المصدر handover:
--        • 12 صنفاً «active».
--        • 8 أصناف (الصدرية، حذاء السلامة، مواد التنظيف الست) كانت موجودة لكنها تالفة حسب جولة 2026-10-01 ⇒ «due»
--          بملاحظة «تالفة — جولة 2026-10-01 — تحتاج استبدال (قرار المالك)»، فتظهر «بانتظار الاستبدال» وفي إعادة الطلب. ليست «ناقصة».
--   ب) ميدول (1648) ورقيب (1700): عهدتهما (20 قطعة لكل منهما) مؤرّخة بأول جولة (القاعدة: ميدول 2026-08-07، رقيب 2026-08-05).
--      تُصحَّح البداية إلى تاريخ أول طلب، ويُعاد حساب النهاية = البداية + عمر الكتالوج (والعمر ومهلة التخطيط من الكتالوج)،
--      وتُلحق بالملاحظة جملة التصحيح والتاريخ السابق. القطع الحيّة فقط (active/due)؛ لا يُمسّ replaced/returned/missing.
--   حساب النهاية يطابق addMonths في الواجهة (src/custodyLifecycle.js): أول الشهر الهدف + (يوم البداية − 1)،
--   فبداية 31 يناير + شهر = 3 مارس كما في الواجهة (لا 28 فبراير).
--   «منتهي» = النهاية قبل اليوم؛ «قارب الانتهاء» = الباقي ≤ مهلة التخطيط (نفس dep() في Custody.jsx). الحالة المخزّنة تبقى active —
--   الانتهاء يُحسب من التاريخ في الواجهة.
-- التواريخ (قرار المالك 2026-10-14): التاريخ الدقيق لأول طلب غير متاح (sweater_bookings فارغ) ⇒ تقدير = أول يوم من أول شهر عمل
--   في ops_biker_month: عريف 1624 ⇒ 2026-01-01 · ميدول 1648 ⇒ 2026-02-01 · رقيب 1700 ⇒ 2026-03-01.
--   كل قطعة تحمل في ملاحظتها: «تاريخ تقديري = أول شهر عمل (قرار المالك 2026-10-14)».
-- الترتيب: بعد تطبيق #86. كل بند (1، 2، 3) معاملة مستقلة: تراجع إن اختلف العدد عن 20.
-- بلا drop ولا delete ⇒ يُطبَّق عبر الأداة. آمن لإعادة التشغيل (البند المطبَّق يُتخطّى بإشعار).
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 0) المعاينة (قراءة فقط) — ما سيصبح «منتهي» أو «قارب الانتهاء» بعد التصحيح ═══
-- تُشغَّل بعد تعبئة التواريخ الثلاثة، وتُرسل نتيجتها للمالك قبل البنود 1–3.
with p(code, first_order) as (values
    ('1624', date '2026-01-01'),   -- عريف
    ('1648', date '2026-02-01'),   -- ميدول
    ('1700', date '2026-03-01')),  -- رقيب
cat(k, name, life, lead, damaged) as (values
    ('moto','الدراجة النارية',36,90,false), ('uniform','الزي الرسمي',12,45,false), ('helmet','الخوذة',24,60,false),
    ('chest','الصدرية (واقي الصدر)',24,60,true), ('handsleg','واقي اليدين والأرجل',24,60,false), ('shoes','حذاء السلامة',12,45,true),
    ('vacuum','المكنسة',18,45,false), ('watergun','مسدس الماء',12,30,false), ('watermotor','موتور الماء',18,45,false),
    ('headlight','كشّاف الرأس',12,30,false), ('servicebox','صندوق الخدمة',24,45,false),
    ('brushes','الفرش (إطارات/مكيّف/أرضية/صغيرة)',6,14,false),
    ('dash','ملمّع الدَّشبورد',1,7,true), ('tyrepol','ملمّع الإطارات',1,7,true), ('stain','مزيل البقع',1,7,true),
    ('lasttouch','اللمسة الأخيرة',1,7,true), ('glass','منظّف الزجاج',1,7,true), ('soap','صابون/شامبو',1,7,true),
    ('sponge','إسفنجات (بودي/إطارات)',2,7,false), ('towels','مناشف ميكروفايبر (4 ألوان)',2,7,false)),
t as (select (now() at time zone 'Asia/Riyadh')::date as d),
rows_ as (
  -- عريف: الأصناف الـ20 المخطَّطة
  select e.name_en as biker, c.name, c.life, c.lead, null::date as old_start,
         case when c.damaged then 'due' else 'active' end as status
    from public.employees e cross join cat c where e.employee_id = '1624'
  union all
  -- ميدول ورقيب: القطع الحيّة القائمة
  select e.name_en, a.name, c.life, c.lead, a.start_date, a.status
    from public.custody_assets a join public.employees e on e.id = a.employee_id join cat c on c.name = a.name
   where e.employee_id in ('1648','1700') and a.status in ('active','due')),
calc as (
  select r.*, p.first_order as new_start,
         ((date_trunc('month', p.first_order) + make_interval(months => r.life))::date + (extract(day from p.first_order)::int - 1)) as new_end
    from rows_ r join public.employees e on e.name_en = r.biker join p on p.code = e.employee_id)
select biker, name, status, life as life_months, lead as lead_days, old_start, new_start, new_end,
       (new_end - t.d) as remaining_days,
       case when new_end < t.d then 'منتهي' when new_end - t.d <= lead then 'قارب الانتهاء' else 'سليم' end as state
  from calc, t
 order by biker, case when new_end < t.d then 0 when new_end - t.d <= lead then 1 else 2 end, new_end, name;


-- ═══ 1) عريف — تسجيل القائمة القياسية بتاريخ أول طلب (20 صفاً: 12 active + 8 due) ═══
do $$ declare
  v_date date := date '2026-01-01';   -- أول شهر عمل لعريف (تقدير — قرار المالك 2026-10-14)
  v_note_est constant text := 'تاريخ تقديري = أول شهر عمل (قرار المالك 2026-10-14)';
  v_note_due constant text := 'تالفة — جولة 2026-10-01 — تحتاج استبدال (قرار المالك)';
  v_today date := (now() at time zone 'Asia/Riyadh')::date;
  e record; n_have int; n_ins int; n_due int;
begin
  if to_regclass('public.my_custody_assets') is null then
    raise exception 'عريف: round_custody_check.sql (#86) لم يُطبَّق بعد — تراجع'; end if;
  if v_date > v_today or v_date < date '2020-01-01' then raise exception 'عريف: تاريخ غير مقبول % — تراجع', v_date; end if;
  select id, operator_id, full_name, employee_id into e from public.employees where employee_id = '1624';
  if e.id is null then raise exception 'عريف: الموظف 1624 غير موجود — تراجع'; end if;

  select count(*) into n_have from public.custody_assets where employee_id = e.id;
  if n_have = 20 and (select count(*) from public.custody_assets
                       where employee_id = e.id and source = 'handover' and start_date = v_date) = 20 then
    raise notice 'عريف: مطبَّق سابقاً (20 صفاً بتاريخ %) — لا تغيير', v_date; return; end if;
  if n_have <> 0 then raise exception 'عريف: له % صفاً في custody_assets (المتوقع 0) — تراجع', n_have; end if;

  insert into public.custody_assets (operator_id, employee_id, biker_name, sweater_id, item_type, category, name, name_en,
                                     start_date, life_months, end_date, lead_days, status, source, notes)
  select e.operator_id, e.id, e.full_name, e.employee_id, c.type, c.category, c.name, c.en,
         v_date, c.life, (date_trunc('month', v_date) + make_interval(months => c.life))::date + (extract(day from v_date)::int - 1),
         c.lead, case when c.damaged then 'due' else 'active' end, 'handover',
         case when c.damaged then v_note_due || ' · ' || v_note_est else 'تسليم عهدة ' || v_date || ' · ' || v_note_est end
    from (values
      ('الدراجة النارية','Motorcycle','motorcycle','مركبة',36,90,false),
      ('الزي الرسمي','Official Uniform','uniform','زي',12,45,false),
      ('الخوذة','Helmet','safety','معدات حماية',24,60,false),
      ('الصدرية (واقي الصدر)','Safety Chest','safety','معدات حماية',24,60,true),
      ('واقي اليدين والأرجل','Safety Hands & Legs','safety','معدات حماية',24,60,false),
      ('حذاء السلامة','Safety Shoes','safety','معدات حماية',12,45,true),
      ('المكنسة','Vacuum Cleaner','tool','أدوات',18,45,false),
      ('مسدس الماء','Water Gun','tool','أدوات',12,30,false),
      ('موتور الماء','Water Motor','tool','أدوات',18,45,false),
      ('كشّاف الرأس','Headlight','tool','أدوات',12,30,false),
      ('صندوق الخدمة','Service Box','tool','أدوات',24,45,false),
      ('الفرش (إطارات/مكيّف/أرضية/صغيرة)','Brushes set','tool','أدوات',6,14,false),
      ('ملمّع الدَّشبورد','Dashboard Polish','cleaning','مواد تنظيف',1,7,true),
      ('ملمّع الإطارات','Tyre Polish','cleaning','مواد تنظيف',1,7,true),
      ('مزيل البقع','Stain Remover','cleaning','مواد تنظيف',1,7,true),
      ('اللمسة الأخيرة','Last Touch','cleaning','مواد تنظيف',1,7,true),
      ('منظّف الزجاج','Glass Cleaner','cleaning','مواد تنظيف',1,7,true),
      ('صابون/شامبو','Soap/Shampoo','cleaning','مواد تنظيف',1,7,true),
      ('إسفنجات (بودي/إطارات)','Sponges','sponge','مستهلكات',2,7,false),
      ('مناشف ميكروفايبر (4 ألوان)','Microfiber towels','towel','مستهلكات',2,7,false)
    ) as c(name, en, type, category, life, lead, damaged);
  get diagnostics n_ins = row_count;
  select count(*) into n_due from public.custody_assets where employee_id = e.id and status = 'due';
  if n_ins <> 20 or n_due <> 8 then raise exception 'عريف: أُدرج % (المتوقع 20) ومنها due % (المتوقع 8) — تراجع', n_ins, n_due; end if;
  raise notice 'عريف: أُدرج 20 صفاً بتاريخ % (12 active + 8 due)', v_date;
end $$;


-- ═══ 2) ميدول — تصحيح البداية من أول جولة (2026-08-07) إلى أول طلب، والنهاية من عمر الكتالوج ═══
-- ═══ 3) رقيب — مثله (من 2026-08-05) ═══
-- البند نفسه لكلٍّ منهما: تُشغَّل الكتلة مرة لميدول ومرة لرقيب (معاملتان مستقلتان) بتغيير v_code فقط (التاريخان مثبّتان داخل الكتلة).
do $$ declare
  v_code text := '1648';            -- ميدول = 1648 · رقيب = 1700
  v_date date;                      -- أول شهر عمل (تقدير — قرار المالك 2026-10-14)
  v_note_est constant text := 'تاريخ تقديري = أول شهر عمل (قرار المالك 2026-10-14)';
  v_old  date;                      -- تاريخ أول جولة المسجّل حالياً (يُقرأ ويُتحقق منه)
  v_today date := (now() at time zone 'Asia/Riyadh')::date;
  -- عمر الكتالوج ومهلته بالاسم (src/custodyCatalog.js) — قوائم داخل الكتلة بلا جدول مؤقت (أداة MCP ترفض truncate)
  v_n text[] := array['الدراجة النارية','الزي الرسمي','الخوذة','الصدرية (واقي الصدر)','واقي اليدين والأرجل','حذاء السلامة',
    'المكنسة','مسدس الماء','موتور الماء','كشّاف الرأس','صندوق الخدمة','الفرش (إطارات/مكيّف/أرضية/صغيرة)','ملمّع الدَّشبورد',
    'ملمّع الإطارات','مزيل البقع','اللمسة الأخيرة','منظّف الزجاج','صابون/شامبو','إسفنجات (بودي/إطارات)','مناشف ميكروفايبر (4 ألوان)'];
  v_l int[] := array[36,12,24,24,24,12,18,12,18,12,24,6,1,1,1,1,1,1,2,2];
  v_d int[] := array[90,45,60,60,60,45,45,30,45,30,45,14,7,7,7,7,7,7,7,7];
  v_emp uuid; n_live int; n_old int; n_new int; n_bad int; n_upd int;
begin
  if to_regclass('public.my_custody_assets') is null then
    raise exception '%: round_custody_check.sql (#86) لم يُطبَّق بعد — تراجع', v_code; end if;
  v_old := case v_code when '1648' then date '2026-08-07' when '1700' then date '2026-08-05' end;
  v_date := case v_code when '1648' then date '2026-02-01' when '1700' then date '2026-03-01' end;
  if v_old is null then raise exception 'رمز غير متوقع % — تراجع', v_code; end if;
  if v_date > v_old or v_date < date '2020-01-01' then
    raise exception '%: تاريخ أول طلب % غير مقبول (يجب أن يسبق أول جولة %) — تراجع', v_code, v_date, v_old; end if;
  select id into v_emp from public.employees where employee_id = v_code;
  if v_emp is null then raise exception '%: الموظف غير موجود — تراجع', v_code; end if;

  select count(*), count(*) filter (where a.start_date = v_old), count(*) filter (where a.start_date = v_date),
         count(*) filter (where c.name is null)
    into n_live, n_old, n_new, n_bad
    from public.custody_assets a left join unnest(v_n, v_l, v_d) as c(name, life, lead) on c.name = a.name
   where a.employee_id = v_emp and a.status in ('active','due');
  if n_live = 20 and n_new = 20 then raise notice '%: مطبَّق سابقاً (20 قطعة بتاريخ %) — لا تغيير', v_code, v_date; return; end if;
  if n_live <> 20 or n_old <> 20 or n_bad <> 0 then
    raise exception '%: القطع الحيّة % وبتاريخ % عددها % وخارج الكتالوج % (المتوقع 20/20/0) — تراجع', v_code, n_live, v_old, n_old, n_bad; end if;

  update public.custody_assets a
     set start_date = v_date,
         life_months = c.life,
         lead_days = c.lead,
         end_date = (date_trunc('month', v_date) + make_interval(months => c.life))::date + (extract(day from v_date)::int - 1),
         notes = concat_ws(' · ', nullif(a.notes, ''),
                           'صُحّح التاريخ ' || v_today || ' إلى أول شهر عمل (كان ' || v_old || ' — أول جولة)', v_note_est)
    from unnest(v_n, v_l, v_d) as c(name, life, lead)
   where c.name = a.name and a.employee_id = v_emp and a.status in ('active','due') and a.start_date = v_old;
  get diagnostics n_upd = row_count;
  if n_upd <> 20 then raise exception '%: صُحّح % (المتوقع 20) — تراجع', v_code, n_upd; end if;
  raise notice '%: صُحّحت 20 قطعة من % إلى %', v_code, v_old, v_date;
end $$;


-- ═══ التحقق (قراءة فقط) ═══
-- لكل بايكر: العدد والحالة والتواريخ — المتوقع 20 صفاً حيّاً لكلٍّ من الثلاثة، وعريف 8 due.
select e.name_en, a.status, count(*) n, min(a.start_date) start_min, max(a.start_date) start_max,
       count(*) filter (where a.end_date <> (date_trunc('month', a.start_date) + make_interval(months => a.life_months::int))::date
                                             + (extract(day from a.start_date)::int - 1)) as end_mismatch
  from public.custody_assets a join public.employees e on e.id = a.employee_id
 where e.employee_id in ('1624','1648','1700')
 group by 1, 2 order by 1, 2;
-- سجل التدقيق: audit_capture (trg_custody_assets_audit) يحفظ القيم القديمة لكل صف مُعدَّل.


-- ═══ التراجع (يدوي — يشغّله المالك من SQL Editor) ═══
-- عريف (يحذف ما أدرجه البند 1 فقط):
--   delete from public.custody_assets a using public.employees e
--    where e.id = a.employee_id and e.employee_id = '1624' and a.source = 'handover' and a.start_date = '<تاريخ عريف>';
-- ميدول/رقيب (يعيد تاريخ أول جولة؛ النهاية من العمر بالحساب نفسه، وتُزال جملة التصحيح من الملاحظة):
--   update public.custody_assets a
--      set start_date = '<2026-08-07 لميدول | 2026-08-05 لرقيب>',
--          end_date = (date_trunc('month', date '<التاريخ نفسه>') + make_interval(months => a.life_months::int))::date
--                     + (extract(day from date '<التاريخ نفسه>')::int - 1),
--          notes = nullif(regexp_replace(a.notes, '( · )?صُحّح التاريخ [0-9-]+ إلى أول شهر عمل \(كان [0-9-]+ — أول جولة\) · تاريخ تقديري = أول شهر عمل \(قرار المالك 2026-10-14\)', ''), '')
--     from public.employees e
--    where e.id = a.employee_id and e.employee_id = '<1648|1700>' and a.status in ('active','due') and a.start_date = '<تاريخ أول طلب>';
