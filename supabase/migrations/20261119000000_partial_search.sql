-- Wingmates: find people by a partial username (best 5 matches), no longer only after most of it is typed.
-- Run once in Supabase -> SQL Editor.
--
-- Matches usernames that contain what was typed, best first: exact, then starts-with, then contains
-- (earlier in the name ranks higher, then shorter names, then alphabetical). Returns at most 5, and
-- needs at least 2 characters. Only username, display name and your status with them come back.
create or replace function public.find_profiles(p_query text)
returns table (user_id text, username text, display_name text, relation text)
language sql stable security definer set search_path = '' as $$
  with q as (select lower(trim(both '@' from trim(p_query))) as t),
       me as (select auth.jwt() ->> 'sub' as sub)
  select p.user_id, p.username, p.display_name,
         case when f.id is null then 'none'
              when f.status = 'accepted' then 'friends'
              when f.requester = me.sub then 'requested'
              else 'incoming' end
  from me
  cross join q
  cross join public.profiles p
  left join public.friendships f
    on least(f.requester, f.addressee) = least(me.sub, p.user_id)
   and greatest(f.requester, f.addressee) = greatest(me.sub, p.user_id)
  where me.sub is not null
    and p.user_id <> me.sub
    and char_length(q.t) >= 2
    and strpos(lower(p.username), q.t) > 0
  order by strpos(lower(p.username), q.t), char_length(p.username), p.username
  limit 5;
$$;
revoke all on function public.find_profiles(text) from public, anon;
grant execute on function public.find_profiles(text) to authenticated;
