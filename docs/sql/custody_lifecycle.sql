-- دورة حياة العهدة: تسجيل أول مرة واحدة + تحديث حالة لكل قطعة — كلاهما «بانتظار الاعتماد» — وربط القطع بالعمر الافتراضي (custody_assets).
-- الحالة: **لم يُطبَّق** — يُشغَّل كاملاً من SQL Editor بعد موافقة المالك، **قبل** دمج PR الواجهة (الواجهة الجديدة تقرأ الأعمدة الجديدة).
-- يلغي المشغّل biker_assets_replace (docs/sql/custody_replacement.sql): طلب الاستبدال يُنشأ عند الاعتماد لا عند الإدراج.
--
-- لماذا أعمدة في biker_assets لا جدول جديد: التحديث له شكل الإقرار نفسه (أصناف + صورة + حالة + ملاحظة)، وسياسات
-- البايكر/المالك وصفحة المالك قائمة عليه؛ يكفي kind (baseline/update) و asset_id للتحديث وحقول المراجعة.
-- status: «declared» (القيمة القائمة) = بانتظار الاعتماد · approved · rejected. الإقرار القائم (عابد 03/10) يبقى كما هو = تسجيل أول معلّق.
--
-- الهوية: biker_assets.biker_employee_id = employees.employee_id (= app_users.biker_employee_id)، و custody_assets.employee_id = employees.id.
-- لا يُخمَّن: إن لم يوجد موظف بنفس الرقم يُرفض الاعتماد برسالة.
-- صلاحية الاعتماد («العُهد»): المالك، أو تعديل «الإمداد» أو «الجولات الميدانية» — نفس من يكتب في custody_assets اليوم (سياسة ca_wr).

begin;

-- ═══ 1) إيقاف طلب الاستبدال عند الإدراج ═══
drop trigger if exists biker_assets_replace on public.biker_assets;
drop function if exists public.biker_assets_replace();

-- ═══ 2) أعمدة المراجعة ═══
alter table public.biker_assets
  add column if not exists kind text not null default 'baseline',
  add column if not exists asset_id uuid references public.custody_assets(id) on delete set null,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reject_reason text,
  add column if not exists approved_start date,
  add column if not exists request_id uuid;
alter table public.biker_assets drop constraint if exists biker_assets_kind_chk;
alter table public.biker_assets add constraint biker_assets_kind_chk
  check (kind in ('baseline', 'update') and (kind = 'baseline' or asset_id is not null));
-- تسجيل أول واحد لكل بايكر (المرفوض لا يُحسب ⇒ يعيد التسجيل) · تحديث معلّق واحد لكل قطعة
create unique index if not exists biker_assets_one_baseline on public.biker_assets (btrim(biker_employee_id))
  where kind = 'baseline' and status <> 'rejected';
create unique index if not exists biker_assets_one_pending_update on public.biker_assets (asset_id)
  where kind = 'update' and status = 'declared';

-- ═══ 3) الصلاحيات ═══
create or replace function public.custody_can_review() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.is_owner() or public.has_perm('supply', true) or public.has_perm('field_rounds', true)
$$;
revoke all on function public.custody_can_review() from public, anon;
grant execute on function public.custody_can_review() to authenticated;

-- البايكر: يُدرج لنفسه فقط، بانتظار الاعتماد، بلا حقول مراجعة؛ والتحديث لقطعة نشطة له
drop policy if exists biker_assets_ins on public.biker_assets;
create policy biker_assets_ins on public.biker_assets for insert to authenticated with check (
  public.is_owner() or (
    biker_employee_id = public.my_biker_id() and status = 'declared'
    and reviewed_by is null and reviewed_at is null and reject_reason is null and approved_start is null and request_id is null
    and (kind = 'baseline' or exists (select 1 from public.custody_assets ca
          where ca.id = asset_id and ca.employee_id = public.my_employee_uuid() and ca.status not in ('replaced', 'returned')))));
-- القراءة: البايكر لنفسه، والمالك، ومن يعتمد العُهد، و«الأسطول» كما كانت
drop policy if exists biker_assets_sel on public.biker_assets;
create policy biker_assets_sel on public.biker_assets for select to authenticated using (
  biker_employee_id = public.my_biker_id() or public.custody_can_review() or public.has_perm('fleet', false));
-- التعديل/الحذف المباشر: المالك فقط (الاعتماد/الرفض عبر custody_review). كان: المالك + تعديل «الأسطول».
drop policy if exists biker_assets_upd on public.biker_assets;
create policy biker_assets_upd on public.biker_assets for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- البايكر يقرأ قطع عهدته في custody_assets (لـ «عهدتي الحالية»)؛ الكتابة كما هي (ca_wr)
drop policy if exists ca_biker_sel on public.custody_assets;
create policy ca_biker_sel on public.custody_assets for select to authenticated using (employee_id = public.my_employee_uuid());

-- ═══ 4) إشعار المالك بكل تسجيل/تحديث معلّق ═══
create or replace function public.biker_assets_pending_notify()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_what text; v_asset text;
begin
  if new.status is distinct from 'declared' then return new; end if;
  if new.kind = 'update' then
    select name into v_asset from public.custody_assets where id = new.asset_id;
    v_what := 'تحديث حالة: ' || coalesce(v_asset, '—') || ' (' || coalesce(new.items -> 0 ->> 'condition', '—') || ')';
  else
    v_what := 'تسجيل العهدة الأول: ' || coalesce(jsonb_array_length(new.items), 0) || ' صنف';
  end if;
  perform public.push_notification('owner', null, 'supply', 'info',
    'عهدة بانتظار الاعتماد — ' || coalesce(new.biker_name, new.biker_employee_id),
    coalesce(new.biker_name, '') || ' (' || coalesce(new.biker_employee_id, '') || '): ' || v_what,
    'custody', new.id::text, 'asset-pending-' || new.id);
  return new;
