-- Wingmates: usernames are permanent.
--
-- Clerk lets people change their username under Account -> Security. We don't want that to
-- rename them here (friends find each other by @username, and reports show it). So:
--   * on INSERT, the username is still taken from the Clerk token claim (nobody can pick someone else's)
--   * on UPDATE, the stored username is kept as-is, whatever the token now says
--   * new reports take the author's username from their profile, not from the token
--
-- Run once in Supabase -> SQL Editor, after the two earlier migrations.

create or replace function public.username_from_token() returns trigger
language plpgsql set search_path = '' as $$
declare
  claim text := auth.jwt() ->> 'username';
begin
  if tg_op = 'UPDATE' then
    -- permanent: a changed Clerk username (or a client sending a different one) is ignored
    new.username := old.username;
    return new;
  end if;
  if (auth.jwt() ->> 'sub') is not null then
    if claim is null or claim = '' then
      raise exception 'Your sign-in token has no username claim. Add {"username": "{{user.username}}"} under Clerk -> Sessions -> Customize session token.';
    end if;
    new.username := claim;
  end if;
  return new;
end $$;

create or replace function public.reports_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  select p.username, coalesce(p.display_name, '') into new.author_username, new.author_name
  from public.profiles p where p.user_id = (auth.jwt() ->> 'sub');
  if new.author_username is null then
    raise exception 'Finish setting up your profile before posting.';
  end if;
  new.helpful := 0;
  new.flags := 0;
  return new;
end $$;
