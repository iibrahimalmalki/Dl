-- ═══════════════════════════════════════════════════════════════════════════
-- round_custody_check.sql — ربط الجولة الميدانية بسجل العهد (طلب المالك 2026-10-14)
-- الحالة: **لم يُطبَّق**
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   1) «جرد العهدة» في الجولة: لكل قطعة نشطة لبايكر الجولة: سليمة (ok) / تالفة (damaged) / مفقودة (lost) + ملاحظة.
--      الدالة round_custody_check(الجولة، الأسطر) تحفظ الأسطر على الجولة (field_rounds.custody_check) وتحدّث على كل قطعة:
--        last_check_at (تاريخ الجولة) · last_check_condition · last_check_round_id · last_check_note · last_check_photo · last_check_imei_ok
--      • الأصول المعمّرة (الدراجة، الجوال، صندوق الخدمة، الخوذة): صورة إلزامية (إلا «مفقودة»).
--      • الجوال: IMEI 1 المُدخل (*#06#) يُطابَق في القاعدة مع serial_no على أول 15 خانة (بعض الأجهزة تعرض 17) ⇒ last_check_imei_ok (✅/❌).
--        يُحفظ آخر 4 أرقام فقط على الجولة.
--        عند تعديل الجولة نفسها بلا IMEI جديد تبقى نتيجة المطابقة المحفوظة على القطعة (إن كان آخر جرد لها من هذه الجولة).
--      • الصورة من مخزن field-evidence فقط. تاريخ الجولة في المستقبل ⇒ مرفوض.
--      • التالفة/المفقودة أو IMEI غير مطابق ⇒ decision_status = 'pending' («بانتظار قرار المالك»). لا تحميل على البايكر،
--        ولا تتغيّر حالة القطعة (status) — القرار للمالك. «سليمة» لا تمسح علامة قائمة؛ المالك وحده يمسحها.
--        إعادة حفظ الجولة نفسها، أو جولة لاحقة تجد الحالة نفسها التي قرّر فيها المالك، لا تعيد «بانتظار القرار» ولا تمسح القرار.
--      • تعديل جولة أقدم لا يكتب فوق جرد أحدث (round_date < last_check_at ⇒ تُحفظ على الجولة فقط).
--        أسطر الجولة المحفوظة لقطع لم تُرسل في التعديل (استُبدلت بعدها مثلاً) تبقى على الجولة.
--      • round_id القائم (الجولة التي أنشأت القطعة) لا يتغيّر؛ رقم جولة آخر جرد في last_check_round_id.
--        last_check_round_id بلا مفتاح أجنبي: إزالة جولة لا تتعطّل بسببه، وأداة MCP تتعطّل على عبارة الحذف في تعريف المفتاح.
--   2) الحماية (مشغّل custody_check_guard): خانات الجرد والقرار لا تُكتب مباشرة إلا من المالك؛ غيره يكتبها عبر الدالتين فقط
--      (علامة معاملة app.custody_rpc). قرار المالك: decision_status = 'decided' + decision_note + decided_by/decided_at.
--   3) «ناقص» (status = 'missing'): صنف سُجّل ناقصاً في الجولة ⇒ يُنشأ بلا عدّاد (end_date فارغ، والبداية = تاريخ الجولة للتوثيق فقط).
--      قطعة جديدة نشطة لنفس البايكر وبالاسم نفسه (إضافة يدوية، أو اعتماد إقرار البايكر) ⇒ الناقصة تُغلق «مُستبدلة» بملاحظة
--      (مشغّل custody_missing_supersede) فلا يبقى صفّان للصنف نفسه.
--   4) supply_request_complete(الطلب، الملاحظة، القطع): يغلق طلب الإمداد «مكتملاً» ويجدّد دورة القطع المحدّدة:
--      البداية = تاريخ التسليم (توقيت الرياض)، النهاية = البداية + العمر، status = active، reorder_request_id = الطلب.
--      القطعة المسموحة: مربوطة بالطلب نفسه (reorder_request_id — طلبات اعتماد الإقرار و«طلب سويتر»)، أو لنفس بايكر جولة الطلب.
--      الجوال والدراجة لا يُجدَّدان هنا (الجوال يحتاج IMEI الجهاز الجديد ⇒ «استُبدلت» في صفحة العهد).
--
--   5) إخفاء القرار عن غير المالك (قرار المالك 2026-10-14): البايكر يرى حالة الجرد وملاحظته على قطعه، ولا يرى decision_note ولا decided_by.
--      قراءة الجدول بأعمدة محدّدة (كل الأعمدة عدا الاثنين) لـ authenticated؛ المالك يقرؤهما عبر custody_decisions(المعرّفات).
--      البوابة تقرأ من my_custody_assets (view بصلاحيات القارئ و RLS نفسها، بلا حقول القرار).
--      ⚠ عمود يُضاف مستقبلاً إلى custody_assets لا يُقرأ حتى يُضاف إلى grant select في هذا الملف.
--
-- الصلاحيات: الجرد = تعديل «الجولات الميدانية» · إغلاق الطلب = تعديل «الإمداد» أو «الجولات» (كسياسة sr_wr) · القرار = المالك.
-- وقائع 2026-10-14 (قراءة): custody_assets 40 صفاً (1648 و1700، كلها active/round)، لا قيد على status، start_date إلزامي.
--   supply_requests 0 صفوف. field_rounds 7 جولات. لا مشغّلات على custody_assets غير التدقيق (audit_capture).
-- بلا drop ولا delete ⇒ يُطبَّق عبر الأداة. آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 1) الأعمدة ═══
alter table public.custody_assets
  add column if not exists last_check_at date,
  add column if not exists last_check_condition text,
  add column if not exists last_check_round_id uuid,   -- بلا مفتاح أجنبي (انظر الشرح)
  add column if not exists last_check_note text,
  add column if not exists last_check_photo text,
  add column if not exists last_check_imei_ok boolean,
  add column if not exists decision_status text,
  add column if not exists decision_note text,
  add column if not exists decided_by uuid,
  add column if not exists decided_at timestamptz;
