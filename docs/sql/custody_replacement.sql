-- إقرار العهدة في بوابة البايكر: طلب استبدال تلقائي للأصناف السيئة/التالفة + إشعار للمالك.
-- الحالة: **أُلغي — حلّ محله custody_lifecycle.sql** (2026-10-10): المشغّل biker_assets_replace ودالته حُذفا هناك؛ طلب الاستبدال
-- صار يُنشأ عند الاعتماد (custody_review) لا عند الإدراج. **لا تُعد تشغيله** — يعيد إنشاء طلبات قبل الاعتماد. محفوظ للتاريخ فقط.
--
-- لماذا SQL: البايكر يُدخل في biker_assets (سياسة biker_assets_ins)، لكن supply_requests لا يكتب فيها إلا من يملك
-- «الإمداد» أو «الجولات الميدانية» (سياسة sr_wr)، ولا مشغّل إشعار على supply_requests، و push_notification مقفلة أمام المستخدمين.
-- الحل: مشغّل BEFORE INSERT (security definer) على biker_assets:
--   1) يجمع الأصناف بحالة poor (سيئة) أو damaged (تالفة) في طلب واحد في supply_requests (نظام «طلبات الإمداد» الحالي)،
--      بنفس شكل بنود الطلب في Custody.jsx/FieldRounds.jsx، مع الكمية والملاحظة والصورة واسم البايكر.
--   2) يكتب في كل صنف منها replace_request_id و replace_ref ⇒ صفحة «العُهد» تعرض شارة ورابطاً للطلب.
--   3) يرسل إشعاراً للمالك (فئة «الإمداد»، يفتح «طلبات الإمداد»).
-- لا شيء يُنشأ إن لم يكن في الإقرار صنف سيئ/تالف. لا يعمل إلا عند الإدراج (تعديل المالك لاحقاً لا يُنشئ طلباً).
-- بلا هذا الملف: الإقرار يُحفظ كاملاً (صور + حالات + ملاحظات)، لكن لا طلب استبدال ولا إشعار.

create or replace function public.biker_assets_replace()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_req jsonb := '[]'::jsonb; v_names text[] := '{}'; v_ref text; v_id uuid; e jsonb; v_sid text;
begin
  if jsonb_typeof(new.items) is distinct from 'array' then return new; end if;
  for e in select x from jsonb_array_elements(new.items) x loop
    if e ->> 'condition' in ('poor', 'damaged') then
      v_req := v_req || jsonb_build_array(jsonb_build_object(
        'n', null, 'key', e ->> 'key', 'ar', e ->> 'name_ar', 'en', coalesce(e ->> 'name_bn', ''),
        'type', 'عهدة', 'category', 'عدّة البايكر', 'category_en', 'Biker kit',
        'qty', coalesce((e ->> 'qty')::numeric, 1),
        'status', 'replace',
        'status_ar', case e ->> 'condition' when 'damaged' then 'تالف — استبدال' else 'سيئ — استبدال' end,
        'status_en', case e ->> 'condition' when 'damaged' then 'Damaged — replace' else 'Poor — replace' end,
        'note', coalesce(e ->> 'note', ''), 'photo', e ->> 'photo', 'parts_ar', '', 'parts_en', ''));
      v_names := v_names || coalesce(e ->> 'name_ar', e ->> 'key');
    end if;
  end loop;
  if jsonb_array_length(v_req) = 0 then return new; end if;

  v_sid := coalesce(nullif(btrim(new.biker_employee_id), ''), 'x');
  v_ref := 'DW-' || v_sid || '-' || to_char(now() at time zone 'Asia/Riyadh', 'YYYYMMDD') || '-A' || (1000 + floor(random() * 9000))::int;
  insert into public.supply_requests (operator_id, ref, biker_name, sweater_id, requesting_dept, items, notes, created_by)
    values (new.operator_id, v_ref, new.biker_name, new.biker_employee_id, 'التشغيل — دلو ورغوة', v_req,
            'طلب استبدال تلقائي من إقرار العهدة (' || new.id || ')', new.created_by)
    returning id into v_id;

  select jsonb_agg(case when x ->> 'condition' in ('poor', 'damaged')
                        then x || jsonb_build_object('replace_request_id', v_id, 'replace_ref', v_ref) else x end order by o)
    into new.items from jsonb_array_elements(new.items) with ordinality t(x, o);

  perform public.push_notification('owner', null, 'supply', 'warn',
    'طلب استبدال عهدة — ' || coalesce(new.biker_name, v_sid),
    coalesce(new.biker_name, v_sid) || ' (' || v_sid || '): ' || array_to_string(v_names, '، ') || ' · المرجع ' || v_ref,
    'supply_requests', v_id::text, 'asset-repl-' || new.id);
  return new;
end $$;
revoke all on function public.biker_assets_replace() from public, anon, authenticated;

drop trigger if exists biker_assets_replace on public.biker_assets;
create trigger biker_assets_replace before insert on public.biker_assets
  for each row execute function public.biker_assets_replace();

-- ═══ تحقّق (قراءة فقط) ═══
-- select tgname, tgenabled from pg_trigger where tgname = 'biker_assets_replace';          -- المتوقع: صف واحد، O
-- select prosecdef from pg_proc where proname = 'biker_assets_replace';                     -- المتوقع: true
-- select has_function_privilege('authenticated', 'public.biker_assets_replace()', 'execute'); -- المتوقع: false
-- بعد أول إقرار فيه صنف تالف:
-- select ref, biker_name, jsonb_array_length(items), status from supply_requests where ref like 'DW-%-A%' order by created_at desc limit 3;
-- select title, audience from notifications where dedupe_key like 'asset-repl-%' order by created_at desc limit 3;

-- ═══ تراجع ═══
-- drop trigger if exists biker_assets_replace on public.biker_assets;
-- drop function if exists public.biker_assets_replace();
