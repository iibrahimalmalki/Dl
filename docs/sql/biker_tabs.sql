-- صلاحيات بوابة البايكر: أيّ التبويبات تظهر للبايكرز، وأيّها في الشريط السفلي للجوال
-- الحالة: مقترح — لا يُطبَّق على الإنتاج قبل موافقة المالك.
--
-- إعداد عام واحد لكل البايكرز (لا استثناء لبايكر معيّن): صف لكل تبويب.
-- «ملفي» (profile) لا صف له: ظاهر دائماً وأول الشريط السفلي.
-- الجدول الفارغ = الوضع الحالي تماماً (كل التبويبات ظاهرة، والشريط: الدراجة · الاستلام · الأكاديمية)،
--   فتطبيق هذا الملف وحده لا يغيّر شيئاً على البايكرز حتى يحفظ المالك من صفحة «صلاحيات البايكرز».
-- القراءة: كل مستخدم مسجّل (البوابة تحتاجها). الكتابة: المالك فقط (public.is_owner() الموجودة).
-- هذا إخفاء في الواجهة؛ حماية البيانات نفسها تبقى على سياسات جداولها الحالية.

begin;

create table public.biker_tab_rules (
  tab_key       text primary key
                check (tab_key in ('handover','fuel','perf','docs','assets','daily','academy')),
  visible       boolean not null default true,
  in_bottom_nav boolean not null default false,
  note          text,
  updated_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now()
);

alter table public.biker_tab_rules enable row level security;

create policy p_btab_sel on public.biker_tab_rules for select to authenticated using (true);
create policy p_btab_ins on public.biker_tab_rules for insert to authenticated with check (public.is_owner());
create policy p_btab_upd on public.biker_tab_rules for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy p_btab_del on public.biker_tab_rules for delete to authenticated using (public.is_owner());

revoke all on public.biker_tab_rules from anon;
grant select, insert, update, delete on public.biker_tab_rules to authenticated;

commit;

-- ── التحقق بعد التطبيق (قراءة فقط) ──
-- select * from public.biker_tab_rules;                                   -- فارغ
-- select policyname, cmd from pg_policies where tablename = 'biker_tab_rules';   -- 4 سياسات

-- ── التراجع (البوابة تعود تلقائياً إلى إظهار الكل) ──
-- begin;
-- drop table if exists public.biker_tab_rules;   -- يحذف السياسات معه
-- commit;
