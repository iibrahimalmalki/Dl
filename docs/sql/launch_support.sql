-- إطلاق المنصة للبايكرز: مركز «الدعم والأفكار» + متتبع الحصر (اعتماد السفير لكل خطوة)
-- الحالة: مقترح — لا يُطبَّق على الإنتاج قبل موافقة المالك. يُطبَّق بـ apply_migration لا execute_sql.
-- اختُبر محلياً (Postgres 16) مع نسخ مطابقة لدوال الإنتاج (has_perm، my_biker_id، push_notification، audit_capture) وصلاحيات Supabase الافتراضية:
--   البايكر لا يزوّر هويته ولا حالته، ولا يرى طلبات زميله، ولا يعدّل ولا يحذف؛ الموظف بلا «التعاقد والإعداد» لا يرى شيئاً؛
--   السفير يرى الكل ويرد، والإغلاق بلا رد مرفوض؛ «طلب» يُنشئ SUP-<رقم> في طلبات الإمداد؛ الإشعارات تصل للسفير ثم للبايكر.
--
-- الصلاحية: وحدة «التعاقد والإعداد» (onboarding) الموجودة — سلمان وعمر لديهما تعديل عليها، والمالك دائماً (has_perm).
--   قراءة onboarding ⇒ يرى الطلبات والمتتبع؛ تعديل onboarding ⇒ يرد ويغيّر الحالة ويعتمد الخطوات.
-- البايكر: يرفع طلباته ويرى طلباته فقط، ويرى حالة خطوات حصره فقط. لا حذف لأي صف.
-- «طلب» (مواد/صيانة/وثيقة) ⇒ يُنشأ تلقائياً طلب في «طلبات الإمداد والتصعيد» (supply_requests) ويُربط بالطلب.

begin;

-- ═══ 1) مركز الدعم والأفكار ═══
create table public.support_tickets (
  id                uuid primary key default gen_random_uuid(),
  seq               bigint generated always as identity unique,
  user_id           uuid not null default auth.uid(),
  employee_id       uuid references public.employees(id),
  biker_employee_id text,
  biker_name        text,
  operator_id       uuid,
  kind              text not null check (kind in ('problem','idea','question','request')),
  body              text not null check (char_length(btrim(body)) between 3 and 2000),
  screen            text check (screen is null or char_length(screen) <= 40),
  photos            jsonb not null default '[]'
                    check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 3),
  status            text not null default 'new' check (status in ('new','in_review','done','wont_do')),
  reply             text check (reply is null or char_length(reply) <= 2000),
  replied_by        uuid,
  replied_at        timestamptz,
  supply_request_id uuid references public.supply_requests(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- «تم التنفيذ» و«لن يُنفَّذ» لا يُغلقان بلا رد مكتوب
  constraint support_tickets_close_reply_ck check (status not in ('done','wont_do') or nullif(btrim(reply), '') is not null)
);
create index on public.support_tickets (user_id, created_at desc);
create index on public.support_tickets (status, created_at desc);

