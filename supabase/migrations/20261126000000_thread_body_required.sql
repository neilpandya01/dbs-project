-- Wingmates: every thread needs a description. Run once in Supabase -> SQL Editor.
-- The app asks for at least 10 characters; this makes the database enforce it too, so nothing can post a thread
-- with an empty description. (Threads that already exist are not touched: the check only applies to new ones.)
alter table public.reports drop constraint if exists reports_body_required;
alter table public.reports add constraint reports_body_required check (char_length(btrim(body)) >= 10) not valid;
