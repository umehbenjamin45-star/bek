-- Additive migration: preserves all existing auth users, transcripts and audio.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z][a-z0-9_]{2,39}$'),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated, service_role;
grant select on public.profiles to authenticated, service_role;
create policy "Read own username" on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

-- Supabase Auth owns password hashing and account/email verification.
-- No password or email is stored in the application profile table.
create function public.create_account_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare chosen_username text;
begin
  chosen_username := lower(trim(new.raw_user_meta_data ->> 'username'));
  if chosen_username is null or chosen_username = '' then
    chosen_username := 'user_' || replace(new.id::text, '-', '');
  elsif chosen_username !~ '^[a-z][a-z0-9_]{2,29}$' then
    raise exception 'Invalid username';
  end if;
  insert into public.profiles(user_id, username) values (new.id, chosen_username);
  return new;
end;
$$;
revoke all on function public.create_account_profile() from public, anon, authenticated;
create trigger auth_user_profile after insert on auth.users
  for each row execute function public.create_account_profile();

-- Existing users receive unique usernames, retain their UUID and keep their data.
-- They can use their email and password recovery to start password sign-in.
insert into public.profiles(user_id, username)
  select id, 'user_' || replace(id::text, '-', '') from auth.users;

-- A public deployment check, not an account/username lookup. Registration waits
-- for this migration so it cannot create an account without its unique username.
create function public.password_accounts_ready() returns boolean
language sql stable set search_path = '' as $$ select true $$;
revoke all on function public.password_accounts_ready() from public;
grant execute on function public.password_accounts_ready() to anon, authenticated;