-- الإدراج: هوية البايكر من حسابه لا من المتصفح، والحالة «مستلم» دائماً، والصور في مجلّده فقط
create or replace function public.support_ticket_bi()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_bid text; v_name text; v_op uuid; p jsonb;
begin
  select btrim(biker_employee_id), display_name, operator_id into v_bid, v_name, v_op
    from public.app_users where id = auth.uid() and active;
  if coalesce(v_bid, '') = '' then raise exception 'support: الحساب غير مرتبط برقم بايكر'; end if;
  new.user_id := auth.uid();
  new.biker_employee_id := v_bid; new.biker_name := v_name; new.operator_id := v_op;
  new.employee_id := (select e.id from public.employees e where e.employee_id = v_bid limit 1);
  new.status := 'new'; new.reply := null; new.replied_by := null; new.replied_at := null; new.supply_request_id := null;
  new.created_at := now(); new.updated_at := now();
  for p in select * from jsonb_array_elements(new.photos) loop
    if jsonb_typeof(p) <> 'string' or left(p #>> '{}', 37) <> auth.uid()::text || '/' then
      raise exception 'support: مسار صورة غير صالح';
    end if;
  end loop;
  return new;
end $$;
create trigger support_ticket_bi before insert on public.support_tickets
  for each row execute function public.support_ticket_bi();

-- التحديث (للسفير/المالك فقط عبر السياسة): من ردّ ومتى
create or replace function public.support_ticket_bu()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  new.updated_at := now();
  if new.reply is distinct from old.reply then new.replied_by := auth.uid(); new.replied_at := now(); end if;
  return new;
end $$;
create trigger support_ticket_bu before update on public.support_tickets
  for each row execute function public.support_ticket_bu();

-- بعد الإدراج: إشعار السفيرين والمالك، و«طلب» ⇒ طلب إمداد مربوط
create or replace function public.support_ticket_ai()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_kind text; v_sr uuid;
begin
  v_kind := case new.kind when 'problem' then 'مشكلة' when 'idea' then 'فكرة' when 'question' then 'سؤال' else 'طلب' end;
  perform public.push_notification('perm:onboarding', null, 'support', case when new.kind = 'problem' then 'warn' else 'info' end,
    'الدعم والأفكار #' || new.seq || ' — ' || v_kind || ' من ' || coalesce(new.biker_name, '—'),
    left(new.body, 160), 'support', new.id::text, 'sup-new-' || new.id);
  if new.kind = 'request' then
    insert into public.supply_requests (operator_id, ref, biker_name, sweater_id, requesting_dept, items, notes)
    values (new.operator_id, 'SUP-' || new.seq, new.biker_name, new.biker_employee_id, 'بوابة البايكر — الدعم والأفكار',
      jsonb_build_array(jsonb_build_object('n', null, 'ar', new.body, 'en', '', 'type', 'طلب بايكر',
        'category', 'طلب من البايكر', 'category_en', 'Biker request', 'status', 'request',
        'status_ar', 'طلب', 'status_en', 'Request', 'note', 'من مركز الدعم #' || new.seq, 'parts_ar', '', 'parts_en', '')),
      'أُنشئ تلقائياً من طلب الدعم #' || new.seq)
    returning id into v_sr;
    update public.support_tickets set supply_request_id = v_sr where id = new.id;
  end if;
  return new;
end $$;
create trigger support_ticket_ai after insert on public.support_tickets
  for each row execute function public.support_ticket_ai();

-- بعد تغيير الحالة أو الرد: إشعار البايكر صاحب الطلب
create or replace function public.support_ticket_au()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status is distinct from old.status or new.reply is distinct from old.reply then
    perform public.push_notification('user', new.user_id, 'support', 'info',
      'طلبك #' || new.seq || ': ' || case new.status when 'new' then 'مستلم' when 'in_review' then 'قيد الفحص'
        when 'done' then 'تم التنفيذ' else 'لن يُنفَّذ' end,
      coalesce(left(new.reply, 160), ''), 'support', new.id::text,
      'sup-upd-' || new.id || '-' || new.status || '-' || md5(coalesce(new.reply, '')));
  end if;
  return new;
end $$;
create trigger support_ticket_au after update on public.support_tickets
  for each row execute function public.support_ticket_au();

create trigger trg_support_tickets_audit after insert or update or delete on public.support_tickets
  for each row execute function public.audit_capture();

alter table public.support_tickets enable row level security;
create policy sup_sel on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.has_perm('onboarding'));
create policy sup_ins on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid() and public.my_biker_id() is not null);
create policy sup_upd on public.support_tickets for update to authenticated
  using (public.has_perm('onboarding', true)) with check (public.has_perm('onboarding', true));
-- لا سياسة حذف. التحديث محصور بعمودي الحالة والرد.
revoke update on public.support_tickets from authenticated, anon;
grant update (status, reply) on public.support_tickets to authenticated;
revoke all on public.support_tickets from anon;