alter table public.field_rounds add column if not exists custody_check jsonb not null default '[]'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'custody_assets_check_cond_ck') then
    alter table public.custody_assets add constraint custody_assets_check_cond_ck
      check (last_check_condition is null or last_check_condition in ('ok', 'damaged', 'lost'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'custody_assets_decision_ck') then
    alter table public.custody_assets add constraint custody_assets_decision_ck
      check (decision_status is null or decision_status in ('pending', 'decided'));
  end if;
  -- «ناقص» بلا عدّاد
  if not exists (select 1 from pg_constraint where conname = 'custody_assets_missing_ck') then
    alter table public.custody_assets add constraint custody_assets_missing_ck check (status <> 'missing' or end_date is null);
  end if;
end $$;
comment on column public.custody_assets.last_check_condition is 'آخر جرد في جولة: ok سليمة · damaged تالفة · lost مفقودة';
comment on column public.custody_assets.decision_status is 'pending = بانتظار قرار المالك (تالفة/مفقودة/IMEI غير مطابق) · decided = قرّر المالك';

-- ═══ 2) الحماية: خانات الجرد والقرار للدالتين أو للمالك ═══
create or replace function public.custody_check_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if public.is_owner() or current_setting('app.custody_rpc', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    if num_nulls(new.decision_status, new.decision_note, new.decided_by, new.decided_at, new.last_check_at, new.last_check_condition,
                 new.last_check_round_id, new.last_check_note, new.last_check_photo, new.last_check_imei_ok) = 10 then return new; end if;
  elsif (new.decision_status, new.decision_note, new.decided_by, new.decided_at, new.last_check_at, new.last_check_condition,
         new.last_check_round_id, new.last_check_note, new.last_check_photo, new.last_check_imei_ok)
        is not distinct from
        (old.decision_status, old.decision_note, old.decided_by, old.decided_at, old.last_check_at, old.last_check_condition,
         old.last_check_round_id, old.last_check_note, old.last_check_photo, old.last_check_imei_ok) then
    return new;
  end if;
  raise exception 'CUSTODY_CHECK_GUARD: الجرد يُسجَّل من الجولة، وقرار التالف/المفقود للمالك فقط';
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'custody_check_guard' and tgrelid = 'public.custody_assets'::regclass) then
    create trigger custody_check_guard before insert or update on public.custody_assets
      for each row execute function public.custody_check_guard();
  end if;
