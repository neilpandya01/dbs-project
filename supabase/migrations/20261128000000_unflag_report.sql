-- Let someone take back a flag they put on a thread (the flag count drops, so a thread hidden by 3 flags can reappear).
create or replace function public.unflag_report(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (auth.jwt() ->> 'sub') is null then raise exception 'Not signed in'; end if;
  delete from public.report_flags where report_id = p_id and user_id = (auth.jwt() ->> 'sub');
  update public.reports set flags = (select count(*) from public.report_flags where report_id = p_id) where id = p_id;
end $$;
revoke all on function public.unflag_report(uuid) from public, anon;
grant execute on function public.unflag_report(uuid) to authenticated;
