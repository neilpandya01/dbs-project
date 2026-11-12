-- Wingmates: you can't send a friend request to someone who already sent you one.
-- (Before, asking back quietly accepted it. Now it's refused: the request waits under "Requests" and
--  only the person it was sent to can accept it.)
-- Also: friend search no longer suggests people you're already connected to or have a request with.
-- Run once in Supabase -> SQL Editor.

create or replace function public.send_friend_request(p_username text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me text := auth.jwt() ->> 'sub';
  target text;
  ex public.friendships;
  new_id uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select user_id into target from public.profiles where lower(username) = lower(trim(p_username));
  if target is null then raise exception 'No user @% found', trim(p_username); end if;
  if target = me then raise exception 'That''s you!'; end if;

  select * into ex from public.friendships
   where least(requester, addressee) = least(me, target) and greatest(requester, addressee) = greatest(me, target);
  if found then
    if ex.status = 'accepted' then raise exception 'You''re already friends'; end if;
    if ex.requester = me then raise exception 'You already sent a request to @%', trim(p_username); end if;
    raise exception '@% already sent you a request. Accept it under Requests.', trim(p_username);
  end if;

  insert into public.friendships (requester, addressee) values (me, target) returning id into new_id;
  return new_id;
end $$;

create or replace function public.find_profiles(p_query text)
returns table (user_id text, username text, display_name text)
language sql stable security definer set search_path = '' as $$
  with q as (select lower(trim(both '@' from trim(p_query))) as t)
  select p.user_id, p.username, p.display_name
  from public.profiles p, q
  where (auth.jwt() ->> 'sub') is not null
    and p.user_id <> (auth.jwt() ->> 'sub')
    and char_length(q.t) >= 3
    and starts_with(lower(p.username), q.t)
    and char_length(q.t)::numeric >= 0.8 * char_length(p.username)
    and not exists (
      select 1 from public.friendships f
      where (f.requester = (auth.jwt() ->> 'sub') and f.addressee = p.user_id)
         or (f.addressee = (auth.jwt() ->> 'sub') and f.requester = p.user_id))
  order by p.username
  limit 5;
$$;