end $$;
revoke all on function public.biker_assets_pending_notify() from public, anon, authenticated;
drop trigger if exists biker_assets_pending_notify on public.biker_assets;
create trigger biker_assets_pending_notify after insert on public.biker_assets
  for each row execute function public.biker_assets_pending_notify();

-- ═══ 5) الاعتماد/الرفض في معاملة واحدة ═══
-- p_lines (للتسجيل الأول فقط، تحسبه الواجهة من الكتالوج — custodyLifecycle.baselineLines):
--   [{catalog_key, item_keys:[…], asset_id|null, name, name_en, item_type, category, life_months, lead_days}]
-- asset_id موجود ⇒ تُربط القطعة القائمة ولا يتغيّر تاريخها؛ null ⇒ قطعة جديدة start_date = p_start (افتراضياً تاريخ الإقرار)، source='declaration'.
-- قطع الحالة السيئة/التالفة المعتمدة ⇒ طلب استبدال واحد في supply_requests + status='due' + reorder_request_id، ما لم يكن للقطعة طلب مفتوح.
create or replace function public.custody_review(p_id uuid, p_approve boolean, p_reason text default null,
  p_start date default null, p_lines jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  r public.biker_assets; v_emp public.employees; v_uid uuid; v_start date; l jsonb; it jsonb; v_aid uuid;
  v_items jsonb; v_req_items jsonb := '[]'::jsonb; v_req_assets uuid[] := '{}'; v_req uuid; v_ref text;
  v_new int := 0; v_linked int := 0; a public.custody_assets; v_cond text; v_note text; v_photo text; v_qty numeric; k text;
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
        insert into public.custody_assets (operator_id, employee_id, biker_name, sweater_id, item_type, category, name, name_en,
            start_date, life_months, lead_days, end_date, status, source, notes, created_by)
          values (r.operator_id, v_emp.id, v_emp.full_name, btrim(r.biker_employee_id), l ->> 'item_type', l ->> 'category', l ->> 'name', l ->> 'name_en',
            v_start, (l ->> 'life_months')::numeric, (l ->> 'lead_days')::int,
            (v_start + make_interval(months => round((l ->> 'life_months')::numeric)::int))::date,
            'active', 'declaration', 'من إقرار العهدة ' || r.id, auth.uid())
          returning * into a;
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

commit;

-- ═══ تحقّق (قراءة فقط) ═══
-- select tgname from pg_trigger where tgrelid = 'public.biker_assets'::regclass and not tgisinternal;  -- المتوقع: biker_assets_pending_notify فقط
-- select column_name from information_schema.columns where table_name = 'biker_assets' and column_name in ('kind','asset_id','reviewed_by','reviewed_at','reject_reason','approved_start','request_id');  -- 7
-- select proname, prosecdef from pg_proc where proname in ('custody_review','custody_can_review','biker_assets_pending_notify');  -- 3 × true
-- select has_function_privilege('anon','public.custody_review(uuid,boolean,text,date,jsonb)','execute');  -- false
-- select policyname, cmd from pg_policies where tablename in ('biker_assets','custody_assets') order by 1;  -- biker_assets_ins/sel/upd + ca_biker_sel + ca_sel/ca_wr
-- select id, kind, status from biker_assets;  -- إقرار عابد: baseline / declared (لم يتغيّر)

-- ═══ تراجع ═══
-- begin;
-- drop trigger if exists biker_assets_pending_notify on public.biker_assets; drop function if exists public.biker_assets_pending_notify();
-- drop function if exists public.custody_review(uuid, boolean, text, date, jsonb);
-- drop policy if exists ca_biker_sel on public.custody_assets;
-- drop policy if exists biker_assets_ins on public.biker_assets; drop policy if exists biker_assets_sel on public.biker_assets; drop policy if exists biker_assets_upd on public.biker_assets;
-- create policy biker_assets_ins on public.biker_assets for insert to authenticated with check ((biker_employee_id = my_biker_id()) or is_owner() or has_perm('fleet', true));
-- create policy biker_assets_sel on public.biker_assets for select to authenticated using ((biker_employee_id = my_biker_id()) or is_owner() or has_perm('fleet', false));
-- create policy biker_assets_upd on public.biker_assets for all to authenticated using (is_owner() or has_perm('fleet', true)) with check (is_owner() or has_perm('fleet', true));
-- drop function if exists public.custody_can_review();
-- drop index if exists biker_assets_one_baseline; drop index if exists biker_assets_one_pending_update;
-- alter table public.biker_assets drop constraint if exists biker_assets_kind_chk;
-- alter table public.biker_assets drop column if exists kind, drop column if exists asset_id, drop column if exists reviewed_by, drop column if exists reviewed_at,
--   drop column if exists reject_reason, drop column if exists approved_start, drop column if exists request_id;
-- -- (اختياري) إعادة المشغّل القديم: شغّل docs/sql/custody_replacement.sql
-- commit;
