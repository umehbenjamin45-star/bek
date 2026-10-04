import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
test('actual PostgreSQL RLS isolates transcripts and private storage between users', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      insert into auth.users values ('${alice}'), ('${bob}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema public, auth to authenticated, anon;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid() primary key, bucket_id text references storage.buckets(id), name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name, '/')$$;
      grant usage on schema storage to authenticated;
      grant select, insert, delete on storage.objects to authenticated;
    `);
    const migration = await readFile(new URL('../supabase/migrations/202610040001_initial.sql', import.meta.url), 'utf8');
    // Hosted Supabase owns this publication; standalone PostgreSQL tests cover its table/policies.
    await db.exec(migration.replace('alter publication supabase_realtime add table public.transcripts;', ''));
    async function asUser(user: string, sql: string) {
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
      try { return await db.query(sql); } finally { await db.exec('reset role'); }
    }
    const inserted = await asUser(alice, `insert into public.transcripts(user_id,title,transcript_text,audio_reference) values ('${alice}', 'Private thought', 'Alice only', '${alice}/clip.wav') returning id, updated_at`);
    const id = (inserted.rows[0] as { id: string }).id;
    await asUser(alice, `insert into storage.objects(bucket_id,name) values ('recordings','${alice}/clip.wav')`);
    await t.test('owner can read and edit', async () => {
      assert.equal((await asUser(alice, 'select * from public.transcripts')).rows.length, 1);
      const edited = await asUser(alice, `update public.transcripts set transcript_text='Edited' where id='${id}' returning transcript_text`);
      assert.equal((edited.rows[0] as { transcript_text: string }).transcript_text, 'Edited');
    });
    await t.test('another user cannot read, edit, delete, forge ownership, or move a record', async () => {
      assert.equal((await asUser(bob, 'select * from public.transcripts')).rows.length, 0);
      assert.equal((await asUser(bob, `update public.transcripts set title='Stolen' where id='${id}' returning id`)).rows.length, 0);
      assert.equal((await asUser(bob, `delete from public.transcripts where id='${id}' returning id`)).rows.length, 0);
      await assert.rejects(asUser(bob, `insert into public.transcripts(user_id) values ('${alice}')`), /row-level security/);
      await assert.rejects(asUser(alice, `update public.transcripts set user_id='${bob}',audio_reference=null where id='${id}'`), /row-level security/);
    });
    await t.test('storage policies restrict read, insert and delete to the owner', async () => {
      assert.equal((await asUser(bob, 'select * from storage.objects')).rows.length, 0);
      assert.equal((await asUser(bob, `delete from storage.objects returning id`)).rows.length, 0);
      await assert.rejects(asUser(bob, `insert into storage.objects(bucket_id,name) values ('recordings','${alice}/injected.wav')`), /row-level security/);
      assert.equal((await asUser(alice, 'select * from storage.objects')).rows.length, 1);
    });
    await t.test('optimistic concurrency prevents stale edits overwriting another device', async () => {
      const before = await asUser(alice, `select updated_at::text as version from public.transcripts where id='${id}'`);
      const version = (before.rows[0] as { version: string }).version;
      await asUser(alice, `update public.transcripts set title='From phone' where id='${id}'`);
      assert.equal((await asUser(alice, `update public.transcripts set title='Stale laptop' where id='${id}' and updated_at='${version}' returning id`)).rows.length, 0);
    });
    await t.test('anonymous users have no transcript access', async () => {
      await db.exec('set role anon');
      try { await assert.rejects(db.query('select * from public.transcripts'), /permission denied/); }
      finally { await db.exec('reset role'); }
    });
    await t.test('owner can delete transcript and audio', async () => {
      assert.equal((await asUser(alice, `delete from public.transcripts where id='${id}' returning id`)).rows.length, 1);
      assert.equal((await asUser(alice, `delete from storage.objects returning id`)).rows.length, 1);
    });
  } finally { await db.close(); }
});
