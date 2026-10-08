-- طلبات الإمداد: تذكير المتابِع ثم تصعيد للمصعِّد حسب مهلة الطلب (sla_hours، افتراضياً 24 ساعة)
-- الحالة: طُبِّق على الإنتاج بموافقة المالك في 2026-10-08 (apply_migration: supply_sla_notify) — لا تُعد تشغيله.
--
-- قرار المالك (2026-10-08): المتابعة دور سلمان، والتصعيد دور عمر. يُترجم إلى الصلاحيات الحالية بلا أسماء ثابتة:
--   المتابِع  = من لديه تعديل «الجولات الميدانية» وليس لديه تعديل «سلاسل الإمداد» (سلمان اليوم).
--   المصعِّد = من لديه تعديل «سلاسل الإمداد» (عمر اليوم) + المالك.
-- الطلب المفتوح (status = 'open') فقط؛ «مُصعّد» و«مكتمل» و«ملغى» لا يُذكَّر بها.
--   قبل انتهاء المهلة بـ 4 ساعات ⇒ تذكير للمتابِع (تحذير).
--   بعد انتهاء المهلة ⇒ تصعيد للمصعِّد والمالك (حرِج)، ولا يُرسل تذكير المتابِع بعدها.
-- كل إشعار مرة واحدة لكل طلب ولكل شخص (dedupe_key). يعمل كل 30 دقيقة عبر pg_cron.

create or replace function public.supply_requests_sla_notify()
returns int language plpgsql security definer set search_path to 'public' as $$
declare r record; u record; v_age numeric; v_n int := 0; v_title text; v_body text;
begin
  for r in select * from public.supply_requests where status = 'open' loop
    v_age := extract(epoch from (now() - r.created_at)) / 3600.0;
    v_body := coalesce(r.ref, '—') || ' · ' || coalesce(r.biker_name, '—') || ' · منذ ' || floor(v_age)::int || ' ساعة';
    if v_age >= r.sla_hours then
      v_title := 'تصعيد: طلب إمداد تجاوز مهلة ' || r.sla_hours || ' ساعة';
      for u in select distinct au.id from public.app_users au join public.user_permissions up on up.user_id = au.id
               where au.active and up.module = 'supply' and up.can_edit loop
        perform public.push_notification('user', u.id, 'supply', 'crit', v_title, v_body, 'supply_requests', r.id::text, 'sr-esc-' || r.id || '-' || u.id);
        v_n := v_n + 1;
      end loop;
      perform public.push_notification('owner', null, 'supply', 'crit', v_title, v_body, 'supply_requests', r.id::text, 'sr-esc-' || r.id || '-owner');
    elsif v_age >= r.sla_hours - 4 then
      v_title := 'تذكير: طلب إمداد يقترب من مهلة ' || r.sla_hours || ' ساعة';
      for u in select distinct au.id from public.app_users au join public.user_permissions up on up.user_id = au.id
               where au.active and up.module = 'field_rounds' and up.can_edit
                 and not exists (select 1 from public.user_permissions s where s.user_id = au.id and s.module = 'supply' and s.can_edit) loop
        perform public.push_notification('user', u.id, 'supply', 'warn', v_title, v_body, 'supply_requests', r.id::text, 'sr-rem-' || r.id || '-' || u.id);
        v_n := v_n + 1;
      end loop;
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.supply_requests_sla_notify() from public, anon, authenticated;

select cron.schedule('supply-sla', '15,45 * * * *', 'select public.supply_requests_sla_notify()');
