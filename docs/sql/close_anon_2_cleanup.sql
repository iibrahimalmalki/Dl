-- ═══ إغلاق الوصول المجهول — المرحلة 2: تنظيف السياسات القديمة ═══
-- الحالة: **لم يُطبَّق** — يشغّله المالك من SQL Editor (الأداة تنتهي مهلتها على drop policy).
-- الجزء الفعّال من close_anon_2.sql (الدوال الأربع + revoke) طُبِّق 2026-10-11 بأمر المالك عبر apply_migration؛
-- هذه السياسات بلا أثر منذ سحب صلاحيات anon، وحذفها تنظيف فقط. آمن لإعادة التشغيل.
drop policy if exists anon_select on public.applicants;
drop policy if exists anon_insert on public.applicants;
drop policy if exists anon_update on public.applicants;
drop policy if exists iv_anon_select on public.interview_sessions;
drop policy if exists iv_anon_update on public.interview_sessions;
drop policy if exists tma_inv_anon_read on public.tma_invites;
drop policy if exists tma_inv_anon_answer on public.tma_invites;
-- تحقق: select tablename, policyname from pg_policies where tablename in ('applicants','interview_sessions','tma_invites') and roles::text like '%anon%';  -- لا صفوف