end $$;

-- «ناقصة» تُغلق عند وصول قطعة نشطة لنفس البايكر وبالاسم نفسه (الملاحظة بصيغة «استُبدلت YYYY-MM-DD» التي يقرؤها سجل القطعة)
create or replace function public.custody_missing_supersede() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status in ('active', 'due') and new.employee_id is not null then
    update public.custody_assets
       set status = 'replaced',
           notes = concat_ws(' · ', nullif(notes, ''), format('كانت ناقصة — استُبدلت %s بقطعة %s', (now() at time zone 'Asia/Riyadh')::date, new.id))
     where employee_id = new.employee_id and name = new.name and status = 'missing' and id <> new.id;
  end if;
  return null;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'custody_missing_supersede' and tgrelid = 'public.custody_assets'::regclass) then
    create trigger custody_missing_supersede after insert on public.custody_assets
      for each row execute function public.custody_missing_supersede();
  end if;
end $$;

-- ═══ 3) جرد العهدة من الجولة (معاملة واحدة) ═══
-- p_lines: [{asset_id, condition: ok|damaged|lost, note, photo, imei}] ⇒ {lines, updated, pending}
create or replace function public.round_custody_check(p_round uuid, p_lines jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  r public.field_rounds; a public.custody_assets; l jsonb; v_old jsonb; v_id uuid; v_ids uuid[] := '{}';
  v_cond text; v_note text; v_photo text; v_imei text; v_last4 text; v_ok boolean; v_flag boolean;
  v_out jsonb := '[]'::jsonb; v_upd int := 0; v_pending int := 0;
begin
  if not public.has_perm('field_rounds', true) then raise exception 'ROUND_CUSTODY_DENIED: لا صلاحية تعديل الجولات'; end if;
  select * into r from public.field_rounds where id = p_round for update;
  if not found then raise exception 'ROUND_NOT_FOUND: الجولة غير موجودة'; end if;
  if r.employee_id is null then raise exception 'ROUND_NO_EMPLOYEE: الجولة غير مربوطة بموظف — لا يُخمَّن'; end if;
  -- تاريخ مستقبلي (خطأ إدخال) يجمّد ترتيب «آخر جرد» ⇒ مرفوض
  if r.round_date is null or r.round_date > (now() at time zone 'Asia/Riyadh')::date then
    raise exception 'ROUND_DATE_FUTURE: تاريخ الجولة فارغ أو في المستقبل';
  end if;
  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' then raise exception 'CUSTODY_CHECK_LINES: الأسطر ليست قائمة'; end if;
  v_old := case when jsonb_typeof(r.custody_check) = 'array' then r.custody_check else '[]'::jsonb end;
  perform set_config('app.custody_rpc', 'on', true);

  for l in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_id := nullif(l ->> 'asset_id', '')::uuid;
    if v_id is null or v_id = any(v_ids) then raise exception 'CUSTODY_CHECK_DUP: قطعة مكرّرة أو بلا معرّف'; end if;
    v_ids := v_ids || v_id;
    select * into a from public.custody_assets where id = v_id and employee_id = r.employee_id and status in ('active', 'due') for update;
    if not found then raise exception 'CUSTODY_CHECK_ASSET: القطعة % ليست عهدة نشطة لبايكر الجولة', v_id; end if;
    v_cond := l ->> 'condition';
    v_note := nullif(btrim(coalesce(l ->> 'note', '')), '');
    v_photo := nullif(btrim(coalesce(l ->> 'photo', '')), '');
    if v_cond is null or v_cond not in ('ok', 'damaged', 'lost') then raise exception 'CUSTODY_CHECK_CONDITION: اختر حالة «%»', a.name; end if;
    if v_cond <> 'ok' and v_note is null then raise exception 'CUSTODY_CHECK_NOTE: اكتب ملاحظة لـ«%» (تالفة/مفقودة)', a.name; end if;
    -- الأصول المعمّرة: الدراجة، الجوال، صندوق الخدمة، الخوذة (أسماء الكتالوج src/custodyCatalog.js)
    if (a.item_type in ('motorcycle', 'device') or a.name in ('صندوق الخدمة', 'الخوذة')) and v_cond <> 'lost' and v_photo is null then
      raise exception 'CUSTODY_CHECK_PHOTO: صورة «%» إلزامية', a.name;
    end if;
    -- الصورة من مخزن أدلة الجولات فقط (field-evidence) — لا نص عشوائي ولا رابط خارجي
    if v_photo is not null and v_photo !~ '/storage/v1/object/(public|sign|authenticated)/field-evidence/' then
      raise exception 'CUSTODY_CHECK_PHOTO: صورة «%» ليست من مخزن أدلة الجولات', a.name;
    end if;
    v_ok := null; v_last4 := null;
    if a.item_type = 'device' and v_cond <> 'lost' then
      v_imei := regexp_replace(coalesce(l ->> 'imei', ''), '\D', '', 'g');
      if v_imei <> '' then
        -- أول 15 خانة فقط (قرار المالك): بعض الأجهزة تعرض IMEI/SV بـ17 خانة
        v_ok := left(v_imei, 15) = left(regexp_replace(coalesce(a.serial_no, ''), '\D', '', 'g'), 15); v_last4 := right(left(v_imei, 15), 4);
      else
        -- تعديل الجولة نفسها بلا IMEI جديد ⇒ نتيجة المطابقة المحفوظة على القطعة (محمية بالمشغّل) إن كان آخر جرد لها من هذه الجولة؛
        -- لا تُقرأ النتيجة من custody_check (يكتبه محرّر الجولات مباشرة)
        if not (a.last_check_round_id is not distinct from r.id and a.last_check_imei_ok is not null) then
          raise exception 'CUSTODY_CHECK_IMEI: أدخل IMEI الجوال (اطلب *#06#)';
        end if;
        v_ok := a.last_check_imei_ok;
        select x ->> 'imei_last4' into v_last4 from jsonb_array_elements(v_old) x where x ->> 'asset_id' = a.id::text limit 1;
      end if;
    end if;
    v_out := v_out || jsonb_build_object('asset_id', a.id, 'name', a.name, 'condition', v_cond, 'note', v_note, 'photo', v_photo,
      'imei_ok', v_ok, 'imei_last4', v_last4);
    if a.last_check_at is null or r.round_date >= a.last_check_at then
      -- علامة جديدة فقط إن تغيّرت الحالة عن آخر جرد: إعادة حفظ الجولة نفسها، أو جولة لاحقة تجد التلف نفسه الذي قرّر فيه المالك،
      -- لا تعيد «بانتظار القرار» ولا تمسح القرار
      v_flag := (v_cond <> 'ok' or v_ok is false)
        and not (a.last_check_condition is not distinct from v_cond and a.last_check_imei_ok is not distinct from v_ok
                 and (a.last_check_round_id is not distinct from r.id or a.decision_status is not null));
      update public.custody_assets set
        last_check_at = r.round_date, last_check_condition = v_cond, last_check_round_id = r.id,
        last_check_note = v_note, last_check_photo = v_photo, last_check_imei_ok = v_ok,
        decision_status = case when v_flag then 'pending' else decision_status end,
        decision_note = case when v_flag then null else decision_note end,
        decided_by = case when v_flag then null else decided_by end,
        decided_at = case when v_flag then null else decided_at end
      where id = a.id;
      v_upd := v_upd + 1;
      if v_flag then v_pending := v_pending + 1; end if;
    end if;
  end loop;

  -- أسطر الجولة السابقة لقطع لم تُرسل هذه المرة تبقى (تاريخ الجولة لا يُمحى) — لقطع بايكر الجولة فقط (تغيّر البايكر ⇒ تسقط أسطر السابق)
  update public.field_rounds set custody_check = v_out || coalesce((select jsonb_agg(x) from jsonb_array_elements(v_old) x
      join public.custody_assets c on c.id::text = x ->> 'asset_id' and c.employee_id = r.employee_id
      where not (c.id = any(v_ids))), '[]'::jsonb)
    where id = r.id;
  perform set_config('app.custody_rpc', '', true);
  return jsonb_build_object('lines', jsonb_array_length(v_out), 'updated', v_upd, 'pending', v_pending);
end $$;
revoke all on function public.round_custody_check(uuid, jsonb) from public, anon;
grant execute on function public.round_custody_check(uuid, jsonb) to authenticated;

-- ═══ 4) تسليم طلب الإمداد ⇒ تجديد دورة العهدة المطابقة ═══
-- p_assets: القطع التي يجدّدها التسليم (تختارها الواجهة بمطابقة الصنف، وتؤكّدها) ⇒ {renewed, start}
create or replace function public.supply_request_complete(p_request uuid, p_note text, p_assets uuid[]) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  q public.supply_requests; v_emp uuid; a public.custody_assets; v_id uuid;
  v_day date := (now() at time zone 'Asia/Riyadh')::date; v_n int := 0;
