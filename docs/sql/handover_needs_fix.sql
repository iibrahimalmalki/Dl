-- «يحتاج تصحيح» في مراجعة استلام الدراجة: إشعار للبايكر عند الإرجاع.
-- الحالة: لم يُطبَّق — بانتظار موافقة المالك. آمن لإعادة التشغيل. لا يغيّر أي جدول ولا سياسة؛ يسحب تنفيذ push_notification من العموم.
--
-- ما يعمل بلا هذا الملف: الإرجاع نفسه (status='needs_fix' + checklist.fix) — العمود status نص بلا قيد CHECK،
-- وسياسة bh_upd تسمح بالتعديل لمن يملك تعديل «الأسطول». الواجهة تعرض الحالة للبايكر في تبويب «الدراجة».
-- لماذا SQL للإشعار: لا سياسة INSERT على notifications للمسجّلين، والمشرف لا يقرأ app_users ليعرف حساب البايكر.
-- الحل: مشغّل (security definer) على bike_handovers يرسل push_notification('user', …) لحساب البايكر.

create or replace function public.bike_handover_fix_notify()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid; v_reason text;
begin
  if new.status is distinct from 'needs_fix' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'needs_fix'
     and (old.checklist -> 'fix' ->> 'reason') is not distinct from (new.checklist -> 'fix' ->> 'reason') then return new; end if;
  v_reason := coalesce(nullif(btrim(new.checklist -> 'fix' ->> 'reason'), ''), '—');
  select au.id into v_uid from public.app_users au
    where btrim(au.biker_employee_id) = btrim(new.biker_employee_id) and au.active limit 1;
  if v_uid is null then return new; end if;
  perform public.push_notification('user', v_uid, 'handover', 'warn',
    'تسجيل استلام الدراجة يحتاج تصحيح · বাইক গ্রহণ রেকর্ড সংশোধন দরকার',
    'تسجيل استلام الدراجة يحتاج تصحيح: ' || v_reason || E'\n' || 'বাইক গ্রহণ রেকর্ড সংশোধন দরকার: ' || v_reason,
    'handover', new.id::text, 'hfix-' || new.id || '-' || md5(v_reason));
  return new;
end $$;
revoke all on function public.bike_handover_fix_notify() from public, anon, authenticated;

drop trigger if exists bike_handover_fix_notify on public.bike_handovers;
create trigger bike_handover_fix_notify after update of status, checklist on public.bike_handovers
  for each row execute function public.bike_handover_fix_notify();

-- إغلاق push_notification أمام الاستدعاء المباشر (كان أي مستخدم مسجّل يستطيع إرسال إشعار لأي أحد عبر RPC).
-- لا يستدعيها شيء في الواجهة (src)؛ كل من يستدعيها دوال security definer يملكها postgres، فلا تتأثر.
revoke execute on function public.push_notification(text, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;

-- ═══ تحقّق (قراءة فقط) ═══
-- select tgname, tgenabled from pg_trigger where tgname = 'bike_handover_fix_notify';   -- المتوقع: صف واحد، tgenabled = O
-- select has_function_privilege('anon', 'public.push_notification(text, uuid, text, text, text, text, text, text, text)', 'execute');           -- المتوقع false
-- select has_function_privilege('authenticated', 'public.push_notification(text, uuid, text, text, text, text, text, text, text)', 'execute');  -- المتوقع false
-- بعد أول «يحتاج تصحيح»: select title, body, audience, user_id is not null from notifications where dedupe_key like 'hfix-%' order by created_at desc limit 3;

-- ═══ تراجع ═══
-- drop trigger if exists bike_handover_fix_notify on public.bike_handovers;
-- drop function if exists public.bike_handover_fix_notify();
-- grant execute on function public.push_notification(text, uuid, text, text, text, text, text, text, text) to public, anon, authenticated;