-- لقطات الشاشة: bucket خاص، مجلّد لكل مستخدم، حتى 3 MB للصورة
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-shots', 'support-shots', false, 3145728, array['image/jpeg','image/png','image/webp','image/heic']);
create policy p_supshot_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'support-shots' and (storage.foldername(name))[1] = auth.uid()::text);
create policy p_supshot_sel on storage.objects for select to authenticated
  using (bucket_id = 'support-shots' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_perm('onboarding')));

-- ═══ 2) متتبع الحصر: اعتماد السفير لكل خطوة ═══
create table public.relaunch_steps (
  employee_id uuid not null references public.employees(id),
  step        text not null check (step in ('profile','docs','bike','assets','daily','academy')),
  status      text not null check (status in ('in_progress','approved','needs_fix')),
  note        text check (note is null or char_length(note) <= 1000),
  decided_by  uuid default auth.uid(),
  decided_at  timestamptz not null default now(),
  primary key (employee_id, step),
  constraint relaunch_fix_note_ck check (status <> 'needs_fix' or nullif(btrim(note), '') is not null)
);

create or replace function public.relaunch_step_bw()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin new.decided_by := auth.uid(); new.decided_at := now(); return new; end $$;
create trigger relaunch_step_bw before insert or update on public.relaunch_steps
  for each row execute function public.relaunch_step_bw();

-- إشعار البايكر بالاعتماد أو بطلب التصحيح
create or replace function public.relaunch_step_aw()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid; v_step text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status and new.note is not distinct from old.note then return new; end if;
  if new.status = 'in_progress' then return new; end if;
  select au.id into v_uid from public.app_users au join public.employees e on btrim(au.biker_employee_id) = e.employee_id
    where e.id = new.employee_id and au.active limit 1;
  if v_uid is null then return new; end if;
  v_step := case new.step when 'profile' then 'بياناتي' when 'docs' then 'وثائقي' when 'bike' then 'الدراجة'
    when 'assets' then 'العهدة' when 'daily' then 'الاستلام اليومي والوقود' else 'الأكاديمية' end;
  perform public.push_notification('user', v_uid, 'support', case when new.status = 'approved' then 'info' else 'warn' end,
    case when new.status = 'approved' then '✓ اعتُمدت خطوة «' || v_step || '»' else 'خطوة «' || v_step || '» تحتاج تصحيحاً' end,
    coalesce(new.note, ''), 'relaunch', new.step, 'rl-' || new.employee_id || '-' || new.step || '-' || new.status || '-' || md5(coalesce(new.note, '')));
  return new;
end $$;
create trigger relaunch_step_aw after insert or update on public.relaunch_steps
  for each row execute function public.relaunch_step_aw();

create trigger trg_relaunch_steps_audit after insert or update or delete on public.relaunch_steps
  for each row execute function public.audit_capture();

alter table public.relaunch_steps enable row level security;
create policy rl_sel on public.relaunch_steps for select to authenticated
  using (public.has_perm('onboarding') or employee_id = public.my_employee_uuid());
create policy rl_ins on public.relaunch_steps for insert to authenticated
  with check (public.has_perm('onboarding', true));
create policy rl_upd on public.relaunch_steps for update to authenticated
  using (public.has_perm('onboarding', true)) with check (public.has_perm('onboarding', true));
revoke all on public.relaunch_steps from anon;

-- قائمة البايكرز للمتتبع: حسابات بايكر نشطة مرتبطة بموظف (للسفير/المالك فقط)
create or replace function public.relaunch_roster()
returns table (employee_id uuid, full_name text, biker_employee_id text)
language sql stable security definer set search_path to 'public' as $$
  select e.id, coalesce(au.display_name, e.full_name), btrim(au.biker_employee_id)
  from public.app_users au join public.employees e on e.employee_id = btrim(au.biker_employee_id)
  where au.active and coalesce(au.biker_employee_id, '') <> '' and public.has_perm('onboarding')
  order by 2
$$;
revoke all on function public.relaunch_roster() from public, anon;
grant execute on function public.relaunch_roster() to authenticated;

commit;
