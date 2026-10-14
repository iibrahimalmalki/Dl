-- ═══════════════════════════════════════════════════════════════════════════
-- round_custody_check.sql — ربط الجولة الميدانية بسجل العهد (طلب المالك 2026-10-14)
-- الحالة: **لم يُطبَّق**
-- ═══════════════════════════════════════════════════════════════════════════
-- الشرح
--   1) «جرد العهدة» في الجولة: لكل قطعة نشطة لبايكر الجولة: سليمة (ok) / تالفة (damaged) / مفقودة (lost) + ملاحظة.
--      الدالة round_custody_check(الجولة، الأسطر) تحفظ الأسطر على الجولة (field_rounds.custody_check) وتحدّث على كل قطعة:
--        last_check_at (تاريخ الجولة) · last_check_condition · last_check_round_id · last_check_note · last_check_photo · last_check_imei_ok
--      • الأصول المعمّرة (الدراجة، الجوال، صندوق الخدمة، الخوذة): صورة إلزامية (إلا «مفقودة»).
--      • الجوال: IMEI المُدخل (*#06#) يُطابَق في القاعدة مع serial_no ⇒ last_check_imei_ok (✅/❌). يُحفظ آخر 4 أرقام فقط على الجولة.
--      • التالفة/المفقودة أو IMEI غير مطابق ⇒ decision_status = 'pending' («بانتظار قرار المالك»). لا تحميل على البايكر،
--        ولا تتغيّر حالة القطعة (status) — القرار للمالك. «سليمة» لا تمسح علامة قائمة؛ المالك وحده يمسحها.
--      • تعديل جولة أقدم لا يكتب فوق جرد أحدث (round_date < last_check_at ⇒ تُحفظ على الجولة فقط).
--      • round_id القائم (الجولة التي أنشأت القطعة) لا يتغيّر؛ رقم جولة آخر جرد في last_check_round_id.
--        last_check_round_id بلا مفتاح أجنبي: إزالة جولة لا تتعطّل بسببه، وأداة MCP تتعطّل على عبارة الحذف في تعريف المفتاح.
--   2) قرار المالك: decision_status = 'decided' + decision_note + decided_by/decided_at — المالك فقط (مشغّل custody_decision_guard).
--      غير المالك يستطيع فقط وضع القطعة «بانتظار القرار» (بحقول قرار فارغة).
--   3) «ناقص» (status = 'missing'): صنف سُجّل ناقصاً في الجولة ⇒ يُنشأ بلا عدّاد (end_date فارغ، والبداية = تاريخ الجولة للتوثيق فقط).
--   4) supply_request_complete(الطلب، الملاحظة، القطع): يغلق طلب الإمداد «مكتملاً»، ولطلب مرتبط بجولة يجدّد دورة القطع المحدّدة
--      لنفس بايكر الجولة: البداية = تاريخ التسليم (توقيت الرياض)، النهاية = البداية + العمر، status = active، reorder_request_id = الطلب.
--      الجوال والدراجة لا يُجدَّدان هنا (الجوال يحتاج IMEI الجهاز الجديد ⇒ «استُبدلت» في صفحة العهد).
--
-- الصلاحيات: الجرد = تعديل «الجولات الميدانية» · إغلاق الطلب = تعديل «الإمداد» أو «الجولات» (كسياسة sr_wr) · القرار = المالك.
-- وقائع 2026-10-14 (قراءة): custody_assets 40 صفاً (1648 و1700، كلها active/round)، لا عمود status بقيد، start_date إلزامي.
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

-- ═══ 2) قرار المالك للمالك وحده ═══
create or replace function public.custody_decision_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if public.is_owner() then return new; end if;
  if tg_op = 'INSERT' then
    if new.decision_status is null and new.decision_note is null and new.decided_by is null and new.decided_at is null then return new; end if;
  elsif (new.decision_status, new.decision_note, new.decided_by, new.decided_at)
        is not distinct from (old.decision_status, old.decision_note, old.decided_by, old.decided_at) then
    return new;
  end if;
  -- غير المالك: فقط «بانتظار القرار» بحقول قرار فارغة
  if new.decision_status = 'pending' and new.decision_note is null and new.decided_by is null and new.decided_at is null then return new; end if;
  raise exception 'CUSTODY_DECISION_OWNER: قرار التالف/المفقود للمالك فقط';
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'custody_decision_guard' and tgrelid = 'public.custody_assets'::regclass) then
    create trigger custody_decision_guard before insert or update on public.custody_assets
      for each row execute function public.custody_decision_guard();
  end if;
