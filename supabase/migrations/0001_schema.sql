-- ============================================================
-- TalentFlow AI — 0001: core schema
-- Reconstructed from the application code (src/**). Every table,
-- column, constraint and foreign key below is required by at least
-- one query in the app; see supabase/README.md for the mapping.
-- ============================================================

-- ---------- helper: keep updated_at fresh ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- profiles  (1:1 with auth.users)
-- ============================================================
create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text not null,
  full_name          text not null default '',
  role               text not null default 'employee'
                       check (role in ('employee', 'recruiter', 'hr_admin')),
  job_title          text,
  department         text,
  years_in_role      integer not null default 0,
  avatar_url         text,
  video_url          text,
  video_duration     text,
  resume_url         text,
  resume_filename    text,
  profile_strength   integer not null default 0 check (profile_strength between 0 and 100),
  open_to_relocation boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- skills_taxonomy  (master skill list)
-- ============================================================
create table if not exists public.skills_taxonomy (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'technical'
                check (category in ('technical', 'soft', 'process', 'domain')),
  description text,
  created_at  timestamptz not null default now()
);

-- The AI routes look skills up with .ilike('name', ...) and rely on a
-- duplicate INSERT failing so they can fall back to the existing row.
-- That behaviour requires a case-insensitive unique index on name.
create unique index if not exists skills_taxonomy_name_lower_idx
  on public.skills_taxonomy (lower(name));

-- ============================================================
-- user_skills
-- ============================================================
create table if not exists public.user_skills (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  skill_id         uuid not null references public.skills_taxonomy(id) on delete cascade,
  verified         boolean not null default false,
  source           text,          -- 'resume' | 'video' | 'certification' | 'assessment' | 'manual'
  confidence_score numeric(4,3),  -- 0.000 .. 1.000
  created_at       timestamptz not null default now(),
  -- required by .upsert(..., { onConflict: 'profile_id,skill_id' })
  unique (profile_id, skill_id)
);

create index if not exists user_skills_profile_idx on public.user_skills (profile_id);
create index if not exists user_skills_source_idx  on public.user_skills (profile_id, source);

-- ============================================================
-- certifications
-- ============================================================
create table if not exists public.certifications (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  name           text not null,
  issuer         text not null,
  issued_date    date,
  expiry_date    date,
  credential_id  text,
  credential_url text,
  created_at     timestamptz not null default now()
);

create index if not exists certifications_profile_idx on public.certifications (profile_id);

-- ============================================================
-- career_interests / extracted_keywords / preferences
-- ============================================================
create table if not exists public.career_interests (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest   text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, interest)
);

create table if not exists public.extracted_keywords (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  keyword    text not null,
  source     text,   -- 'resume' | 'video'
  created_at timestamptz not null default now()
);

create index if not exists extracted_keywords_profile_idx
  on public.extracted_keywords (profile_id, source);

create table if not exists public.work_mode_preferences (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  work_mode  text not null check (work_mode in ('remote', 'hybrid', 'onsite')),
  unique (profile_id, work_mode)
);

create table if not exists public.location_wishlist (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  location   text not null,
  unique (profile_id, location)
);

-- ============================================================
-- job_postings + required skills
-- ============================================================
create table if not exists public.job_postings (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text,
  department        text not null default '',
  team              text,
  location          text not null default '',
  work_mode         text not null default 'hybrid'
                      check (work_mode in ('remote', 'hybrid', 'onsite')),
  status            text not null default 'open'
                      check (status in ('draft', 'open', 'closed', 'filled')),
  urgency           text,
  hiring_manager_id uuid references public.profiles(id) on delete set null,
  salary_min        integer,
  salary_max        integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists job_postings_status_idx on public.job_postings (status);

drop trigger if exists job_postings_set_updated_at on public.job_postings;
create trigger job_postings_set_updated_at
  before update on public.job_postings
  for each row execute function public.set_updated_at();

create table if not exists public.job_required_skills (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.job_postings(id) on delete cascade,
  skill_id    uuid not null references public.skills_taxonomy(id) on delete cascade,
  is_required boolean not null default true,
  unique (job_id, skill_id)
);

create index if not exists job_required_skills_job_idx on public.job_required_skills (job_id);

-- ============================================================
-- job_matches  (written by /api/ai/match-jobs)
-- ============================================================
create table if not exists public.job_matches (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  job_id           uuid not null references public.job_postings(id) on delete cascade,
  match_score      integer not null default 0,
  match_type       text,   -- 'best_match' | 'career_switch' | 'stretch'
  explanation      text,
  insight          text,
  skills_matched   integer not null default 0,
  skills_total     integer not null default 0,
  fairness_checked boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists job_matches_profile_idx on public.job_matches (profile_id, match_score desc);
create index if not exists job_matches_job_idx     on public.job_matches (job_id);

-- ============================================================
-- job_applications
-- ============================================================
create table if not exists public.job_applications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  job_id     uuid not null references public.job_postings(id) on delete cascade,
  status     text not null default 'applied'
               check (status in ('applied', 'under_review', 'interview', 'offer', 'rejected', 'withdrawn')),
  notes      text,
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, job_id)
);

drop trigger if exists job_applications_set_updated_at on public.job_applications;
create trigger job_applications_set_updated_at
  before update on public.job_applications
  for each row execute function public.set_updated_at();

-- ============================================================
-- assessments
-- ============================================================
create table if not exists public.assessments (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  skill_id         uuid references public.skills_taxonomy(id) on delete set null,
  duration_minutes integer not null default 15,
  passing_score    integer not null default 70,
  difficulty       text default 'intermediate'
                     check (difficulty in ('beginner', 'intermediate', 'advanced')),
  created_at       timestamptz not null default now()
);

create table if not exists public.user_assessments (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  status        text not null default 'not_started'
                  check (status in ('not_started', 'in_progress', 'completed')),
  score         integer,
  started_at    timestamptz,
  completed_at  timestamptz,
  -- required by .upsert(..., { onConflict: 'profile_id,assessment_id' })
  unique (profile_id, assessment_id)
);

create index if not exists user_assessments_profile_idx on public.user_assessments (profile_id);

-- ============================================================
-- courses
-- ============================================================
create table if not exists public.courses (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  provider       text not null default '',
  url            text,
  description    text,
  duration_hours integer,
  level          text,
  rating         numeric(2,1),
  cost           numeric(10,2) default 0,
  enrolled_count integer not null default 0,
  created_at     timestamptz not null default now()
);

-- Join table. Only visible in the nested select on the /skills page:
--   courses -> course_skills ( skills_taxonomy (name) )
create table if not exists public.course_skills (
  id        uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  skill_id  uuid not null references public.skills_taxonomy(id) on delete cascade,
  unique (course_id, skill_id)
);

create table if not exists public.user_courses (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  progress     integer not null default 0 check (progress between 0 and 100),
  enrolled_at  timestamptz not null default now(),
  completed_at timestamptz,
  unique (profile_id, course_id)
);

create index if not exists user_courses_profile_idx on public.user_courses (profile_id);

-- ============================================================
-- upskilling_plans  (written by /api/ai/generate-plan)
-- ============================================================
create table if not exists public.upskilling_plans (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  target_job_id   uuid references public.job_postings(id) on delete set null,
  plan_data       jsonb not null default '{}'::jsonb,
  estimated_weeks integer not null default 0,
  estimated_cost  numeric(10,2) not null default 0,
  explanation     text,
  created_at      timestamptz not null default now()
);

create index if not exists upskilling_plans_profile_idx on public.upskilling_plans (profile_id);

-- ============================================================
-- audit_logs  (service-role only; written by the AI routes)
-- ============================================================
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  entity_type text,
  entity_id   uuid,
  actor_id    uuid references public.profiles(id) on delete set null,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- ============================================================
-- fairness_audits
-- Declared in src/types/index.ts but not yet queried by any route.
-- Included so the fairness feature has a home when you build it.
-- ============================================================
create table if not exists public.fairness_audits (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.job_postings(id) on delete cascade,
  audit_date timestamptz not null default now(),
  metrics    jsonb not null default '{}'::jsonb,
  passed     boolean not null default false,
  notes      text
);
