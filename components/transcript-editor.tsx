'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth-provider';
import { getSupabase } from '@/lib/supabase/browser';
import { exportText, getTranscript, saveTranscript } from '@/lib/transcripts';
import { removeAudio } from '@/lib/storage';
import type { Transcript } from '@/lib/types';
export function TranscriptEditor({ id }: { id: string }) {
  const { session } = useAuth(); const userId = session!.user.id;
  const [record, setRecord] = useState<Transcript | null>(null); const [title, setTitle] = useState(''); const [text, setText] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [status, setStatus] = useState('Saved');
  const [deleted, setDeleted] = useState(false); const [deleting, setDeleting] = useState(false); const [confirmDelete, setConfirmDelete] = useState(false); const [notice, setNotice] = useState('');
  const [audioUrl, setAudioUrl] = useState(''); const [audioError, setAudioError] = useState('');
  const lock = useRef(false); const current = useRef({ title: '', text: '' }); const saved = useRef<Transcript | null>(null); const dirty = useRef(false); const alive = useRef(true); const deletingRef = useRef(false);
  dirty.current = !!record && (title !== record.title || text !== record.transcript_text); current.current = { title, text };
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const data = await getTranscript(id, userId); if (!alive.current) return; saved.current = data; setRecord(data); setTitle(data.title); setText(data.transcript_text); setNotice(''); setStatus('Saved'); }
    catch (error) { if (alive.current) setError((error as Error).message); }
    finally { if (alive.current) setLoading(false); }
  }, [id, userId]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [load]);
  useEffect(() => {
    if (!record?.audio_reference || deleted) return;
    let active = true;
    getSupabase()!.storage.from('recordings').createSignedUrl(record.audio_reference, 3600).then(({ data, error }) => { if (!active) return; if (error) setAudioError('The original audio could not be loaded. Your transcript is still available.'); else { setAudioUrl(data.signedUrl); setAudioError(''); } });
    return () => { active = false; };
  }, [record?.audio_reference, deleted]);
  useEffect(() => {
    const check = async () => {
      try {
        const next = await getTranscript(id, userId);
        if (!alive.current || !saved.current || next.updated_at === saved.current.updated_at || lock.current) return;
        if (dirty.current) { setNotice('This transcript changed on another device. Copy your unsaved edits, then reload to review the latest version.'); return; }
        saved.current = next; setRecord(next); setTitle(next.title); setText(next.transcript_text); setStatus('Saved');
      } catch { if (alive.current && !deletingRef.current) setNotice('Could not refresh this transcript. It may have been deleted, or your connection may be offline.'); }
    };
    const channel = getSupabase()!.channel(`editor-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transcripts', filter: `id=eq.${id}` }, () => void check()).subscribe();
    const timer = setInterval(() => void check(), 30_000); const focus = () => void check(); window.addEventListener('focus', focus);
    return () => { void getSupabase()!.removeChannel(channel); clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [id, userId]);
  const save = useCallback(async () => {
    if (lock.current || deletingRef.current || !saved.current || !dirty.current) return;
    const values = { ...current.current }; lock.current = true; setStatus('Saving…'); setError('');
    try {
      const next = await saveTranscript(id, userId, values.title, values.text, saved.current.updated_at);
      saved.current = next;
      if (alive.current) { setRecord(next); if (current.current.title === values.title) setTitle(next.title); setStatus('Saved'); setNotice(''); }
    } catch (error) { if (alive.current) { setError((error as Error).message); setStatus('Not saved'); } }
    finally { lock.current = false; }
  }, [id, userId]);
  useEffect(() => {
    if (!dirty.current || deleted || deleting || status === 'Not saved' || notice.includes('another device')) return;
    const timer = setTimeout(() => void save(), 1500); return () => clearTimeout(timer);
  }, [title, text, record, deleted, deleting, status, notice, save]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => { if (dirty.current && !deletingRef.current) event.preventDefault(); };
    const click = (event: MouseEvent) => { if ((event.target as Element).closest('a[href]') && dirty.current && !deletingRef.current && !window.confirm('Your latest edits are not saved. Leave this page?')) event.preventDefault(); };
    window.addEventListener('beforeunload', before); document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', before); document.removeEventListener('click', click, true); };
  }, []);
  async function copy() { try { await navigator.clipboard.writeText(text); setNotice('Text copied to clipboard.'); } catch { setError('Copy was unavailable. Select the text and copy it manually.'); } }
  async function remove() {
    if (lock.current || !record) return;
    let databaseDeleted = deleted;
    deletingRef.current = true; setDeleting(true); setError('');
    try {
      if (!deleted) {
        const { data, error } = await getSupabase()!.from('transcripts').delete().eq('id', id).eq('user_id', userId).select('id');
        if (error || !data?.length) throw new Error('Could not delete this transcript. Please refresh and retry.');
        databaseDeleted = true; setDeleted(true); dirty.current = false;
      }
      if (record.audio_reference) await removeAudio(record.audio_reference);
      setNotice('Transcript and its audio have been deleted.'); setConfirmDelete(false);
    } catch (error) { setError((error as Error).message); if (!databaseDeleted) setNotice('Deletion failed. Your transcript is still available.'); }
    finally { setDeleting(false); if (!databaseDeleted) deletingRef.current = false; }
  }
  if (loading) return <p role="status">Loading transcript…</p>;
  if (!record) return <section className="card"><p className="error" role="alert">{error}</p><button onClick={() => void load()}>Retry</button> <Link href="/history">Back to history</Link></section>;
  if (deleted) return <section className="card"><h1>Transcript deleted</h1>{error ? <><p className="error" role="alert">The transcript was deleted. {error}</p><button disabled={deleting} onClick={() => void remove()}>Retry audio cleanup</button></> : <p>{notice}</p>}<Link href="/history">Return to history</Link></section>;
  return <><div className="section-heading"><Link href="/history">← History</Link><span className="save-state" role="status">{dirty.current && status === 'Saved' ? 'Unsaved changes' : status}</span></div><section className="card editor"><label htmlFor="title">Title</label><input id="title" className="title-input" value={title} maxLength={200} onChange={event => { setTitle(event.target.value); if (status === 'Not saved') setStatus('Unsaved changes'); }} /><p className="small muted">{new Date(record.created_at).toLocaleString()}</p>{audioUrl && <audio controls src={audioUrl} aria-label="Original audio" />}{audioError && <p className="muted">{audioError}</p>}<label htmlFor="transcript">Transcript</label><textarea id="transcript" value={text} maxLength={500000} onChange={event => { setText(event.target.value); if (status === 'Not saved') setStatus('Unsaved changes'); }} spellCheck placeholder="Your transcript…" /><div className="button-row"><button onClick={() => void save()} disabled={status === 'Saving…' || !dirty.current || deleting}>Save</button><button className="secondary" onClick={() => void copy()}>Copy text</button><button className="secondary" onClick={() => exportText(title, text)}>Export TXT</button><button className="danger" disabled={status === 'Saving…' || deleting} onClick={() => setConfirmDelete(true)}>Delete</button></div>{error && <p className="error" role="alert">{error}</p>}{notice && <div className="notice" role="status">{notice} {notice.includes('device') || notice.includes('refresh') ? <button className="secondary" onClick={() => { if (!dirty.current || window.confirm('Reload and discard your unsaved edits? Copy them first.')) void load(); }}>Reload transcript</button> : null}</div>}{confirmDelete && <div className="delete-confirm" role="alert"><p>Delete this transcript and its audio permanently?</p><div className="button-row"><button className="danger" disabled={deleting} onClick={() => void remove()}>{deleting ? 'Deleting…' : 'Yes, delete'}</button><button className="secondary" disabled={deleting} onClick={() => setConfirmDelete(false)}>Cancel</button></div></div>}<p className="small muted">Changes save after a short pause. Supabase keeps the latest saved version across devices.</p></section></>;
}
