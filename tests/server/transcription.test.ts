process.env.TRANSCRIPTION_PROVIDER = 'openai';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transcribeAudio, TranscriptionError } from '../../lib/server/transcription';
test('provider abstraction accepts another speech provider', async () => {
  const audio = new Blob(['audio']);
  assert.equal(await transcribeAudio(audio, 'clip.wav', { async transcribe(received, filename) { assert.equal(received, audio); assert.equal(filename, 'clip.wav'); return 'Alternative provider'; } }), 'Alternative provider');
});
test('server speech adapter sends audio as multipart with server-only authorization', async () => {
  const originalFetch = globalThis.fetch; const originalKey = process.env.TRANSCRIPTION_API_KEY;
  process.env.TRANSCRIPTION_API_KEY = 'test-server-key';
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/audio/transcriptions');
    assert.equal((init!.headers as Record<string,string>).Authorization, 'Bearer test-server-key');
    const body = init!.body as FormData;
    assert.equal(await (body.get('file') as File).text(), 'test audio');
    assert.equal((body.get('file') as File).name, 'clip.wav');
    return Response.json({ text: ' Real response contract ' });
  };
  try { assert.equal(await transcribeAudio(new Blob(['test audio']), 'clip.wav'), 'Real response contract'); }
  finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.TRANSCRIPTION_API_KEY; else process.env.TRANSCRIPTION_API_KEY = originalKey; }
});
test('provider failures are sanitized and blank speech is not saved', async () => {
  const originalFetch = globalThis.fetch; const originalKey = process.env.TRANSCRIPTION_API_KEY;
  process.env.TRANSCRIPTION_API_KEY = 'test-key';
  try {
    globalThis.fetch = async () => Response.json({ secret: 'sensitive-provider-message' }, { status: 500 });
    await assert.rejects(transcribeAudio(new Blob(['audio']), 'clip.wav'), error => error instanceof TranscriptionError && !error.message.includes('sensitive'));
    globalThis.fetch = async () => Response.json({ text: '  ' });
    await assert.rejects(transcribeAudio(new Blob(['audio']), 'clip.wav'), /No speech/);
    globalThis.fetch = async () => { throw new Error('sensitive-network-error'); };
    await assert.rejects(transcribeAudio(new Blob(['audio']), 'clip.wav'), /could not be reached/);
  } finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.TRANSCRIPTION_API_KEY; else process.env.TRANSCRIPTION_API_KEY = originalKey; }
});

test('Groq default uses only its own key and model, and never falls back to paid OpenAI', async () => {
  const originalFetch = globalThis.fetch;
  const before = { provider: process.env.TRANSCRIPTION_PROVIDER, key: process.env.GROQ_API_KEY, model: process.env.GROQ_TRANSCRIPTION_MODEL };
  delete process.env.TRANSCRIPTION_PROVIDER;
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_TRANSCRIPTION_MODEL;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.groq.com/openai/v1/audio/transcriptions');
    assert.equal((init!.headers as Record<string, string>).Authorization, 'Bearer groq-test-key');
    const body = init!.body as FormData;
    assert.equal(body.get('model'), 'whisper-large-v3-turbo');
    assert.equal(await (body.get('file') as File).text(), 'speech');
    return Response.json({ text: 'Recognized speech' });
  };
  try {
    await assert.rejects(transcribeAudio(new Blob(['speech']), 'clip.wav'), /GROQ_API_KEY/);
    assert.equal(calls, 0);
    process.env.GROQ_API_KEY = 'groq-test-key';
    assert.equal(await transcribeAudio(new Blob(['speech']), 'clip.wav'), 'Recognized speech');
    globalThis.fetch = async url => { calls++; assert.equal(url, 'https://api.groq.com/openai/v1/audio/transcriptions'); return Response.json({}, { status: 429 }); };
    await assert.rejects(transcribeAudio(new Blob(['speech']), 'clip.wav'), /limit resets/);
    assert.equal(calls, 2);
    await assert.rejects(transcribeAudio(new Blob([new Uint8Array(25_000_001)]), 'large.wav'), /25 MB/);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of [['TRANSCRIPTION_PROVIDER', before.provider], ['GROQ_API_KEY', before.key], ['GROQ_TRANSCRIPTION_MODEL', before.model]]) {
      if (value === undefined) delete process.env[name!]; else process.env[name!] = value;
    }
  }
});
