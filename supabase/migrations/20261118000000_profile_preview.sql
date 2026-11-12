-- Wingmates: look up anyone, see a limited preview, and see where your request with them stands.
-- Run once in Supabase -> SQL Editor, after the earlier migrations.
--
-- Before friendship, a person can only be seen as: username, display name, avatar colour and banner.
-- Everything else (photo, home city, bio, flights, stats) stays behind the friends-only policies.

-- ---- the preview for one exact username ---------------------------------------------------------------
-- relation (from the caller's side): 'self' | 'none' | 'requested' (you asked) | 'incoming' (they asked) | 'friends'
create or replace function public.profile_preview(p_username text)
returns table (user_id text, username text, display_name text, avatar_color text, banner jsonb, relation text, friendship_id uuid)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.username, p.display_name, p.avatar_color, p.banner,
         case when p.user_id = me.sub then 'self'
              when f.id is null then 'none'
              when f.status = 'accepted' then 'friends'
              when f.requester = me.sub then 'requested'
              else 'incoming' end,
         f.id
  from (select auth.jwt() ->> 'sub' as sub) me
  join public.profiles p on lower(p.username) = lower(trim(both '@' from trim(p_username)))
  left join public.friendships f
    on least(f.requester, f.addressee) = least(me.sub, p.user_id)
   and greatest(f.requester, f.addressee) = greatest(me.sub, p.user_id)
  where me.sub is not null
  limit 1;
$$;
revoke all on function public.profile_preview(text) from public, anon;
grant execute on function public.profile_preview(text) to authenticated;

-- ---- search suggestions now include people you're connected to, with their status -----------------------
-- (still only after at least 80% of the username is typed, at least 3 characters)
drop function if exists public.find_profiles(text);
create function public.find_profiles(p_query text)
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
    and char_length(q.t) >= 3
    and starts_with(lower(p.username), q.t)
    and char_length(q.t)::numeric >= 0.8 * char_length(p.username)
  order by p.username
  limit 5;
$$;
revoke all on function public.find_profiles(text) from public, anon;
grant execute on function public.find_profiles(text) to authenticated;