end $$;

-- ═══ 3) جرد العهدة من الجولة (معاملة واحدة) ═══
-- p_lines: [{asset_id, condition: ok|damaged|lost, note, photo, imei}] ⇒ {lines, updated, pending}
create or replace function public.round_custody_check(p_round uuid, p_lines jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  r public.field_rounds; a public.custody_assets; l jsonb; v_id uuid; v_ids uuid[] := '{}';
  v_cond text; v_note text; v_photo text; v_imei text; v_ok boolean; v_flag boolean;
  v_out jsonb := '[]'::jsonb; v_upd int := 0; v_pending int := 0;
begin
  if not public.has_perm('field_rounds', true) then raise exception 'ROUND_CUSTODY_DENIED: لا صلاحية تعديل الجولات'; end if;
  select * into r from public.field_rounds where id = p_round for update;
  if not found then raise exception 'ROUND_NOT_FOUND: الجولة غير موجودة'; end if;
  if r.employee_id is null then raise exception 'ROUND_NO_EMPLOYEE: الجولة غير مربوطة بموظف — لا يُخمَّن'; end if;
  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' then raise exception 'CUSTODY_CHECK_LINES: الأسطر ليست قائمة'; end if;

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
    v_ok := null; v_imei := null;
    if a.item_type = 'device' and v_cond <> 'lost' then
      v_imei := regexp_replace(coalesce(l ->> 'imei', ''), '\D', '', 'g');
      if v_imei = '' then raise exception 'CUSTODY_CHECK_IMEI: أدخل IMEI الجوال (اطلب *#06#)'; end if;
      v_ok := v_imei = regexp_replace(coalesce(a.serial_no, ''), '\D', '', 'g');
    end if;
    v_flag := v_cond <> 'ok' or v_ok is false;
    v_out := v_out || jsonb_build_object('asset_id', a.id, 'name', a.name, 'condition', v_cond, 'note', v_note, 'photo', v_photo,
      'imei_ok', v_ok, 'imei_last4', case when v_imei is not null then right(v_imei, 4) end);
    if a.last_check_at is null or r.round_date >= a.last_check_at then
      update public.custody_assets set
        last_check_at = r.round_date, last_check_condition = v_cond, last_check_round_id = r.id,
        last_check_note = v_note, last_check_photo = v_photo, last_check_imei_ok = v_ok,
        decision_status = case when v_flag then 'pending' else decision_status end,
        decision_note = case when v_flag and decision_status is distinct from 'pending' then null else decision_note end,
        decided_by = case when v_flag then null else decided_by end,
        decided_at = case when v_flag then null else decided_at end
      where id = a.id;
      v_upd := v_upd + 1;
      if v_flag then v_pending := v_pending + 1; end if;
    end if;
  end loop;

  update public.field_rounds set custody_check = v_out where id = r.id;
  return jsonb_build_object('lines', jsonb_array_length(v_out), 'updated', v_upd, 'pending', v_pending);
end $$;
revoke all on function public.round_custody_check(uuid, jsonb) from public, anon;
grant execute on function public.round_custody_check(uuid, jsonb) to authenticated;

-- ═══ 4) تسليم طلب الإمداد ⇒ تجديد دورة العهدة المطابقة ═══
-- p_assets: القطع التي يجدّدها التسليم (تختارها الواجهة بمطابقة الصنف) ⇒ {renewed, start}
create or replace function public.supply_request_complete(p_request uuid, p_note text, p_assets uuid[]) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  q public.supply_requests; r public.field_rounds; a public.custody_assets; v_id uuid;
  v_day date := (now() at time zone 'Asia/Riyadh')::date; v_n int := 0;
