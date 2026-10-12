-- ═══ دورة حياة فاتورة سويتر: تاريخ الرفع على البوابة، والقبول، والبقشيش كحقل، وموعد التحويل، وتنبيه التأخر ═══
-- المشروع: cnmggdrlkgsyrjxmvydv
-- الحالة: **طُبِّق 2026-10-12** بأمر المالك — القسمان 1 و2 عبر apply_migration (invoice_lifecycle_columns_and_notify)،
--          ثم القسم 3 في معاملة واحدة محروسة بعدد الصفوف (8 + 2 + 1 بالضبط وإلا رجوع). التحقق بالقراءة بعده: 4 أعمدة،
--          cron settlement-due نشطة (20 5 * * *)، الدالة security definer وغير متاحة لـ authenticated/anon، وسبتمبر accepted
--          ببقشيش 293 وموعد 2026-10-25. الترتيب: الـSQL أولاً (تمّ) ثم دمج PR الواجهة.
--
-- الوضع قبل التطبيق (مقروء 2026-10-12): sweater_settlements بلا قيد على status؛ القيم المستعملة: confirmed (9 أشهر، 8 منها paid=true)،
--   paid (يوليو)، وsubmitted كانت لسبتمبر قبل 11/10. الواجهة تفسّر confirmed = «معتمدة داخلياً» و submitted = «مُرسلة للبوابة»، لكن
--   القاعدة استُعمل فيها confirmed أيضاً بمعنى «قبِلتها سويتر» (أغسطس confirmed_at = 21/09 يوم القبول، وسبتمبر 11/10). هذا الملف يفصل
--   المعنيين: confirmed_at يبقى الاعتماد الداخلي، و accepted_at + status='accepted' للقبول على بوابة الموردين.
-- لا جدول جديد: 4 أعمدة ودالة تنبيه واحدة.

-- ═══ 1) الأعمدة ═══
alter table public.sweater_settlements add column if not exists submitted_at timestamptz;   -- رُفعت على بوابة الموردين
alter table public.sweater_settlements add column if not exists accepted_at  timestamptz;   -- قبِلتها سويتر على البوابة
alter table public.sweater_settlements add column if not exists tip_amount   numeric not null default 0;  -- البقشيش الذي تضيفه سويتر عند القبول
alter table public.sweater_settlements add column if not exists due_date     date;          -- موعد التحويل المتوقع (افتراضياً القبول + 14 يوماً في الواجهة)
comment on column public.sweater_settlements.tip_amount is 'بقشيش سويتر الصافي المضاف عند قبول الفاتورة؛ المستحق = net_total + tip_amount';

-- ═══ 2) تنبيه التأخر (للمالك، فئة «التسوية»، يفتح صفحة التسوية) ═══
-- يومياً: فاتورة مقبولة غير مدفوعة تجاوزت موعدها ⇒ تنبيه حرج (مرة كل 3 أيام لكل فاتورة)؛
--         فاتورة مُرسلة بلا قبول منذ 7 أيام ⇒ تحذير (مرة كل 7 أيام)؛
--         تسوية معتمدة داخلياً لم تُرفع حتى اليوم 7 من الشهر التالي ⇒ تذكير (مرة).
create or replace function public.settlements_due_notify()
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0; v_today date := (now() at time zone 'Asia/Riyadh')::date; v_due date; v_days int;
begin
  for r in select * from public.sweater_settlements where coalesce(paid, false) = false and status in ('confirmed', 'submitted', 'accepted') loop
    if r.status = 'accepted' then
      v_due := coalesce(r.due_date, (coalesce(r.accepted_at, now()) at time zone 'Asia/Riyadh')::date + 14);
      v_days := v_today - v_due;
      if v_days > 0 then
        perform public.push_notification('owner', null, 'settlement', 'crit',
          'دفعة سويتر متأخرة — ' || r.period,
          'المستحق ' || to_char(coalesce(r.net_total, 0) + coalesce(r.tip_amount, 0), 'FM999,999,990.00') || ' ﷼ · الموعد ' || v_due || ' · متأخرة ' || v_days || ' يوماً',
          'settlement', r.id::text, 'settle-due-' || r.id || '-' || (v_days / 3));
        v_n := v_n + 1;
      end if;
    elsif r.status = 'submitted' then
      v_days := v_today - (coalesce(r.submitted_at, r.created_at) at time zone 'Asia/Riyadh')::date;
      if v_days >= 7 then
        perform public.push_notification('owner', null, 'settlement', 'warn',
          'فاتورة ' || r.period || ' على البوابة بلا قبول منذ ' || v_days || ' يوماً',
          'تابع سويتر لقبول الفاتورة ' || coalesce(r.invoice_ref, '') || ' (الصافي ' || to_char(coalesce(r.net_total, 0), 'FM999,999,990.00') || ' ﷼)',
          'settlement', r.id::text, 'settle-wait-' || r.id || '-' || (v_days / 7));
        v_n := v_n + 1;
      end if;
    elsif r.status = 'confirmed' and r.period ~ '^\d{4}-\d{2}$' and v_today >= (to_date(r.period, 'YYYY-MM') + interval '1 month 6 days')::date then
      perform public.push_notification('owner', null, 'settlement', 'warn',
        'تسوية ' || r.period || ' معتمدة ولم تُرفع على بوابة الموردين',
        'ارفع الفاتورة على البوابة ثم سجّل «رُفعت» في صفحة التسوية',
        'settlement', r.id::text, 'settle-unsent-' || r.id);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.settlements_due_notify() from public, anon, authenticated;
