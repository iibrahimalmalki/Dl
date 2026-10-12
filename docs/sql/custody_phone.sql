-- ═══ «الجوال» في عُهد البايكر (المرحلة 2، الخطوة 1: القاعدة) ═══
-- المشروع: cnmggdrlkgsyrjxmvydv · التصميم: docs/design/custody_phone.md (#72)
-- الحالة: **لم يُطبَّق**.
--
-- قرارات المالك 2026-10-12 (موافقة على المذكرة):
--   1) الصنف: phone · فئة «أجهزة» · item_type = device · 24 شهراً · مهلة 45 يوماً · replace (في الكتالوج بالواجهة، لا في القاعدة).
--   2) custody_assets: عمودا serial_no (IMEI للجوال) وspecs (الماركة والموديل، الخط، الملحقات) + فهرس فريد للـIMEI النشط.
--   3) الملحقات (الشاحن، الحامل، الكفر) حقول داخل الجوال لا أصناف مستقلة.
--   4) البايكر المسجَّل سابقاً: الإدارة تسجّل الجوال من «العُهد والإهلاك»، ثم يؤكّده البايكر بـ«تحديث الحالة».
--
-- الترتيب: هذا الملف (القسمان 1 و2) يُطبَّق أولاً بأمر المالك ⇒ تحقق بالقراءة ⇒ PR الواجهة.
--
-- وقائع مقروءة من الإنتاج 2026-10-12 قبل الكتابة:
--   • custody_assets: 40 قطعة، كلها active، لا جوال، لا عمود serial/imei، ولا قيود check. لـ anon كل صلاحيات الجدول
--     (السياسات تمنعه فعلياً) ⇒ تُسحب هنا (revoke) لأن الجدول يُعدَّل في هذا الملف — كما في fleet_requests.sql مع fuel_logs.
--   • custody_review في الإنتاج = نص docs/sql/custody_lifecycle.sql حرفياً (بلا سطرَي تعليق داخليين، ونهايات أسطر CRLF).
--     التعديل هنا على ذلك النص فقط: إدخال serial_no/specs لقطعة device جديدة + رسالتا IMEI_INVALID وIMEI_DUPLICATE. بقية السلوك كما هو.
--   • القسمان 1 و2 بلا كلمة الحذف إطلاقاً (أداة MCP تتعطل عليها)؛ التراجع آخر الملف يشغّله المالك من SQL Editor.
--   • item_type = device مقصور اليوم على الجوال: القيد والفهرس يشترطان IMEI صالحاً لكل device. أي جهاز آخر بلا IMEI لاحقاً ⇒ يُعدَّل الشرط.

-- ═══ 1) الأعمدة والفحص والفهرس ═══

-- 1.1 فحص IMEI: 15 رقماً + مجموع Luhn (يطابق imeiError في src/custodyDeclare.js)
create or replace function public._imei_ok(p text) returns boolean
language sql immutable set search_path to 'public' as $$
  select case when p ~ '^[0-9]{15}$' then
    (select sum(case when i % 2 = 0 then (substr(p, i, 1)::int * 2) - case when substr(p, i, 1)::int * 2 > 9 then 9 else 0 end
                     else substr(p, i, 1)::int end) from generate_series(1, 15) i) % 10 = 0
  else false end
$$;

-- 1.2 الأعمدة
alter table public.custody_assets add column if not exists serial_no text;
alter table public.custody_assets add column if not exists specs jsonb not null default '{}'::jsonb;

-- 1.3 الجهاز (device) لا يُحفظ بلا IMEI صالح — من الإقرار أو من صفحة الإدارة
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'custody_assets_device_imei_ck') then
    alter table public.custody_assets add constraint custody_assets_device_imei_ck
      check (item_type is distinct from 'device' or public._imei_ok(serial_no));
  end if;
end $c$;

-- 1.4 IMEI واحد لجهاز نشط واحد (المستبدَل أو المُعاد يحرّر رقمه)
create unique index if not exists custody_assets_active_device_serial on public.custody_assets (btrim(serial_no))
  where item_type = 'device' and status not in ('replaced', 'returned');