begin
  if not (public.has_perm('supply', true) or public.has_perm('field_rounds', true)) then
    raise exception 'SUPPLY_COMPLETE_DENIED: لا صلاحية';
  end if;
  select * into q from public.supply_requests where id = p_request for update;
  if not found then raise exception 'SUPPLY_NOT_FOUND: الطلب غير موجود'; end if;
  if q.status in ('completed', 'cancelled') then raise exception 'SUPPLY_CLOSED: الطلب مغلق مسبقاً'; end if;
  if q.round_id is not null then select employee_id into v_emp from public.field_rounds where id = q.round_id; end if;
  foreach v_id in array coalesce(p_assets, '{}'::uuid[]) loop
    select * into a from public.custody_assets where id = v_id for update;
    -- مسموح: قطعة مربوطة بالطلب نفسه، أو قطعة لبايكر جولة الطلب (الهوية من الجولة — لا يُخمَّن)
    if not found or not (a.reorder_request_id is not distinct from q.id or (v_emp is not null and a.employee_id = v_emp)) then
      raise exception 'SUPPLY_ASSET: القطعة % ليست مربوطة بالطلب ولا لبايكر جولته', v_id;
    end if;
    if a.status not in ('active', 'due', 'missing') then raise exception 'SUPPLY_ASSET_CLOSED: «%» مُغلقة (%)', a.name, a.status; end if;
    if a.item_type in ('device', 'motorcycle') then raise exception 'SUPPLY_ASSET_TYPE: «%» لا تُجدَّد بالإمداد — استخدم «استُبدلت»', a.name; end if;
    update public.custody_assets set start_date = v_day, end_date = (v_day + make_interval(months => round(a.life_months)::int))::date,
      status = 'active', reorder_request_id = q.id,
      notes = concat_ws(' · ', nullif(a.notes, ''), format('جُدّدت بطلب %s %s', coalesce(q.ref, q.id::text), v_day))
    where id = a.id;
    v_n := v_n + 1;
  end loop;
  update public.supply_requests set status = 'completed', completed_at = now(), completion_note = nullif(btrim(coalesce(p_note, '')), '')
    where id = q.id;
  return jsonb_build_object('renewed', v_n, 'start', v_day);
