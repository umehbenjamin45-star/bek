// External Supabase/provider calls are fixtures here. These tests exercise actual UI,
// browser MediaRecorder, upload validation, editing, and downloaded TXT bytes.
import { test, expect, type Page } from '@playwright/test';
const userId = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
async function authenticate(page: Page) {
  await page.addInitScript(({ userId }) => {
    const token = `${btoa('{}')}.${btoa(JSON.stringify({ sub:userId, exp:Math.floor(Date.now()/1000)+3600 }))}.fixture`;
    localStorage.setItem('sb-browser-fixture-auth-token', JSON.stringify({ access_token:token, refresh_token:'test-refresh', token_type:'bearer', expires_at:Math.floor(Date.now()/1000)+3600, expires_in:3600, user:{ id:userId, aud:'authenticated', role:'authenticated', email:'test@example.test', user_metadata:{ full_name:'Test User' } } }));
  }, { userId });
}
async function backend(page: Page, options = { failSave: false, failUpload: false }) {
  let record: Record<string, unknown> | null = null;
  let failed = false;
  await page.route('https://browser-fixture.supabase.co/**', async route => {
    const request = route.request(); const url = request.url();
    if (url.includes('/storage/v1/object/sign/')) return route.fulfill({ json: { signedURL:'/object/sign/recordings/test.wav?token=test' } });
    if (url.includes('/storage/v1/object/') && options.failUpload) return route.fulfill({ status:500, json:{ message:'Upload unavailable' } });
    if (url.includes('/storage/v1/object/')) return route.fulfill({ json:{ Key:`recordings/${userId}/${id}.wav` } });
    if (url.includes('/auth/v1/logout')) return route.fulfill({ status:204 });
    if (url.includes('/rest/v1/transcripts')) {
      if (request.method() === 'PATCH' && options.failSave) return route.fulfill({ status:500, json:{ message:'Database unavailable' } });
      if (request.method() === 'PATCH') { record = { ...record, ...request.postDataJSON(), updated_at:new Date().toISOString() }; return route.fulfill({ json:record }); }
      if (request.method() === 'DELETE') { record = null; return route.fulfill({ json:[{ id }] }); }
      return route.fulfill({ json:request.headers().accept?.includes('object') ? record : record ? [record] : [] });
    }
    return route.fulfill({ json:{} });
  });
  await page.route('**/api/transcribe', async route => {
    if (!failed) { failed = true; return route.fulfill({ status:502, json:{ error:'The transcription service could not process this audio. Please retry.' } }); }
    record = { id, user_id:userId, title:'Untitled transcript', transcript_text:'Browser fixture transcript', audio_reference:null, duration:2, created_at:new Date().toISOString(), updated_at:new Date().toISOString() };
    return route.fulfill({ status:201, json:{ transcript:record } });
  });
}
test('signed-out users see password sign-in and server rejects unauthenticated transcription', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name:'Sign in', exact:true })).toBeVisible();
  const response = await request.post('/api/transcribe', { data:{ audio_reference:'other-user/clip.wav' } });
  expect(response.status()).toBe(401);
});
test('browser records, pauses, resumes, stops, preserves audio on failure and retries', async ({ page }) => {
  await authenticate(page); await backend(page); await page.goto('/record');
  await page.getByRole('button', { name:'Start recording', exact:true }).click();
  await expect(page.getByRole('button', { name:'Pause', exact:true })).toBeVisible();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name:'Pause', exact:true }).click();
  const duration = await page.getByLabel('Recording duration').textContent();
  await page.waitForTimeout(700);
  expect(await page.getByLabel('Recording duration').textContent()).toBe(duration);
  await page.getByRole('button', { name:'Resume', exact:true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name:'Stop recording', exact:true }).click();
  await expect(page.getByLabel('Preview your audio')).toBeVisible();
  expect(await page.getByLabel('Preview your audio').evaluate((node: HTMLAudioElement) => node.src.startsWith('blob:'))).toBe(true);
  await page.getByRole('button', { name:'Transcribe audio', exact:true }).click();
  await expect(page.getByRole('alert').filter({ hasText:'Please retry' })).toContainText('Please retry');
  await expect(page.getByLabel('Preview your audio')).toBeVisible();
  await page.getByRole('button', { name:'Retry transcription' }).click();
  await expect(page.getByLabel('Transcript', { exact:true })).toHaveValue('Browser fixture transcript');
});
test('upload validation, transcript edits, autosave, history search and TXT download', async ({ page }) => {
  await authenticate(page); await backend(page); await page.goto('/record?mode=upload');
  await page.getByLabel('Choose audio file').setInputFiles({ name:'invalid.exe', mimeType:'application/octet-stream', buffer:Buffer.from('invalid') });
  await expect(page.getByRole('alert').filter({ hasText:'Use an MP3' })).toContainText('Use an MP3');
  const audio = Buffer.alloc(44 + 16000); audio.write('RIFF'); audio.writeUInt32LE(audio.length-8,4); audio.write('WAVE',8); audio.write('fmt ',12); audio.writeUInt32LE(16,16); audio.writeUInt16LE(1,20); audio.writeUInt16LE(1,22); audio.writeUInt32LE(8000,24); audio.writeUInt32LE(16000,28); audio.writeUInt16LE(2,32); audio.writeUInt16LE(16,34); audio.write('data',36); audio.writeUInt32LE(16000,40);
  await page.getByLabel('Choose audio file').setInputFiles({ name:'test.wav', mimeType:'audio/wav', buffer:audio });
  await page.getByRole('button', { name:'Transcribe audio', exact:true }).click();
  await page.getByRole('button', { name:'Retry transcription' }).click();
  await page.getByLabel('Title', { exact:true }).fill('A quiet morning');
  await page.getByLabel('Transcript', { exact:true }).fill('Edited words about a garden.');
  await expect(page.getByRole('status').filter({ hasText:/^Saved$/ })).toBeVisible({ timeout:10000 });
  const download = page.waitForEvent('download'); await page.getByRole('button', { name:'Export TXT' }).click();
  const file = await download; expect(file.suggestedFilename()).toBe('A quiet morning.txt');
  const stream = await file.createReadStream(); const chunks = []; for await (const chunk of stream!) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe('Edited words about a garden.');
  await page.getByRole('link', { name:'History', exact:true }).click();
  await page.getByLabel('Search transcripts').fill('garden');
  await expect(page.getByRole('heading', { name:'A quiet morning' })).toBeVisible();
  await page.getByLabel('Search transcripts').fill('absent'); await expect(page.getByText('No matching transcripts')).toBeVisible();
  await page.getByLabel('Search transcripts').fill('');
  await page.getByRole('heading', { name:'A quiet morning' }).click();
  await expect(page.getByLabel('Transcript', { exact:true })).toHaveValue('Edited words about a garden.');
  await page.getByRole('button', { name:'Delete', exact:true }).click();
  await page.getByRole('button', { name:'Yes, delete' }).click();
  await expect(page.getByRole('heading', { name:'Transcript deleted' })).toBeVisible();
  await page.getByRole('link', { name:'Return to history' }).click();
  await expect(page.getByText('No transcripts yet')).toBeVisible();
});
test('small screens keep navigation and actions accessible without overflow', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 }); await authenticate(page); await backend(page); await page.goto('/');
  await expect(page.getByRole('heading', { name:'New recording', exact:true })).toBeVisible();
  await expect(page.getByRole('link', { name:'Settings', exact:true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('microphone permission denial produces an actionable error', async ({ page }) => {
  await authenticate(page); await backend(page);
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
  await page.goto('/record'); await page.getByRole('button', { name:'Start recording', exact:true }).click();
  await expect(page.getByRole('alert').filter({ hasText:'permission was denied' })).toContainText('upload audio');
  await expect(page.getByRole('button', { name:'Start recording', exact:true })).toBeEnabled();
});
test('failed uploads preserve audio and database failures preserve editable text for retry', async ({ page }) => {
  const options = { failSave:false, failUpload:true }; await authenticate(page); await backend(page, options); await page.goto('/record?mode=upload');
  await page.getByLabel('Choose audio file').setInputFiles({ name:'test.wav', mimeType:'audio/wav', buffer:Buffer.from('RIFF0000WAVE0000test audio') });
  await page.getByRole('button', { name:'Transcribe audio', exact:true }).click();
  await expect(page.getByRole('alert').filter({ hasText:'Audio upload failed' })).toBeVisible();
  await expect(page.getByLabel('Preview your audio')).toBeVisible();
  options.failUpload = false; await page.getByRole('button', { name:'Retry transcription' }).click();
  await expect(page.getByRole('alert').filter({ hasText:'Please retry' })).toBeVisible();
  await page.getByRole('button', { name:'Retry transcription' }).click();
  await expect(page.getByLabel('Transcript', { exact:true })).toHaveValue('Browser fixture transcript');
  options.failSave = true; await page.getByLabel('Transcript', { exact:true }).fill('Keep these edits after failure.');
  await expect(page.getByRole('alert').filter({ hasText:'could not be saved' })).toBeVisible({ timeout:15000 });
  await expect(page.getByLabel('Transcript', { exact:true })).toHaveValue('Keep these edits after failure.');
  options.failSave = false; await page.getByRole('button', { name:'Save', exact:true }).click();
  await expect(page.getByRole('status').filter({ hasText:/^Saved$/ })).toBeVisible();
  await page.getByRole('link', { name:'Settings', exact:true }).click(); await page.getByRole('button', { name:'Sign out', exact:true }).click();
  await expect(page.getByRole('button', { name:'Sign in', exact:true })).toBeVisible();
});
