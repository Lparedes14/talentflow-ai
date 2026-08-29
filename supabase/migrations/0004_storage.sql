-- ============================================================
-- TalentFlow AI — 0004: storage buckets
--
-- Buckets referenced in the code:
--   resumes        src/app/(dashboard)/profile/page.tsx, /api/upload
--   videos         profile page (upload + in-browser recording), /api/upload
--   avatars        profile page  <-- browser client uses this name
--   photos         /api/upload    <-- the API route uses THIS name instead
--   certifications profile page (credential file for a certification)
--
-- ⚠ avatars vs photos is a real bug, not a transcription slip:
--   src/app/api/upload/route.ts picks the bucket with
--     type === 'video' ? 'videos' : type === 'photo' ? 'photos' : 'resumes'
--   while src/app/(dashboard)/profile/page.tsx uploads straight to
--   'avatars'. Both buckets are created here so neither path 404s.
--   Pick one name in the code and delete the other bucket.
--
-- Every bucket is public because the app stores the result of
-- getPublicUrl() in profiles.avatar_url / video_url / resume_url and
-- renders it directly. Anyone with the URL can read the file — fine for
-- the course demo, worth revisiting before real candidate data.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('resumes',        'resumes',        true,  10485760),   --  10 MB
  ('videos',         'videos',         true, 104857600),   -- 100 MB
  ('avatars',        'avatars',        true,   5242880),   --   5 MB
  ('photos',         'photos',         true,   5242880),   --   5 MB
  ('certifications', 'certifications', true,  10485760)    --  10 MB
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- ------------------------------------------------------------
-- Policies
--
-- Reads are public (the app hands out public URLs).
-- Writes are limited to a folder named after the uploader's user id —
-- every upload path in the code already starts with it:
--   `${userId}/${type}/${timestamp}.${ext}`   (api/upload)
--   `${profileId}/cert_${Date.now()}.${ext}`  (certifications)
-- ------------------------------------------------------------
do $$
declare b text;
begin
  foreach b in array array['resumes', 'videos', 'avatars', 'photos', 'certifications']
  loop
    execute format('drop policy if exists %I on storage.objects', b || '_public_read');
    execute format($p$
      create policy %I on storage.objects
        for select to public
        using (bucket_id = %L)
    $p$, b || '_public_read', b);

    execute format('drop policy if exists %I on storage.objects', b || '_own_write');
    execute format($p$
      create policy %I on storage.objects
        for insert to authenticated
        with check (
          bucket_id = %L
          and (storage.foldername(name))[1] = (select auth.uid())::text
        )
    $p$, b || '_own_write', b);

    execute format('drop policy if exists %I on storage.objects', b || '_own_update');
    execute format($p$
      create policy %I on storage.objects
        for update to authenticated
        using (
          bucket_id = %L
          and (storage.foldername(name))[1] = (select auth.uid())::text
        )
    $p$, b || '_own_update', b);

    execute format('drop policy if exists %I on storage.objects', b || '_own_delete');
    execute format($p$
      create policy %I on storage.objects
        for delete to authenticated
        using (
          bucket_id = %L
          and (storage.foldername(name))[1] = (select auth.uid())::text
        )
    $p$, b || '_own_delete', b);
  end loop;
end;
$$;
