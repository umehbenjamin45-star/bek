import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const alice = '11111111-1111-4111-8111-111111111111'; const bob = '22222222-2222-4222-8222-222222222222'; const carol = '33333333-3333-4333-8333-333333333333';
test('password account migration preserves identities and enforces private unique usernames', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      insert into auth.users(id) values ('${alice}');`);
    await db.exec(await readFile(new URL('../supabase/migrations/202610040002_password_accounts.sql', import.meta.url), 'utf8'));
    const old = await db.query<{user_id:string;username:string}>('select * from public.profiles');
    assert.equal(old.rows[0].user_id, alice); assert.equal(old.rows[0].username, `user_${alice.replaceAll('-','')}`);
    await db.exec(`insert into auth.users(id,raw_user_meta_data) values ('${bob}', '{"username":"Benjamin_45"}')`);
    assert.equal((await db.query<{username:string}>(`select username from public.profiles where user_id='${bob}'`)).rows[0].username, 'benjamin_45');
    await t.test('duplicate and invalid usernames abort registration atomically', async () => {
      await assert.rejects(db.exec(`insert into auth.users(id,raw_user_meta_data) values ('${carol}', '{"username":"BENJAMIN_45"}')`), /unique constraint/);
      assert.equal((await db.query(`select * from auth.users where id='${carol}'`)).rows.length, 0);
      await assert.rejects(db.exec(`insert into auth.users(id,raw_user_meta_data) values ('${carol}', '{"username":"../invalid"}')`), /Invalid username/);
    });
    await t.test('profiles cannot enumerate others or be claimed/renamed by clients', async () => {
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false)`);
      assert.equal((await db.query('select * from public.profiles')).rows.length, 1);
      await assert.rejects(db.exec(`update public.profiles set username='stolen' where user_id='${bob}'`), /permission denied/);
      await assert.rejects(db.exec(`insert into public.profiles(user_id,username) values ('${carol}', 'stolen')`), /permission denied/);
      await assert.rejects(db.exec(`select public.create_account_profile()`), /permission denied/);
      await db.exec('reset role; set role anon');
      await assert.rejects(db.query('select * from public.profiles'), /permission denied/);
      assert.equal((await db.query<{ready:boolean}>('select public.password_accounts_ready() as ready')).rows[0].ready, true);
      await db.exec('reset role');
    });
    await t.test('server role can resolve a username without a publicly accessible email map', async () => {
      await db.exec('set role service_role');
      assert.equal((await db.query(`select user_id from public.profiles where username='benjamin_45'`)).rows.length, 1);
      await db.exec('reset role');
      const columns = await db.query<{ column_name:string }>("select column_name from information_schema.columns where table_name='profiles'");
      assert.ok(!columns.rows.some(row => /password|email/.test(row.column_name)));
    });
  } finally { await db.close(); }
});
