-- ═══ تحقق المرحلة 1 قبل التطبيق — يتراجع تلقائياً، لا يغيّر شيئاً ═══
-- يُشغَّل من محرر SQL في لوحة Supabase. ينفّذ تغييرات close_anon_1.sql داخل كتلة واحدة،
-- ويختبر بدور anon وبأدوار مستخدمين حقيقيين، ثم يرمي استثناءً متعمَّداً فيتراجع كل شيء.
-- النتيجة تظهر في رسالة الخطأ: «ROLLBACK-REPORT …» سطراً سطراً (BEFORE ثم AFTER).
-- إن ظهر «lock timeout» فالجدول مشغول لحظتها: أعد التشغيل بعد قليل (لا يُحجَز أي جدول أكثر من 5 ثوانٍ).

do $$
declare
  out text := ''; n bigint; r text; u jsonb; x jsonb; ph text;
  users jsonb := '[
    ["anon",null],
    ["owner","edb2398b-4ce6-4dc2-9dcb-66c5c8b3ee25"],
    ["salman_sup","bee7ce70-cb5a-4e29-b355-5bd122b6d039"],
    ["omar_recruit","8d523107-4f53-4da9-81b8-e8515052fd69"],
    ["elham_reports","6bd4bc5f-0dab-4ddb-a5ae-f5dc5b61c16e"],
    ["abed_biker","4e25a45e-2ec2-4427-b1f7-94255397ed39"]]';
  tests jsonb := '[
    ["anon","q","employees SELECT","select count(*) from public.employees"],
    ["anon","d","employees UPDATE","update public.employees set full_name=full_name"],
    ["anon","d","employees INSERT","insert into public.employees(full_name) values (''zz_test'')"],
    ["anon","q","notifications SELECT","select count(*) from public.notifications"],
    ["anon","d","notifications UPDATE","update public.notifications set title=title"],
    ["anon","d","notifications INSERT","insert into public.notifications(title) values (''zz_test'')"],
    ["anon","q","admin_sessions SELECT","select count(*) from public.admin_sessions"],
    ["anon","d","admin_sessions UPDATE","update public.admin_sessions set token=token"],
    ["anon","d","admin_sessions INSERT","insert into public.admin_sessions(token) values (''zz_test'')"],
    ["anon","q","page_visits SELECT","select count(*) from public.page_visits"],
    ["anon","d","page_visits INSERT","insert into public.page_visits(page,step,session_id) values (''zz_test'',''zz_test'',''zz_test'')"],
    ["*","q","employees SELECT","select count(*) from public.employees"],
    ["*","d","employees UPDATE","update public.employees set full_name=full_name"],
    ["*","q","notifications SELECT","select count(*) from public.notifications"],
    ["*","q","notification_reads SELECT","select count(*) from public.notification_reads"],
    ["*","q","page_visits SELECT","select count(*) from public.page_visits"]]';
begin
  perform set_config('lock_timeout', '5s', true);
  foreach ph in array array['BEFORE','AFTER'] loop
    if ph = 'AFTER' then
      -- نفس تغييرات close_anon_1.sql
      drop policy if exists emp_anon_select on public.employees;
      drop policy if exists emp_anon_update on public.employees;
      drop policy if exists emp_anon_insert on public.employees;
      revoke all on public.employees from anon;
      drop policy if exists allow_all_anon on public.notifications;
      revoke all on public.notifications from anon;
      drop policy if exists anon_admin on public.admin_sessions;
      revoke all on public.admin_sessions from anon;
      drop policy if exists allow_public_read_visits on public.page_visits;
      revoke select, update, delete, truncate, references, trigger on public.page_visits from anon;
      drop policy if exists visits_auth_select on public.page_visits;
      create policy visits_auth_select on public.page_visits for select to authenticated
        using (has_perm('reports') or has_perm('applicants'));
    end if;
    out := out || E'\n== ' || ph;
    for u in select * from jsonb_array_elements(users) loop
      for x in select * from jsonb_array_elements(tests) loop
        if not ((x->>0) = (u->>0) or ((x->>0) = '*' and (u->>0) <> 'anon')) then continue; end if;
        begin
          if (u->>0) = 'anon' then
            perform set_config('request.jwt.claims', '{"role":"anon"}', true);
            execute 'set local role anon';
          else
            perform set_config('request.jwt.claims', json_build_object('sub', u->>1, 'role', 'authenticated')::text, true);
            perform set_config('request.jwt.claim.sub', u->>1, true);
            execute 'set local role authenticated';
          end if;
          if (x->>1) = 'q' then execute x->>3 into n; r := n::text || ' rows';
          else execute x->>3; get diagnostics n = row_count; r := n::text || ' affected'; end if;
          execute 'reset role';
        exception when others then r := 'DENIED (' || sqlstate || ')';
        end;
        out := out || E'\n' || (u->>0) || ' | ' || (x->>2) || ' | ' || r;
      end loop;
    end loop;
  end loop;
  raise exception 'ROLLBACK-REPORT%', out;   -- متعمَّد: يتراجع عن كل ما سبق
end $$;

-- المتوقع في AFTER:
--   anon: كل employees/notifications/admin_sessions ⇒ DENIED (42501)، page_visits SELECT ⇒ DENIED، page_visits INSERT ⇒ 1 affected
--   owner/omar: الموظفون كما في BEFORE، page_visits كما في BEFORE
--   salman/elham/abed: notifications تنخفض من الكل إلى ما يخصّهم (notif_read)، الباقي كما في BEFORE