begin
  if not (public.has_perm('supply', true) or public.has_perm('field_rounds', true)) then
    raise exception 'SUPPLY_COMPLETE_DENIED: لا صلاحية';
  end if;
  select * into q from public.supply_requests where id = p_request for update;
  if not found then raise exception 'SUPPLY_NOT_FOUND: الطلب غير موجود'; end if;
  if q.status in ('completed', 'cancelled') then raise exception 'SUPPLY_CLOSED: الطلب مغلق مسبقاً'; end if;
  if coalesce(cardinality(p_assets), 0) > 0 then
    if q.round_id is null then raise exception 'SUPPLY_NO_ROUND: التجديد لطلب مرتبط بجولة فقط'; end if;
    select * into r from public.field_rounds where id = q.round_id;
    if not found or r.employee_id is null then raise exception 'SUPPLY_NO_EMPLOYEE: جولة الطلب غير مربوطة بموظف — لا يُخمَّن'; end if;
    foreach v_id in array p_assets loop
      select * into a from public.custody_assets where id = v_id for update;
      if not found or a.employee_id is distinct from r.employee_id then raise exception 'SUPPLY_ASSET: القطعة % ليست لبايكر الجولة', v_id; end if;
      if a.status not in ('active', 'due', 'missing') then raise exception 'SUPPLY_ASSET_CLOSED: «%» مُغلقة (%)', a.name, a.status; end if;
      if a.item_type in ('device', 'motorcycle') then raise exception 'SUPPLY_ASSET_TYPE: «%» لا تُجدَّد بالإمداد — استخدم «استُبدلت»', a.name; end if;
      if a.reorder_request_id = q.id then continue; end if;
      update public.custody_assets set start_date = v_day, end_date = (v_day + make_interval(months => round(a.life_months)::int))::date,
        status = 'active', reorder_request_id = q.id,
        notes = concat_ws(' · ', nullif(a.notes, ''), format('جُدّدت بطلب %s %s', coalesce(q.ref, q.id::text), v_day))
      where id = a.id;
      v_n := v_n + 1;
    end loop;
  end if;
  update public.supply_requests set status = 'completed', completed_at = now(), completion_note = nullif(btrim(coalesce(p_note, '')), '')
    where id = q.id;
  return jsonb_build_object('renewed', v_n, 'start', v_day);
end $$;
revoke all on function public.supply_request_complete(uuid, text, uuid[]) from public, anon;
grant execute on function public.supply_request_complete(uuid, text, uuid[]) to authenticated;

-- ═══ التحقق ═══
-- select column_name from information_schema.columns where table_name = 'custody_assets' and column_name like any (array['last_check%','decision%','decided%']);  -- 10
-- select column_name from information_schema.columns where table_name = 'field_rounds' and column_name = 'custody_check';                                    -- 1
-- select conname from pg_constraint where conname in ('custody_assets_check_cond_ck','custody_assets_decision_ck','custody_assets_missing_ck');               -- 3
-- select tgname from pg_trigger where tgname = 'custody_decision_guard';                                                                                    -- 1
-- select p.proname, p.prosecdef, has_function_privilege('anon', p.oid, 'execute') anon_exec from pg_proc p
--   where p.proname in ('round_custody_check','supply_request_complete','custody_decision_guard');                                                         -- definer، anon=false للدالتين
-- select count(*), count(*) filter (where decision_status is not null or last_check_at is not null) from public.custody_assets;                               -- 40 · 0

-- ═══ التراجع ═══
-- عبر الأداة (بلا حذف):
--   revoke execute on function public.round_custody_check(uuid, jsonb) from authenticated;
--   revoke execute on function public.supply_request_complete(uuid, text, uuid[]) from authenticated;
--   alter table public.custody_assets disable trigger custody_decision_guard;
--   (الأعمدة الجديدة فارغة ولا يقرؤها شيء قبل دمج الواجهة)
-- من SQL Editor (كامل):
--   drop function if exists public.round_custody_check(uuid, jsonb);
--   drop function if exists public.supply_request_complete(uuid, text, uuid[]);
--   drop trigger if exists custody_decision_guard on public.custody_assets; drop function if exists public.custody_decision_guard();
--   alter table public.custody_assets drop constraint if exists custody_assets_check_cond_ck, drop constraint if exists custody_assets_decision_ck,
--     drop constraint if exists custody_assets_missing_ck, drop column if exists last_check_at, drop column if exists last_check_condition,
--     drop column if exists last_check_round_id, drop column if exists last_check_note, drop column if exists last_check_photo,
--     drop column if exists last_check_imei_ok, drop column if exists decision_status, drop column if exists decision_note,
--     drop column if exists decided_by, drop column if exists decided_at;
--   alter table public.field_rounds drop column if exists custody_check;
