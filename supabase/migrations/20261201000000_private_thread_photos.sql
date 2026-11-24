-- Wingmates: thread and comment photos are private. Run once in Supabase -> SQL Editor.
--
-- Before: the "thread-images" bucket was public, so anyone holding a photo's exact link could open it, even a photo from a
-- friends-only thread, and even after losing access. Now:
--   * the bucket is private (the old public links stop working)
--   * a signed-in person can read a photo only if it is in their own folder, or attached to a thread / comment they are
--     allowed to see (so a friends-only thread's photos, and the photos on its comments, stay inside that circle)
--   * the app asks for a short-lived signed link for each photo it shows (see lib/useImageUrls.ts)
-- Uploading and deleting still work only in your own folder.

update storage.buckets set public = false where id = 'thread-images';

-- indexes so "is this photo attached to something I can see?" is quick
create index if not exists reports_images_gin on public.reports using gin (images);
create index if not exists report_comments_images_gin on public.report_comments using gin (images);

-- the subqueries below run as the person asking, so row-level security on threads and comments decides what counts as "visible"
drop policy if exists "thread images: read" on storage.objects;
create policy "thread images: read" on storage.objects for select to authenticated
  using (
    bucket_id = 'thread-images'
    and (
      (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
      or exists (select 1 from public.reports r where r.images @> array[storage.objects.name])
      or exists (select 1 from public.report_comments c where c.images @> array[storage.objects.name])
    )
  );

-- To undo: update storage.buckets set public = true where id = 'thread-images';
--          and re-create the earlier "thread images: read" policy (any signed-in user, whole bucket).