end $$;
revoke all on function public.supply_request_complete(uuid, text, uuid[]) from public, anon;
grant execute on function public.supply_request_complete(uuid, text, uuid[]) to authenticated;

-- ═══ 5) إخفاء حقلي القرار عن غير المالك ═══
revoke select on public.custody_assets from anon, authenticated;
grant select (id, operator_id, employee_id, biker_name, sweater_id, item_type, category, name, name_en, start_date, life_months, end_date,
  lead_days, cost, status, source, round_id, reorder_request_id, notes, created_at, created_by, serial_no, specs,
  last_check_at, last_check_condition, last_check_round_id, last_check_note, last_check_photo, last_check_imei_ok,
  decision_status, decided_at) on public.custody_assets to authenticated;

-- المالك فقط: نص القرار ومن قرّر (غير المالك ⇒ لا صفوف)
create or replace function public.custody_decisions(p_ids uuid[]) returns table (id uuid, decision_note text, decided_by uuid)
language sql stable security definer set search_path to 'public' as $$
  select c.id, c.decision_note, c.decided_by from public.custody_assets c where public.is_owner() and c.id = any(p_ids);
$$;
revoke all on function public.custody_decisions(uuid[]) from public, anon;
grant execute on function public.custody_decisions(uuid[]) to authenticated;

