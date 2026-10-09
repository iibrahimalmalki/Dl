-- تصحيح وصف «متأخر» في إشعار الاستلام اليومي (daily_notify_delivery) ليطابق النوافذ المعتمدة في src/daily/engine.js:
-- مسائي 21:00–00:00 وصباحي 07:00–08:30 (بتوقيت الرياض) = في الموعد؛ 00:00–07:00 = «ليلي — خارج النافذة»؛ 08:31–20:59 = «متأخر — خلال الدوام».
-- كان: 23:00–08:00 = متأخر (يعكس النوافذ القديمة).
-- الحالة: **طُبِّق** 2026-10-09 بموافقة المالك (تحقّق: المنطق الجديد في الدالة، والمشغّل مفعّل). آمن لإعادة التشغيل.
create or replace function public.daily_notify_delivery()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_who text; v_cour text; v_m int; v_tag text;
begin
  select full_name into v_who from public.employees where id = new.received_by;
  select name || ' · ' || phone into v_cour from public.sweater_couriers where id = new.courier_id;
  v_m := extract(hour from new.received_at at time zone 'Asia/Riyadh') * 60 + extract(minute from new.received_at at time zone 'Asia/Riyadh');
  v_tag := case when v_m >= 21 * 60 or (v_m >= 7 * 60 and v_m <= 8 * 60 + 30) then null
                when v_m < 7 * 60 then 'ليلي — خارج النافذة'
                else 'متأخر — خلال الدوام' end;
  insert into public.notifications (icon, title, body, type, audience, category, severity, module, entity_id, dedupe_key)
  values ('📦', 'استلام يومي جديد من مندوب سويتر',
    coalesce(v_who, '—') || ' استلم الساعة ' || to_char(new.received_at at time zone 'Asia/Riyadh', 'HH24:MI') || ' من ' || coalesce(v_cour, '—')
      || coalesce(' · ' || v_tag, ''),
    'daily', 'owner', 'supply', case when v_tag is null then 'info' else 'warn' end, 'daily', new.id::text, 'daily-del-' || new.id)
  on conflict (dedupe_key) do nothing;
  return new;
end $function$;
