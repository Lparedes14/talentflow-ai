# TalentFlow AI — backend restore runbook

## What actually happened

**Your application code is intact.** Nothing was deleted from the repository — git
history shows no removed source files. What is missing is the **Supabase project
itself**: the Postgres database, the storage buckets, and the auth users.

The schema was never in this repo. It was created by hand in the Supabase
dashboard, so when the project went away it took the only copy of the schema with
it. The files in this folder are that schema, **reconstructed from the code** — every
table, column, constraint and foreign key below is required by at least one query
in `src/`.

---

## Files

| File | What it does |
|---|---|
| `migrations/0001_schema.sql` | 20 tables, constraints, indexes, `updated_at` triggers |
| `migrations/0002_auth_trigger.sql` | Creates a `profiles` row automatically on signup |
| `migrations/0003_rls.sql` | Row Level Security policies |
| `migrations/0004_storage.sql` | The 5 storage buckets and their access policies |
| `seed.sql` | 42 skills, 6 open positions, 10 assessments, 10 courses |

All five are **idempotent** — safe to run more than once, and re-running `seed.sql`
does not duplicate rows. They were verified end-to-end against PostgreSQL 16.

---

## Restore, step by step

### 1. Create a new Supabase project

<https://supabase.com/dashboard> → **New project**. Save the database password
somewhere you will not lose it. Wait for provisioning to finish.

### 2. Run the migrations

Dashboard → **SQL Editor** → **New query**. Paste and run each file **in order**:

```
0001_schema.sql  →  0002_auth_trigger.sql  →  0003_rls.sql  →  0004_storage.sql
```

Then run `seed.sql`.

> Prefer the CLI? `npx supabase link --project-ref <ref>` then
> `npx supabase db push`, followed by `npx supabase db execute -f supabase/seed.sql`.
> The dashboard route is fine and needs no extra tooling.

### 3. Wire up the environment

```bash
cp .env.local.example .env.local
```

Fill in from **Project Settings → Data API** (URL, anon key) and
**Project Settings → API Keys** (service_role). Add your `OPENAI_API_KEY`.

Restart the dev server afterwards — Next.js reads env vars at boot:

```bash
npm run dev
```

### 4. Turn off email confirmation (for local development)

**Authentication → Sign In / Providers → Email → Confirm email: off.**

The register page shows "check your email to verify" and redirects to `/login`.
With confirmation on and no SMTP configured, nobody can actually log in.

### 5. Create your first accounts

Register through the app at `/register`. The trigger from `0002` creates the
matching `profiles` row.

To make yourself an HR admin, run this in the SQL Editor afterwards:

```sql
update public.profiles set role = 'hr_admin' where email = 'you@example.com';
```

### 6. Verify

```sql
-- expect: 42 skills, 6 jobs, 10 assessments, 10 courses
select 'skills', count(*) from skills_taxonomy
union all select 'jobs', count(*) from job_postings
union all select 'assessments', count(*) from assessments
union all select 'courses', count(*) from courses;

-- expect: one row per registered user
select email, full_name, role from profiles;

-- expect: 5 buckets
select id, public from storage.buckets;
```

Then walk the app: log in → `/profile` (upload a résumé, skills should populate) →
`/jobs` (run the AI match) → `/skills` (take an assessment) → `/learning`.

---

## Schema → code map

| Table | Written by | Read by |
|---|---|---|
| `profiles` | `0002` trigger, `/api/upload`, `/api/ai/extract-skills` | login, profile, HR applicants, every AI route |
| `skills_taxonomy` | `/api/ai/extract-skills`, `extract-cert-skills`, `analyze-video` | profile, jobs, skills, recommenders |
| `user_skills` | the three extraction routes, `/skills` on a passed assessment | profile, jobs, match-jobs, both recommenders |
| `certifications` | profile page | profile page |
| `career_interests` | profile page | match-jobs, both recommenders |
| `extracted_keywords` | `extract-skills`, `analyze-video` | profile page |
| `work_mode_preferences`, `location_wishlist` | profile page | profile page |
| `job_postings` | seed / HR (manual) | jobs, HR positions, match-jobs, generate-plan |
| `job_required_skills` | seed | match-jobs, jobs page, recommenders |
| `job_matches` | `/api/ai/match-jobs` | jobs page, profile stats, recommend-courses |
| `job_applications` | *(not yet written by any route)* | profile page |
| `assessments`, `user_assessments` | seed / `/skills` page | skills page, recommend-assessments |
| `courses`, `course_skills`, `user_courses` | seed / `/skills` page | skills page |
| `upskilling_plans` | `/api/ai/generate-plan` | *(not yet read back)* |
| `audit_logs` | match-jobs, both recommenders | *(service role only)* |
| `fairness_audits` | *(unused — declared in `types/index.ts`)* | — |

### Storage buckets

`resumes`, `videos`, `avatars`, `photos`, `certifications` — all public, because
the app stores `getPublicUrl()` output in `profiles` and renders it directly.
Writes are scoped to a folder named after the uploader's user id, which matches
every upload path in the code.

---

## Bugs found while reconstructing this

These were already in the code — they are not caused by the restore. Worth fixing
before the demo:

1. **`avatars` vs `photos`.** `src/app/api/upload/route.ts` uploads profile photos
   to `photos`; `src/app/(dashboard)/profile/page.tsx` uploads them to `avatars`.
   Both buckets are created so neither path breaks, but pick one and delete the other.

2. **`candidate` is not a valid role.** The register page sends
   `'candidate' | 'recruiter'`, while `src/types/index.ts` and the login redirect
   only know `'employee' | 'recruiter' | 'hr_admin'`. The `0002` trigger maps
   `candidate → employee` so signup cannot fail the CHECK constraint. Cleaner fix:
   change the register form to send `employee`.

3. **No auth middleware.** `src/lib/supabase/middleware.ts` is empty and there is no
   root `middleware.ts`, so dashboard and `/hr` routes are not protected server-side —
   each page checks the session client-side after render. Fine for a demo, worth
   noting in the report.

4. **Empty stub files.** `hooks/useAuth.ts`, `hooks/useJobs.ts`, `hooks/useProfile.ts`,
   `components/layout/Sidebar.tsx`, `components/hr/*.tsx`, `components/jobs/SkillMatch.tsx`
   are all 0 bytes and have been since the initial commit. Nothing was lost — they
   were never written.

5. **`job_applications` is never written.** The profile page reads and displays
   applications, but no code path creates one. The "apply" flow is not built yet.

---

## Do not let this happen again

The root cause was schema-only-in-the-dashboard. Now that migrations live in the
repo, keep them there:

- **Any schema change gets a new numbered file here**, committed with the code that
  needs it. Never change a table only in the dashboard.
- **Enable Point-in-Time Recovery** (Project Settings → Database) if your plan
  offers it. Free-tier projects also **pause after inactivity** and can be deleted
  after a long enough pause — that alone may explain what happened here.
- **Dump before risky work**: `npx supabase db dump -f backup.sql --data-only`.