-- يومياً 05:20 بتوقيت الخادم (UTC) = 08:20 الرياض؛ آمن لإعادة التشغيل (unschedule ثم schedule)
select cron.unschedule(jobid) from cron.job where jobname = 'settlement-due';
select cron.schedule('settlement-due', '20 5 * * *', 'select public.settlements_due_notify()');

-- ═══ 3) تعبئة الأشهر السابقة (بيانات — تُعرض على المالك وتُنفَّذ بموافقته، مستقلة عن القسمين أعلاه) ═══
-- begin;
-- -- البقشيش الفعلي للأشهر المدفوعة = المستلَم − الصافي (يطابق الملاحظات: يناير 29.25، فبراير 55.58، مارس 58.50، أبريل 38.03، مايو 63، يونيو 122، يوليو 82، أغسطس 200)
-- update public.sweater_settlements set tip_amount = round(paid_amount - net_total, 2)
--   where paid = true and paid_amount is not null and net_total is not null and tip_amount = 0;                     -- 8 صفوف
-- -- يوليو وأغسطس: رُفعتا على البوابة 19/09 وقُبلتا 21/09 (من الملاحظات)
-- update public.sweater_settlements set submitted_at = '2026-09-19 09:00+03', accepted_at = '2026-09-21 09:00+03'
--   where period in ('2026-07', '2026-08') and submitted_at is null;                                                 -- 2
-- -- سبتمبر: قبِلتها سويتر 11/10 (confirmed_at الحالي هو يوم القبول) وبقشيش 293 ⇒ الحالة accepted، والموعد = القبول + 14
-- update public.sweater_settlements set status = 'accepted', accepted_at = confirmed_at, tip_amount = 293,
--   due_date = (confirmed_at at time zone 'Asia/Riyadh')::date + 14
--   where period = '2026-09' and status = 'confirmed' and paid = false;                                             -- 1
-- commit;

-- ═══ تحقق ═══
-- select column_name from information_schema.columns where table_name = 'sweater_settlements' and column_name in ('submitted_at','accepted_at','tip_amount','due_date');  -- 4
-- select jobname, schedule from cron.job where jobname = 'settlement-due';   -- 20 5 * * *
-- select has_function_privilege('authenticated', 'public.settlements_due_notify()', 'execute');  -- f
-- select period, status, tip_amount, net_total + tip_amount as due_total, submitted_at::date, accepted_at::date, due_date, paid from sweater_settlements order by period;

-- ═══ تراجع ═══
-- select cron.unschedule(jobid) from cron.job where jobname = 'settlement-due';
-- drop function if exists public.settlements_due_notify();
-- alter table public.sweater_settlements drop column if exists submitted_at, drop column if exists accepted_at, drop column if exists tip_amount, drop column if exists due_date;
-- (القسم 3: update sweater_settlements set status = 'confirmed' where period = '2026-09' and status = 'accepted';)
