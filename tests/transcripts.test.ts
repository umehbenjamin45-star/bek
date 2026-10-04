import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterTranscripts, exportText } from '../lib/transcripts';
import type { Transcript } from '../lib/types';
const item: Transcript = { id:'1', user_id:'1', title:'Morning ideas', transcript_text:'Plan the garden', audio_reference:null, duration:null, created_at:'2026-10-04', updated_at:'2026-10-04' };
test('history search covers both title and body, without case sensitivity', () => {
  assert.equal(filterTranscripts([item], ' MORNING ').length, 1);
  assert.equal(filterTranscripts([item], 'GARDEN').length, 1);
  assert.equal(filterTranscripts([item], 'unrelated').length, 0);
});
test('TXT export contains current edited text and a safe filename', async () => {
  let blob: Blob | undefined; let clicked = false;
  const anchor = { href: '', download: '', click() { clicked = true; } };
  const original = URL.createObjectURL; const originalDocument = globalThis.document;
  URL.createObjectURL = (value: Blob | MediaSource) => { blob = value as Blob; return 'blob:test'; };
  globalThis.document = { createElement: () => anchor } as unknown as Document;
  try {
    exportText('../../My thoughts!', 'Edited transcript\nSecond line');
    assert.equal(clicked, true); assert.equal(anchor.download, 'My thoughts.txt');
    assert.equal(await blob!.text(), 'Edited transcript\nSecond line');
  } finally { URL.createObjectURL = original; globalThis.document = originalDocument; }
});
