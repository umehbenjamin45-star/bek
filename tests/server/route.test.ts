process.env.TRANSCRIPTION_PROVIDER = 'openai';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../../app/api/transcribe/route';
const user = '11111111-1111-4111-8111-111111111111';
const audioId = '22222222-2222-4222-8222-222222222222';
const path = `${user}/${audioId}.wav`;
const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url')}.signature`;
function request(reference = path, auth = true) { return new Request('http://test/api/transcribe', { method:'POST', headers:{ 'content-type':'application/json', ...(auth ? { authorization:`Bearer ${token}` } : {}) }, body:JSON.stringify({ audio_reference: reference, duration: 2 }) }); }
test('transcription route authenticates, isolates audio, validates bytes, saves and supports retry', async t => {
  const originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key'; process.env.TRANSCRIPTION_API_KEY = 'server-test-key';
  let stored: Record<string, unknown> | null = null; let providerCalls = 0; let invalidAudio = false; let providerFails = false; let saveFails = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) return Response.json({ id: user, aud:'authenticated', role:'authenticated', email:'test@example.test' });
    if (url.includes('/rest/v1/transcripts') && init?.method === 'POST') {
      if (saveFails) return Response.json({ message:'private-database-error', code:'XX000' }, { status:500 });
      const data = JSON.parse(String(init.body)); assert.equal(data.user_id, user); assert.equal(data.audio_reference, path);
      stored = { ...data, id: audioId, created_at:new Date().toISOString(), updated_at:new Date().toISOString() }; return Response.json(stored, { status:201 });
    }
    if (url.includes('/rest/v1/transcripts')) return Response.json(stored);
    if (url.includes('/storage/v1/object/')) return new Response(invalidAudio ? 'not an audio file' : 'RIFF0000WAVE0000audio payload', { headers:{ 'content-type':'audio/wav' } });
    if (url === 'https://api.openai.com/v1/audio/transcriptions') {
      providerCalls++; assert.equal(await ((init!.body as FormData).get('file') as File).text(), 'RIFF0000WAVE0000audio payload');
      return providerFails ? Response.json({ message:'private-provider-error' }, { status:500 }) : Response.json({ text:'Hello from the speech service' });
    }
    throw new Error(`Unexpected test request ${url}`);
  };
  try {
    await t.test('missing authentication is rejected', async () => { assert.equal((await POST(request(path, false))).status, 401); });
    await t.test('another user audio is rejected before download', async () => { assert.equal((await POST(request(`${audioId}/${audioId}.wav`))).status, 400); assert.equal(providerCalls, 0); });
    await t.test('malformed, oversized, and invalid-duration requests are rejected', async () => {
      const headers = { authorization:`Bearer ${token}`, 'content-type':'application/json' };
      assert.equal((await POST(new Request('http://test/api/transcribe', { method:'POST', headers, body:'{' }))).status, 400);
      assert.equal((await POST(new Request('http://test/api/transcribe', { method:'POST', headers, body:JSON.stringify({ padding:'a'.repeat(5000) }) }))).status, 413);
      assert.equal((await POST(new Request('http://test/api/transcribe', { method:'POST', headers, body:JSON.stringify({ audio_reference:path, duration:-1 }) }))).status, 400);
      assert.equal(providerCalls, 0);
    });
    await t.test('invalid file signatures never reach speech provider', async () => { invalidAudio = true; assert.equal((await POST(request())).status, 400); invalidAudio = false; assert.equal(providerCalls, 0); });
    await t.test('failed provider keeps storage untouched and returns a sanitized error', async () => { providerFails = true; const response = await POST(request()); assert.equal(response.status, 502); assert.equal(JSON.stringify(await response.json()).includes('private-provider-error'), false); providerFails = false; });
    await t.test('database save failures report retry instead of success', async () => { saveFails = true; const response = await POST(request()); assert.equal(response.status, 503); assert.match((await response.json()).error, /saving failed/); saveFails = false; });
    await t.test('successful retry returns saved transcript and repeat request is idempotent', async () => {
      const response = await POST(request()); assert.equal(response.status, 201); assert.equal((await response.json()).transcript.transcript_text, 'Hello from the speech service');
      const calls = providerCalls; assert.equal((await POST(request())).status, 200); assert.equal(providerCalls, calls);
    });
  } finally { globalThis.fetch = originalFetch; delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; delete process.env.TRANSCRIPTION_API_KEY; }
});
