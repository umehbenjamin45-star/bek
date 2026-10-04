-- Run once through the Supabase SQL editor or `supabase db push`.
create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled transcript' check (char_length(title) between 1 and 200),
  transcript_text text not null default '' check (char_length(transcript_text) <= 500000),
  audio_reference text,
  duration double precision check (duration >= 0 and duration <= 86400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, audio_reference),
  check (audio_reference is null or audio_reference like user_id::text || '/%')
);
create index transcripts_user_created_idx on public.transcripts(user_id, created_at desc);
alter table public.transcripts enable row level security;
revoke all on public.transcripts from anon;
grant select, insert, update, delete on public.transcripts to authenticated;
create policy "Read own transcripts" on public.transcripts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own transcripts" on public.transcripts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own transcripts" on public.transcripts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own transcripts" on public.transcripts for delete to authenticated using ((select auth.uid()) = user_id);
create function public.update_transcript_timestamp() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  new.created_at = old.created_at;
  return new;
end;
$$;
create trigger transcripts_timestamp before update on public.transcripts for each row execute function public.update_transcript_timestamp();
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 25165824, array['audio/mpeg','audio/mp3','audio/mp4','video/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/webm','video/webm','application/octet-stream']);
create policy "Read own recordings" on storage.objects for select to authenticated using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Upload own recordings" on storage.objects for insert to authenticated with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own recordings" on storage.objects for delete to authenticated using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Clients refetch the canonical database after changes; DELETE only supplies keys.
alter table public.transcripts replica identity full;
alter publication supabase_realtime add table public.transcripts;
