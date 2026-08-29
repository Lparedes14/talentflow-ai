-- ============================================================
-- TalentFlow AI — 0002: auto-create a profile on signup
--
-- src/app/(auth)/register/page.tsx only calls supabase.auth.signUp()
-- and passes { full_name, role } as user metadata. It never inserts
-- into public.profiles. Without this trigger every new account logs in
-- with no profile row, and the app breaks immediately: login reads
-- profiles.role to decide where to redirect, and every other page
-- queries by profile_id.
--
-- NOTE ON ROLES: the register form sends 'candidate' or 'recruiter',
-- but src/types/index.ts and the login redirect only know
-- 'employee' | 'recruiter' | 'hr_admin'. We map 'candidate' ->
-- 'employee' here so signup cannot violate the CHECK constraint.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
begin
  meta_role := coalesce(new.raw_user_meta_data ->> 'role', 'employee');

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case
      when meta_role in ('recruiter', 'hr_admin') then meta_role
      else 'employee'   -- covers 'candidate' and anything unexpected
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Backfill: create profiles for any auth users that already exist
-- (useful if you restore auth before running this migration).
-- ------------------------------------------------------------
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  case
    when coalesce(u.raw_user_meta_data ->> 'role', '') in ('recruiter', 'hr_admin')
      then u.raw_user_meta_data ->> 'role'
    else 'employee'
  end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
