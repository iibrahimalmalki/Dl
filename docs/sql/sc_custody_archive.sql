-- ═══════════════════════════════════════════════════════════════════════════
-- sc_custody_archive.sql — تعليم صفوف sc_custody التجريبية وإقفال الجدول للكتابة (قرار المالك 2026-10-14)
-- الحالة: **طُبِّق 2026-10-14** (عبر الأداة بعد دمج #89 ونشره؛ معاملتان: تعليم 24 من 24 صفاً، ثم إقفال ins/upd/del = false والقراءة باقية)
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   المالك أكّد أن الصفوف الـ24 في sc_custody تجريبية: رقيب (1700)، 2026-08-02 بين 13:06:05 و13:06:11 UTC، أصناف مكرّرة.
--   custody_assets هو المرجع الوحيد للعهد (docs/design/custody_unify_plan.md).
--   1) تعليم الـ24 في note (بلا حذف): «تجريبي — …». الحالات (lost/returned) لا تُمسّ ولا تُنقل إلى سجل البايكر.
--   2) إقفال الكتابة: سياسات الإدراج/التعديل/الحذف ⇒ false (عبر alter policy، بلا drop). القراءة تبقى (أرشيف).
-- وقائع 2026-10-14 (قراءة): 24 صفاً كلها employee_id = رقيب و assigned_at 2026-08-02 13:06:05→13:06:11، note فارغة في الكل،
--   sc_items = 0، sc_moves = 0. السياسات: sc_custody_ins/upd/del/sel.
-- يُطبَّق بعد دمج PR الواجهة الذي يحوّل تبويب «العُهد» في سلاسل الإمداد إلى custody_assets (وإلا يفشل «تسليم عهدة» القديم).
-- آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 1) تعليم الـ24 (يُتراجع إن تأثّر غير العدد المتوقع) ═══
do $$ declare n int; expected int; begin
  select count(*) into expected from public.sc_custody
   where employee_id = '6bc2d2be-3c7c-40d2-85fd-e7a0e290ec08'
     and assigned_at >= '2026-08-02 13:06:00+00' and assigned_at < '2026-08-02 13:07:00+00'
     and coalesce(note, '') not like 'تجريبي%';
  if expected not in (0, 24) then raise exception 'sc_custody: وُجد % صفاً للتعليم بدل 24 — تراجع', expected; end if;
  update public.sc_custody set note = 'تجريبي — إدخال اختبار 2026-08-02 (تأكيد المالك 2026-10-14)، لا يُعتدّ به'
   where employee_id = '6bc2d2be-3c7c-40d2-85fd-e7a0e290ec08'
     and assigned_at >= '2026-08-02 13:06:00+00' and assigned_at < '2026-08-02 13:07:00+00'
     and coalesce(note, '') not like 'تجريبي%';
  get diagnostics n = row_count;
  if n <> expected then raise exception 'sc_custody: تأثّر % صفوف بدل % — تراجع', n, expected; end if;
  if (select count(*) from public.sc_custody where coalesce(note, '') not like 'تجريبي%') <> 0 then
    raise exception 'sc_custody: توجد صفوف غير التجريبية — تراجع وراجع قبل الإقفال';
  end if;
end $$;

-- ═══ 2) إقفال الكتابة (القراءة تبقى للأرشيف) ═══
alter policy sc_custody_ins on public.sc_custody with check (false);
alter policy sc_custody_upd on public.sc_custody using (false);
alter policy sc_custody_del on public.sc_custody using (false);
comment on table public.sc_custody is 'أرشيف — مُقفل للكتابة منذ 2026-10-14. المرجع الوحيد للعهد: custody_assets.';

-- ═══ التحقق ═══
-- select count(*), count(*) filter (where note like 'تجريبي%') from public.sc_custody;                     -- 24 · 24
-- select policyname, cmd, qual, with_check from pg_policies where tablename = 'sc_custody' order by 1;     -- ins/upd/del = false

-- ═══ التراجع (عبر الأداة، بلا حذف) ═══
-- alter policy sc_custody_ins on public.sc_custody with check (has_perm('supply', true) or has_perm('vendors', true));
-- alter policy sc_custody_upd on public.sc_custody using (has_perm('supply', true) or has_perm('vendors', true));
-- alter policy sc_custody_del on public.sc_custody using (has_perm('supply', true) or has_perm('vendors', true));
-- update public.sc_custody set note = null where note like 'تجريبي — إدخال اختبار 2026-08-02%';
