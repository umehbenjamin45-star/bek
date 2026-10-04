import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioPath, formatDuration, hasAudioSignature, MAX_AUDIO_BYTES, ownsAudioPath, validateAudio } from '../lib/audio';
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
test('audio rejects empty, oversize, mismatched and unsupported uploads', () => {
  assert.match(validateAudio({ name: 'a.wav', type: 'audio/wav', size: 0 })!, /empty/);
  assert.match(validateAudio({ name: 'a.wav', type: 'audio/wav', size: MAX_AUDIO_BYTES + 1 })!, /24 MB/);
  assert.match(validateAudio({ name: 'a.exe', type: '', size: 20 })!, /Use an/);
  assert.match(validateAudio({ name: 'a.mp3', type: 'text/plain', size: 20 })!, /Use an/);
  assert.equal(validateAudio({ name: 'a.mpga', type: 'application/octet-stream', size: 20 }), null);
  assert.equal(validateAudio({ name: 'A.MP3', type: 'audio/mpeg', size: 20 }), null);
  assert.equal(validateAudio({ name: 'a.webm', type: 'audio/webm;codecs=opus', size: 20 }), null);
});
test('signature checks reject disguised files and recognize supported containers', () => {
  assert.equal(hasAudioSignature(new TextEncoder().encode('RIFF0000WAVE0000'), 'wav'), true);
  assert.equal(hasAudioSignature(new TextEncoder().encode('0000ftypM4A 0000'), 'm4a'), true);
  assert.equal(hasAudioSignature(new Uint8Array([0x1a,0x45,0xdf,0xa3,...new Array(12).fill(0)]), 'webm'), true);
  assert.equal(hasAudioSignature(new TextEncoder().encode('ID3' + '0'.repeat(13)), 'mp3'), true);
  assert.equal(hasAudioSignature(new TextEncoder().encode('<script>alert(1)</script>'), 'mp3'), false);
  assert.equal(hasAudioSignature(new Uint8Array(0), 'wav'), false);
});
test('storage references are restricted to an authenticated user folder', () => {
  const path = audioPath(alice, bob, 'clip.WAV');
  assert.equal(path, `${alice}/${bob}.wav`);
  assert.equal(ownsAudioPath(alice, path), true);
  assert.equal(ownsAudioPath(bob, path), false);
  assert.equal(ownsAudioPath(alice, `${alice}/../${bob}/clip.wav`), false);
});
test('duration formatting handles pauses and long recordings', () => {
  assert.equal(formatDuration(61.9), '01:01');
  assert.equal(formatDuration(-1), '00:00');
  assert.equal(formatDuration(3600), '60:00');
});
