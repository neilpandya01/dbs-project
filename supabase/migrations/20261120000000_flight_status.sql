-- Wingmates: mark a flight as delayed or cancelled. Run once in Supabase -> SQL Editor.
--
-- null = flew as planned. 'delayed' still counts everywhere. 'cancelled' is kept only as a record:
-- the app leaves cancelled flights out of stats, the map and history, but you can still search them.
alter table public.flights
  add column if not exists status text;

alter table public.flights drop constraint if exists flights_status_valid;
alter table public.flights
  add constraint flights_status_valid check (status is null or status in ('delayed', 'cancelled'));