-- البوابة: قطع البايكر بلا حقول القرار (security_invoker ⇒ صلاحيات القارئ و RLS الجدول نفسها)
create or replace view public.my_custody_assets with (security_invoker = true) as
  select id, employee_id, item_type, category, name, name_en, start_date, end_date, life_months, status, reorder_request_id, source, created_at,
         serial_no, specs, last_check_at, last_check_condition, last_check_note, last_check_photo, last_check_imei_ok
    from public.custody_assets
   where employee_id = public.my_employee_uuid();
revoke all on public.my_custody_assets from anon;
grant select on public.my_custody_assets to authenticated;

-- ═══ التحقق ═══
-- select column_name from information_schema.columns where table_name = 'custody_assets' and column_name like any (array['last_check%','decision%','decided%']);  -- 10
-- select column_name from information_schema.columns where table_name = 'field_rounds' and column_name = 'custody_check';                                    -- 1
-- select conname from pg_constraint where conname in ('custody_assets_check_cond_ck','custody_assets_decision_ck','custody_assets_missing_ck');               -- 3
-- select tgname from pg_trigger where tgname in ('custody_check_guard','custody_missing_supersede');                                                       -- 2
-- select p.proname, p.prosecdef, has_function_privilege('anon', p.oid, 'execute') anon_exec from pg_proc p
--   where p.proname in ('round_custody_check','supply_request_complete','custody_check_guard','custody_missing_supersede');                                                         -- definer، anon=false للدالتين
-- select count(*), count(*) filter (where decision_status is not null or last_check_at is not null) from public.custody_assets;                               -- 40 · 0
-- select has_column_privilege('authenticated','public.custody_assets','decision_note','select'), has_column_privilege('authenticated','public.custody_assets','decided_by','select'),
--        has_column_privilege('authenticated','public.custody_assets','last_check_note','select');                                                          -- false · false · true
-- select count(*) from information_schema.views where table_name = 'my_custody_assets';                                                                  -- 1

-- ═══ التراجع ═══
-- عبر الأداة (بلا حذف):
--   revoke execute on function public.round_custody_check(uuid, jsonb) from authenticated;
--   revoke execute on function public.supply_request_complete(uuid, text, uuid[]) from authenticated;
--   alter table public.custody_assets disable trigger custody_check_guard;
--   alter table public.custody_assets disable trigger custody_missing_supersede;
--   grant select on public.custody_assets to authenticated;   -- يعيد قراءة كل الأعمدة (يلغي الإخفاء)
--   (الأعمدة الجديدة فارغة ولا يقرؤها شيء قبل دمج الواجهة)
-- من SQL Editor (كامل):
--   drop function if exists public.round_custody_check(uuid, jsonb);
--   drop function if exists public.supply_request_complete(uuid, text, uuid[]);
--   drop trigger if exists custody_check_guard on public.custody_assets; drop function if exists public.custody_check_guard();
--   drop trigger if exists custody_missing_supersede on public.custody_assets; drop function if exists public.custody_missing_supersede();
--   alter table public.custody_assets drop constraint if exists custody_assets_check_cond_ck, drop constraint if exists custody_assets_decision_ck,
--     drop constraint if exists custody_assets_missing_ck, drop column if exists last_check_at, drop column if exists last_check_condition,
--     drop column if exists last_check_round_id, drop column if exists last_check_note, drop column if exists last_check_photo,
--     drop column if exists last_check_imei_ok, drop column if exists decision_status, drop column if exists decision_note,
--     drop column if exists decided_by, drop column if exists decided_at;
--   alter table public.field_rounds drop column if exists custody_check;
--   drop view if exists public.my_custody_assets; drop function if exists public.custody_decisions(uuid[]);
--   grant select on public.custody_assets to authenticated;
