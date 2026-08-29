-- ============================================================
-- TalentFlow AI — 0003: Row Level Security
--
-- Two kinds of client hit this database:
--   * the browser client (anon key + the user's session) — used by
--     the login/profile/jobs/skills pages and the HR pages. RLS APPLIES.
--   * the service-role client in src/app/api/** — RLS is BYPASSED, which
--     is why the AI routes can write skills_taxonomy, job_matches and
--     audit_logs without any policy below.
--
-- Rule of thumb: rows keyed by profile_id are private to that user;
-- catalog tables (skills, jobs, courses, assessments) are readable by
-- any signed-in user; audit tables are service-role only.
-- ============================================================

-- ------------------------------------------------------------
-- Enable RLS everywhere
-- ------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.skills_taxonomy       enable row level security;
alter table public.user_skills           enable row level security;
alter table public.certifications        enable row level security;
alter table public.career_interests      enable row level security;
alter table public.extracted_keywords    enable row level security;
alter table public.work_mode_preferences enable row level security;
alter table public.location_wishlist     enable row level security;
alter table public.job_postings          enable row level security;
alter table public.job_required_skills   enable row level security;
alter table public.job_matches           enable row level security;
alter table public.job_applications      enable row level security;
alter table public.assessments           enable row level security;
alter table public.user_assessments      enable row level security;
alter table public.courses               enable row level security;
alter table public.course_skills         enable row level security;
alter table public.user_courses          enable row level security;
alter table public.upskilling_plans      enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.fairness_audits       enable row level security;

-- ------------------------------------------------------------
-- profiles
-- Any signed-in user can read all profiles: the HR pages
-- (src/app/hr/applicants) list every employee through the browser
-- client. Writes are restricted to your own row.
-- ------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ------------------------------------------------------------
-- Catalog tables: read-only for signed-in users.
-- Rows are created by the AI routes (service role) or by seed.sql.
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'skills_taxonomy',
    'job_postings',
    'job_required_skills',
    'assessments',
    'courses',
    'course_skills'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (true)', t, t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Per-user tables: full CRUD on your own rows only.
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'user_skills',
    'certifications',
    'career_interests',
    'extracted_keywords',
    'work_mode_preferences',
    'location_wishlist',
    'job_matches',
    'job_applications',
    'user_assessments',
    'user_courses',
    'upskilling_plans'
  ]
  loop
    execute format('drop policy if exists %I_own on public.%I', t, t);
    execute format(
      'create policy %I_own on public.%I for all to authenticated '
      'using (profile_id = (select auth.uid())) '
      'with check (profile_id = (select auth.uid()))', t, t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- audit_logs and fairness_audits: RLS on, no policies.
-- Only the service-role key can read or write them, which is exactly
-- how the AI routes use them. Do not add an anon policy here — the
-- audit trail is what backs the fairness claims in the report.
-- ------------------------------------------------------------