-- 1.5 anon بلا أي صلاحية على الجدول (كانت مفتوحة على مستوى الجدول؛ السياسات تمنعه، والسحب يغلقها)
revoke all on public.custody_assets from anon;

-- ═══ 2) custody_review: نسخ IMEI والمواصفات عند اعتماد الجوال ═══
create or replace function public.custody_review(p_id uuid, p_approve boolean, p_reason text default null,
  p_start date default null, p_lines jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  r public.biker_assets; v_emp public.employees; v_uid uuid; v_start date; l jsonb; it jsonb; v_aid uuid;
  v_items jsonb; v_req_items jsonb := '[]'::jsonb; v_req_assets uuid[] := '{}'; v_req uuid; v_ref text;
  v_new int := 0; v_linked int := 0; a public.custody_assets; v_cond text; v_note text; v_photo text; v_qty numeric; k text;
  v_phone jsonb; v_imei text;
begin
  if not public.custody_can_review() then raise exception 'غير مصرّح بالاعتماد' using errcode = '42501'; end if;
  select * into r from public.biker_assets where id = p_id for update;
  if not found then raise exception 'الإقرار غير موجود'; end if;
  if r.status is distinct from 'declared' then raise exception 'سبقت مراجعة هذا الإقرار (%)', r.status; end if;
  select au.id into v_uid from public.app_users au where btrim(au.biker_employee_id) = btrim(r.biker_employee_id) and au.active limit 1;

  if not p_approve then
    if coalesce(btrim(p_reason), '') = '' then raise exception 'سبب الرفض مطلوب'; end if;
    update public.biker_assets set status = 'rejected', reject_reason = btrim(p_reason), reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
    if v_uid is not null then
      perform public.push_notification('user', v_uid, 'supply', 'warn',
        'العهدة: رُفض ' || case r.kind when 'update' then 'تحديث الحالة' else 'التسجيل' end || ' · প্রত্যাখ্যাত',
        'السبب: ' || btrim(p_reason) || E'\n' || 'কারণ: ' || btrim(p_reason), 'custody', p_id::text, 'asset-rev-' || p_id);
    end if;
    return jsonb_build_object('status', 'rejected');
  end if;

  select * into v_emp from public.employees e where btrim(e.employee_id) = btrim(r.biker_employee_id) limit 1;
  if not found then raise exception 'لا موظف برقم البايكر % — اربط الموظف أولاً', r.biker_employee_id; end if;
  v_items := coalesce(r.items, '[]'::jsonb);

  if r.kind = 'baseline' then
    v_start := coalesce(p_start, (r.created_at at time zone 'Asia/Riyadh')::date);
    -- كل صنف في الإقرار يجب أن يقع في سطر
    for it in select x from jsonb_array_elements(v_items) x loop
      if not exists (select 1 from jsonb_array_elements(p_lines) ln where (ln -> 'item_keys') ? (it ->> 'key')) then
        raise exception 'الصنف % بلا سطر كتالوج', it ->> 'key';
      end if;
    end loop;
    for l in select x from jsonb_array_elements(p_lines) x loop
      if nullif(l ->> 'asset_id', '') is not null then
        select * into a from public.custody_assets where id = (l ->> 'asset_id')::uuid and employee_id = v_emp.id and status not in ('replaced', 'returned');
        if not found then raise exception 'القطعة % ليست قطعة نشطة لهذا البايكر', l ->> 'asset_id'; end if;
        v_aid := a.id; v_linked := v_linked + 1;
      else
        -- الجوال (item_type = device): IMEI صالح إلزامي من الإقرار، والماركة/الخط/الملحقات إلى specs
        v_phone := null; v_imei := null;
        if l ->> 'item_type' = 'device' then
          select x -> 'phone' into v_phone from jsonb_array_elements(v_items) x
            where (l -> 'item_keys') ? (x ->> 'key') and jsonb_typeof(x -> 'phone') = 'object' limit 1;
          v_imei := btrim(v_phone ->> 'imei');
          if not public._imei_ok(v_imei) then raise exception 'IMEI_INVALID: IMEI الجوال ناقص أو غير صحيح (15 رقماً)'; end if;
        end if;
        begin
          insert into public.custody_assets (operator_id, employee_id, biker_name, sweater_id, item_type, category, name, name_en,
              start_date, life_months, lead_days, end_date, status, source, notes, created_by, serial_no, specs)
            values (r.operator_id, v_emp.id, v_emp.full_name, btrim(r.biker_employee_id), l ->> 'item_type', l ->> 'category', l ->> 'name', l ->> 'name_en',
              v_start, (l ->> 'life_months')::numeric, (l ->> 'lead_days')::int,
              (v_start + make_interval(months => round((l ->> 'life_months')::numeric)::int))::date,
              'active', 'declaration', 'من إقرار العهدة ' || r.id, auth.uid(), v_imei, coalesce(v_phone - 'imei', '{}'::jsonb))
            returning * into a;
        exception when unique_violation then
          raise exception 'IMEI_DUPLICATE: هذا الـIMEI (%) مسجّل لجهاز نشط آخر', v_imei;
        end;
        v_aid := a.id; v_new := v_new + 1;
      end if;
      -- ربط أصناف السطر بالقطعة
      select jsonb_agg(case when (l -> 'item_keys') ? (x ->> 'key') then x || jsonb_build_object('asset_id', v_aid) else x end order by o)
        into v_items from jsonb_array_elements(v_items) with ordinality t(x, o);
      -- أسوأ حالة في السطر سيئة/تالفة ⇒ مرشّح للاستبدال
      select x ->> 'condition', x ->> 'note', x ->> 'photo', coalesce((x ->> 'qty')::numeric, 1) into v_cond, v_note, v_photo, v_qty
        from jsonb_array_elements(v_items) x where (l -> 'item_keys') ? (x ->> 'key')
        order by case x ->> 'condition' when 'damaged' then 3 when 'poor' then 2 when 'fair' then 1 else 0 end desc limit 1;
      if v_cond in ('poor', 'damaged') then
        if a.reorder_request_id is null or not exists (select 1 from public.supply_requests s where s.id = a.reorder_request_id and s.status in ('open', 'escalated')) then
          v_req_assets := v_req_assets || a.id;
          v_req_items := v_req_items || jsonb_build_array(jsonb_build_object('n', null, 'key', l ->> 'catalog_key', 'asset_id', a.id,
            'ar', a.name, 'en', coalesce(a.name_en, ''), 'type', 'عهدة', 'category', 'عدّة البايكر', 'category_en', 'Biker kit', 'qty', v_qty,
            'status', 'replace', 'status_ar', case v_cond when 'damaged' then 'تالف — استبدال' else 'سيئ — استبدال' end,
            'status_en', case v_cond when 'damaged' then 'Damaged — replace' else 'Poor — replace' end,
            'note', coalesce(v_note, ''), 'photo', v_photo, 'parts_ar', '', 'parts_en', ''));
        end if;
      end if;
    end loop;
  else
    select * into a from public.custody_assets where id = r.asset_id and employee_id = v_emp.id;
    if not found then raise exception 'القطعة ليست لهذا البايكر'; end if;
    it := v_items -> 0;
    if (it ->> 'condition') in ('poor', 'damaged') and a.status not in ('replaced', 'returned')
       and (a.reorder_request_id is null or not exists (select 1 from public.supply_requests s where s.id = a.reorder_request_id and s.status in ('open', 'escalated'))) then
      v_req_assets := v_req_assets || a.id;
      v_req_items := jsonb_build_array(jsonb_build_object('n', null, 'key', it ->> 'key', 'asset_id', a.id,
        'ar', a.name, 'en', coalesce(a.name_en, ''), 'type', 'عهدة', 'category', 'عدّة البايكر', 'category_en', 'Biker kit',
        'qty', coalesce((it ->> 'qty')::numeric, 1), 'status', 'replace',
        'status_ar', case it ->> 'condition' when 'damaged' then 'تالف — استبدال' else 'سيئ — استبدال' end,
        'status_en', case it ->> 'condition' when 'damaged' then 'Damaged — replace' else 'Poor — replace' end,
        'note', coalesce(it ->> 'note', ''), 'photo', it ->> 'photo', 'parts_ar', '', 'parts_en', ''));
    end if;
  end if;

  if jsonb_array_length(v_req_items) > 0 then
    v_ref := 'DW-' || btrim(r.biker_employee_id) || '-' || to_char(now() at time zone 'Asia/Riyadh', 'YYYYMMDD') || '-A' || (1000 + floor(random() * 9000))::int;
    insert into public.supply_requests (operator_id, ref, biker_name, sweater_id, requesting_dept, items, notes, created_by)
      values (r.operator_id, v_ref, v_emp.full_name, btrim(r.biker_employee_id), 'التشغيل — دلو ورغوة', v_req_items,
              'طلب استبدال من إقرار عهدة معتمد (' || r.id || ')', auth.uid())
      returning id into v_req;
    update public.custody_assets set status = 'due', reorder_request_id = v_req where id = any(v_req_assets);
  end if;

  update public.biker_assets set status = 'approved', items = v_items, reviewed_by = auth.uid(), reviewed_at = now(),
    approved_start = case when r.kind = 'baseline' then v_start end, request_id = v_req where id = p_id;
  if v_uid is not null then
    perform public.push_notification('user', v_uid, 'supply', 'info',
      'العهدة: اعتُمد ' || case r.kind when 'update' then 'تحديث الحالة' else 'التسجيل' end || ' ✓ · অনুমোদিত',
      case when v_req is not null then 'رُفع طلب استبدال ' || v_ref || E'\n' || 'বদলের অনুরোধ পাঠানো হয়েছে ' || v_ref
           else 'تم الاعتماد.' || E'\n' || 'অনুমোদিত হয়েছে।' end,
      'custody', p_id::text, 'asset-rev-' || p_id);
  end if;
  return jsonb_build_object('status', 'approved', 'request_id', v_req, 'ref', v_ref, 'created', v_new, 'linked', v_linked);
end $$;
revoke all on function public.custody_review(uuid, boolean, text, date, jsonb) from public, anon;
grant execute on function public.custody_review(uuid, boolean, text, date, jsonb) to authenticated;
revoke all on function public._imei_ok(text) from public, anon;
grant execute on function public._imei_ok(text) to authenticated;

-- ═══ تحقق بالقراءة بعد التطبيق ═══
-- select column_name, data_type, is_nullable, column_default from information_schema.columns
--   where table_schema='public' and table_name='custody_assets' and column_name in ('serial_no','specs');  -- text/YES، jsonb/NO/'{}'
-- select conname from pg_constraint where conname='custody_assets_device_imei_ck';  -- 1
-- select indexdef from pg_indexes where indexname='custody_assets_active_device_serial';  -- unique … where item_type='device' …
-- select public._imei_ok('490154203237518'), public._imei_ok('490154203237519'), public._imei_ok('12345');  -- t, f, f
-- select count(*), count(*) filter (where serial_no is not null), count(*) filter (where specs <> '{}') from custody_assets;  -- 40، 0، 0
-- select has_table_privilege('anon','public.custody_assets','select'), has_table_privilege('authenticated','public.custody_assets','select');  -- f, t
-- select prosecdef from pg_proc where proname='custody_review';  -- t
-- select position('IMEI_DUPLICATE' in prosrc) > 0 from pg_proc where proname='custody_review';  -- t

-- ═══ تراجع (من SQL Editor) ═══
-- 1) إعادة custody_review بنصّها في docs/sql/custody_lifecycle.sql (القسم 5) — قبل حذف الأعمدة لأنها تشير إليها.
-- 2) drop index if exists public.custody_assets_active_device_serial;
--    alter table public.custody_assets drop constraint if exists custody_assets_device_imei_ck;
--    alter table public.custody_assets drop column if exists specs, drop column if exists serial_no;   -- بعد التأكد ألا جوال مسجّل
--    drop function if exists public._imei_ok(text);
-- 3) (سحب anon لا يُتراجع عنه: لم يكن له استعمال، والسياسات كانت تمنعه أصلاً)
