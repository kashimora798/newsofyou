-- ============================================================================
-- Storage-only Supabase project setup  (https://kejfqjqreaqtyummufiu.supabase.co)
--
-- Run this ONCE in that project's SQL Editor. It is NOT a migration for the main
-- project — keep it out of supabase/migrations.
--
-- Creates the same two bucket names the app already uses, so file paths are
-- identical to the old project:
--   chat-images : photos, stickers, avatars, wallpapers, voice notes, audio, video
--   documents   : any other file type
--
-- Safe to re-run.
-- ============================================================================

-- 1) Buckets -----------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'chat-images', 'chat-images', true,
    26214400,  -- 25 MB per file
    array[
      'image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/avif',
      'image/heic', 'image/heif',
      'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav', 'audio/x-m4a',
      'video/mp4', 'video/webm', 'video/quicktime'
    ]
  ),
  (
    'documents', 'documents', true,
    20971520,  -- 20 MB per file
    null       -- any file type
  )
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) Access policies ---------------------------------------------------------
-- The app logs users in on the MAIN project, so on this project every request
-- arrives as the `anon` role. Public buckets already serve files by URL without
-- a policy; the only thing needed is permission to upload (INSERT).
--
-- Deliberately NOT granted: UPDATE / DELETE / listing. Files can be added but not
-- overwritten or removed with the publishable key. Clean up from the dashboard
-- or with the service-role key.

drop policy if exists "chat media: anyone can upload" on storage.objects;
create policy "chat media: anyone can upload"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id in ('chat-images', 'documents'));

-- 3) Quick check -------------------------------------------------------------
-- select id, public, file_size_limit from storage.buckets;
