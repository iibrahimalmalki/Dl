-- ═══ تقرير شكاوى البايكر (عربي + বাংলা): نصوص تظهر للبايكر في ops_tickets ═══
-- المشروع: cnmggdrlkgsyrjxmvydv · الحالة: **طُبِّق 2026-10-13** (migration ops_tickets_bn، بأمر المالك؛ تحقّق: 3 أعمدة text تقبل الفراغ، 0 من 162 شكوى معبّأة).
--
-- الطلب (المالك 2026-10-12): تقرير شهري لكل بايكر بالصور يُطبع PDF ويُرسل له، وكل نص فيه عربي وتحته بنغالي.
-- ثلاثة حقول نصية اختيارية يعبّئها المشرف من «تعديل الشكوى»، ولا تُستعمل إلا في التقرير المطبوع:
--   • desc_bn   — شكوى العميل بالبنغالي (طلب المالك).
--   • reason_bn — سبب الاحتساب/الرفض بالبنغالي (طلب المالك).
--   • reason_ar — سبب الاحتساب/الرفض بالعربي (إضافة: لا حقل عام للسبب اليوم؛ qc_notes داخلية ولا تُعرض للبايكر).
--     فارغ ⇒ يعرض التقرير نصاً ثابتاً حسب القرار (src/complaintsReport.js: DEFAULT_REASON).
-- لا تغيير في السياسات ولا الصلاحيات: الأعمدة ترث صلاحيات ops_tickets القائمة (القراءة والتعديل لمن له complaints).
-- الترتيب: تطبيق هذا الملف أولاً ثم دمج PR الواجهة (حفظ «تعديل الشكوى» يرسل الحقول الثلاثة).
-- بلا كلمة الحذف في التنفيذ (أداة MCP تتعطل عليها)؛ التراجع آخر الملف من SQL Editor.

-- ═══ 1) الأعمدة ═══
alter table public.ops_tickets add column if not exists desc_bn text;
alter table public.ops_tickets add column if not exists reason_ar text;
alter table public.ops_tickets add column if not exists reason_bn text;
comment on column public.ops_tickets.desc_bn is 'شكوى العميل بالبنغالي — تظهر للبايكر في تقرير الشكاوى المطبوع';
comment on column public.ops_tickets.reason_ar is 'سبب الاحتساب/الرفض الظاهر للبايكر (عربي) — غير qc_notes الداخلية';
comment on column public.ops_tickets.reason_bn is 'سبب الاحتساب/الرفض الظاهر للبايكر (بنغالي)';

-- ═══ تحقق بالقراءة بعد التطبيق ═══
-- select column_name, data_type, is_nullable from information_schema.columns
--   where table_schema='public' and table_name='ops_tickets' and column_name in ('desc_bn','reason_ar','reason_bn') order by 1;  -- 3 × text / YES
-- select count(*) from ops_tickets where desc_bn is not null or reason_ar is not null or reason_bn is not null;  -- 0

-- ═══ تراجع (من SQL Editor) ═══
-- alter table public.ops_tickets drop column if exists desc_bn, drop column if exists reason_ar, drop column if exists reason_bn;
