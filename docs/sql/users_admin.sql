-- صفحة «المستخدمون»: آخر دخول + حفظ الصلاحيات دفعة واحدة.
-- الحالة: لم يُطبَّق — بانتظار موافقة المالك. الواجهة تعمل بدونه (تخفي «آخر دخول» وتحفظ الصلاحيات بالطريقة القديمة).
-- آمن لإعادة التشغيل.

-- 1) آخر دخول لكل مستخدم (من auth.users) — للمالك فقط
create or replace function public.admin_users_activity()
returns table (user_id uuid, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  return query select au.id, u.last_sign_in_at from public.app_users au left join auth.users u on u.id = au.id;
end $$;
revoke all on function public.admin_users_activity() from public, anon;
grant execute on function public.admin_users_activity() to authenticated;

-- 2) استبدال صلاحيات مستخدم في معاملة واحدة: إن فشل الإدراج لا يُحذف شيء.
-- p_rows: [{"module":"supply","raci":"R"}, …] — can_view/can_edit تُحسب هنا (A/R تعديل، C/I عرض).
create or replace function public.set_user_permissions(p_user uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  if not public.is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then raise exception 'p_rows must be an array'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x where x->>'raci' not in ('A','R','C','I') or coalesce(x->>'module','') = '') then
    raise exception 'invalid row' using errcode = '22023'; end if;
  delete from public.user_permissions where user_id = p_user;
  insert into public.user_permissions (user_id, module, raci, can_view, can_edit)
    select p_user, x->>'module', x->>'raci', true, (x->>'raci') in ('A','R')
    from (select distinct on (x->>'module') x from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x) d;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.set_user_permissions(uuid, jsonb) from public, anon;
grant execute on function public.set_user_permissions(uuid, jsonb) to authenticated;
