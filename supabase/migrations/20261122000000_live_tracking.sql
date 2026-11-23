-- Wingmates: live flight tracking. Run once in Supabase -> SQL Editor.
--
--   live_watchers   who has the map open right now (a heartbeat every ~30 s). The worker only tracks flights
--                   that someone is watching: the watcher's own flights and their accepted friends' flights.
--   live_positions  the latest position of each tracked flight, plus the worker's stage for it
--                   (waiting -> airborne -> landed). Friends can read a position only while the flight is
--                   airborne and not hidden. Only the worker (service key) can write.
--   live_run_lock   makes sure two worker runs never overlap.
-- Turn on Realtime for live_positions (done at the bottom) so the map moves without reloading.

-- ---- who is watching -----------------------------------------------------------------------------
create table if not exists public.live_watchers (
  user_id text primary key,
  seen_at timestamptz not null default now()
);
alter table public.live_watchers enable row level security;
revoke all on public.live_watchers from anon, authenticated;

create or replace function public.live_heartbeat() returns void
language sql security definer set search_path = '' as $$
  insert into public.live_watchers (user_id, seen_at)
  select auth.jwt() ->> 'sub', now() where auth.jwt() ->> 'sub' is not null
  on conflict (user_id) do update set seen_at = now();
$$;
revoke all on function public.live_heartbeat() from public, anon;
grant execute on function public.live_heartbeat() to authenticated;

-- ---- positions -----------------------------------------------------------------------------------
create table if not exists public.live_positions (
  flight_id   uuid primary key references public.flights (id) on delete cascade,
  user_id     text not null,
  stage       text not null default 'waiting' check (stage in ('waiting', 'airborne', 'landed')),
  hex         text,                       -- the aircraft's transponder id, learned on first match
  lat         double precision,
  lon         double precision,
  alt_ft      integer,
  speed_kt    integer,
  track_deg   integer,
  on_ground   boolean not null default false,
  takeoff_at  timestamptz,
  seen_at     timestamptz,                -- when the aircraft was last found
  polled_at   timestamptz,                -- when we last asked
  updated_at  timestamptz not null default now()
);
create index if not exists live_positions_stage on public.live_positions (stage);

alter table public.live_positions enable row level security;
revoke all on public.live_positions from anon, authenticated;
grant select on public.live_positions to authenticated;

drop policy if exists "see live positions of me and my friends" on public.live_positions;
create policy "see live positions of me and my friends" on public.live_positions
  for select to authenticated
  using (
    stage = 'airborne'
    and exists (
      select 1 from public.flights f
      where f.id = live_positions.flight_id
        and (f.user_id = (select auth.jwt() ->> 'sub') or (not f.hidden and public.is_friend(f.user_id)))
    )
  );

-- ---- run lock ------------------------------------------------------------------------------------
create table if not exists public.live_run_lock (
  id           int primary key default 1 check (id = 1),
  locked_until timestamptz not null default now()
);
insert into public.live_run_lock (id) values (1) on conflict do nothing;
alter table public.live_run_lock enable row level security;
revoke all on public.live_run_lock from anon, authenticated;

-- true = you got the lock for p_seconds; false = another run is still going
create or replace function public.live_claim_run(p_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare got int;
begin
  update public.live_run_lock set locked_until = now() + make_interval(secs => p_seconds)
   where id = 1 and locked_until <= now();
  get diagnostics got = row_count;
  return got > 0;
end $$;
revoke all on function public.live_claim_run(int) from public, anon, authenticated;
grant execute on function public.live_claim_run(int) to service_role;

-- ---- realtime ------------------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'live_positions') then
    alter publication supabase_realtime add table public.live_positions;
  end if;
end $$;

-- To undo:
--   drop table public.live_positions, public.live_watchers, public.live_run_lock;
--   drop function public.live_heartbeat(), public.live_claim_run(int);
