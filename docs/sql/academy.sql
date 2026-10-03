-- أكاديمية دلو ورغوة — الجداول والسياسات والتخزين
-- الحالة: بانتظار موافقة المالك. لا تُطبَّق قبلها. (المشروع cnmggdrlkgsyrjxmvydv)
--
-- ربط البايكر بحسابه: app_users.biker_employee_id = رقم سويتر = employees.employee_id
-- (هو نفس ربط بوابة البايكر و my_biker_id() الموجودة). employees.user_id فارغ في القاعدة فلا يُعتمد عليه.
-- صلاحية المشرف: field_rounds (الجولات الميدانية) — قراءة للمتابعة، وتعديل (can_edit) لإدراج تقييم عملي.
--   ومن له employees يقرأ المتابعة أيضاً. has_perm تُرجع true للمالك تلقائياً.
-- لا سياسات update/delete على المحاولات والتقييمات ⇒ ممنوعة من الواجهة.

-- ── الجداول (كما في الأمر حرفياً) ──
create table public.training_attempts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  module text not null,              -- towels|products|tools|interior|exterior|day|quality|final|daily
  pct int not null, pass boolean not null,
  mistakes jsonb not null default '[]',
  created_at timestamptz not null default now());
create index on public.training_attempts (employee_id, module, created_at desc);

create table public.training_practicals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind text not null check (kind in ('interior','exterior')),
  mode text not null check (mode in ('self','sup')),
  evaluator_id uuid, evaluator_name text,
  pct int, pass boolean, minutes int, secs int,
  marks jsonb, rules jsonb, note text,
  created_at timestamptz not null default now());
create index on public.training_practicals (employee_id, kind, created_at desc);

create table public.training_videos (
  key text primary key check (key in ('interior','exterior1','exterior2')),
  storage_path text not null, size_bytes bigint, uploaded_by uuid,
  uploaded_at timestamptz not null default now());

-- ── مساعد: معرّف موظف البايكر الحالي (uuid) من رقم سويتر ──
create or replace function public.my_employee_uuid()
returns uuid language sql stable security definer set search_path to 'public' as $$
  select e.id from public.employees e where e.employee_id = public.my_biker_id() limit 1
$$;
revoke all on function public.my_employee_uuid() from public, anon;
grant execute on function public.my_employee_uuid() to authenticated;

-- ── RLS ──
alter table public.training_attempts   enable row level security;
alter table public.training_practicals enable row level security;
alter table public.training_videos     enable row level security;

-- المحاولات: البايكر يقرأ ويُدرج صفوفه فقط؛ المالك والمشرف يقرؤون الكل
create policy p_tatt_sel on public.training_attempts for select to authenticated
  using (employee_id = public.my_employee_uuid() or public.has_perm('field_rounds') or public.has_perm('employees'));
create policy p_tatt_ins on public.training_attempts for insert to authenticated
  with check (employee_id = public.my_employee_uuid());

-- العملي: البايكر يقرأ صفوفه ويُدرج self لنفسه؛ sup للمالك/المشرف فقط وباسمه، ولا يقيّم المشرف نفسه
create policy p_tprac_sel on public.training_practicals for select to authenticated
  using (employee_id = public.my_employee_uuid() or public.has_perm('field_rounds') or public.has_perm('employees'));
create policy p_tprac_ins_self on public.training_practicals for insert to authenticated
  with check (mode = 'self' and employee_id = public.my_employee_uuid());
create policy p_tprac_ins_sup on public.training_practicals for insert to authenticated
  with check (mode = 'sup' and evaluator_id = auth.uid()
    and public.has_perm('field_rounds', true)
    and employee_id is distinct from public.my_employee_uuid());

-- الفيديو: قراءة لكل مسجَّل؛ كتابة (إدراج/استبدال) للمالك
create policy p_tvid_sel on public.training_videos for select to authenticated using (true);
create policy p_tvid_ins on public.training_videos for insert to authenticated with check (public.is_owner());
create policy p_tvid_upd on public.training_videos for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- ── التخزين: bucket خاص training (حد 100 ميجا للملف، فيديو فقط) ──
-- الحد العام للمشروع يسمح بـ100 ميجا على الأقل (bucket applicant-videos مضبوط على 104857600).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('training', 'training', false, 104857600, array['video/mp4','video/quicktime','video/webm','video/x-m4v'])
on conflict (id) do nothing;

create policy p_training_read on storage.objects for select to authenticated
  using (bucket_id = 'training');
create policy p_training_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'training' and public.is_owner());
create policy p_training_upd on storage.objects for update to authenticated
  using (bucket_id = 'training' and public.is_owner()) with check (bucket_id = 'training' and public.is_owner());
