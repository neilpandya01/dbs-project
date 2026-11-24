-- Wingmates: friends can now see a plane at the departure airport and at the arrival airport, not only in the air.
-- Run once in Supabase -> SQL Editor.
--
-- Before: a live_positions row was readable only while its stage was 'airborne'.
-- Now:    the owner and their accepted friends can read it in any stage (waiting = at/just off the departure airport,
--         airborne, landed = on the ground at the arrival airport). Hidden flights are still never readable by friends
--         (and never tracked). The app decides what to draw: only fresh positions, and only near the right airport.
drop policy if exists "see live positions of me and my friends" on public.live_positions;
create policy "see live positions of me and my friends" on public.live_positions
  for select to authenticated
  using (
    exists (
      select 1 from public.flights f
      where f.id = live_positions.flight_id
        and (f.user_id = (select auth.jwt() ->> 'sub') or (not f.hidden and public.is_friend(f.user_id)))
    )
  );
