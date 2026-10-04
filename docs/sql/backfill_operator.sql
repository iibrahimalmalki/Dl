-- تعبئة operator_id الفارغ بمشغّل «دلو ورغوة» — مقترح، لا يُطبَّق قبل موافقة المالك.
-- السبب: صفحات تفلتر بـ .eq("operator_id", opId) فتُخفي السجلات التي operator_id فيها null
-- (العُهد والإهلاك تعرض صفراً مع أن custody_assets فيه 40 سجلاً).
-- المشغّل الوحيد في الجدول operators: b57f396c-2d39-4fa4-a568-143585f3db14 (دلو ورغوة).
-- الأعداد مقروءة من الإنتاج بتاريخ 2026-10-04 (فارغ / الإجمالي).
-- آمن للتكرار: يحدّث الفارغ فقط. لا تعارض مع القيود الفريدة:
--   ops_biker_month UNIQUE(operator_id,period,sweater_id): الفارغ للأشهر 2026-01..05 والمعبّأ 2026-06..09 ⇒ لا تكرار (فُحص: 0).
--   payroll_runs / ops_tickets: لا سجلات فارغة.

begin;

do $$
declare
  op constant uuid := 'b57f396c-2d39-4fa4-a568-143585f3db14';
  t text; n int;
begin
  if not exists (select 1 from public.operators where id = op) then
    raise exception 'المشغّل % غير موجود', op;
  end if;
  foreach t in array array[
    'custody_assets',      -- 40/40  العُهد والإهلاك (مخفية حالياً)
    'sc_custody',          -- 24/24  عُهد التوريد
    'vendor_expenses',     -- 39/39
    'renewal_docs',        -- 38/38
    'vendors',             -- 24/24
    'ops_biker_month',     -- 17/29  مخفية في التشغيل/الرواتب/الأداء/إقفال الشهر/المطابقة
    'sweater_settlements', -- 8/9
    'field_rounds',        -- 7/7    مخفية في الجولات الميدانية/الأداء/العُهد
    'fuel_logs',           -- 7/8
    'fleet_vehicles',      -- 6/6
    'fleet_incidents',     -- 4/4
    'housing_payments',    -- 4/4
    'bike_handovers',      -- 3/4
    'supply_requests',     -- 3/3    مخفية في طلبات التوريد
    'applicants',          -- 2/6
    'damage_claims',       -- 2/2
    'housing_units',       -- 1/1
    'offboarding',         -- 1/1
    'onboarding',          -- 1/1    مخفية في التهيئة
    'sc_stocktakes',       -- 1/1
    'teams'                -- 1/1
  ] loop
    execute format('update public.%I set operator_id = $1 where operator_id is null', t) using op;
    get diagnostics n = row_count;
    raise notice '%: % سجل', t, n;
  end loop;
end $$;

-- ── اختياري (يحتاج قراراً منفصلاً من المالك) ──────────────────────────────
-- بيانات على مستوى المؤسسة لا المشغّل؛ لا تفلترها أي صفحة بالمشغّل حالياً، فلا تُخفى:
--   update public.finance_monthly  set operator_id = 'b57f396c-2d39-4fa4-a568-143585f3db14' where operator_id is null; -- 111/111
--   update public.gosi_ledger      set operator_id = 'b57f396c-2d39-4fa4-a568-143585f3db14' where operator_id is null; -- 9/9
--   update public.gosi_installment set operator_id = 'b57f396c-2d39-4fa4-a568-143585f3db14' where operator_id is null; -- 1/1
-- حسابات الإدارة (المالك + الهام/سلمان/عمر): operator_id في app_users يدخل في دوال الصلاحيات (my_operator)،
-- فتعبئته قد تغيّر ما يرونه — لا تُعبَّأ ضمن هذا الملف:
--   app_users 4/8 · employees 3/7 (نفس الموظفين الثلاثة بلا رقم بايكر)

-- تحقّق بعد التطبيق: يجب أن تكون كل الأعداد صفراً للجداول أعلاه
select 'custody_assets' t, count(*) from public.custody_assets where operator_id is null
union all select 'sc_custody', count(*) from public.sc_custody where operator_id is null
union all select 'ops_biker_month', count(*) from public.ops_biker_month where operator_id is null
union all select 'field_rounds', count(*) from public.field_rounds where operator_id is null
union all select 'supply_requests', count(*) from public.supply_requests where operator_id is null
union all select 'onboarding', count(*) from public.onboarding where operator_id is null;

commit;
