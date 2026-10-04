'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
import { useRecorder } from '@/hooks/use-recorder';
import { AUDIO_ACCEPT, formatDuration, validateAudio } from '@/lib/audio';
import { getSupabase } from '@/lib/supabase/browser';
import { uploadAudio, removeAudio } from '@/lib/storage';
type Phase = 'idle' | 'uploading' | 'transcribing' | 'completed' | 'failed';
export function RecordingWorkspace() {
  const recorder = useRecorder(); const { session } = useAuth(); const router = useRouter();
  const [mode, setMode] = useState<'record' | 'upload'>('record');
  const [uploaded, setUploaded] = useState<File | null>(null); const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState(''); const [url, setUrl] = useState(''); const [path, setPath] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false); const input = useRef<HTMLInputElement>(null); const lock = useRef(false); const complete = useRef(false);
  const file = uploaded || recorder.file; const busy = phase === 'uploading' || phase === 'transcribing' || clearing;
  const recording = ['requesting', 'recording', 'paused', 'stopping'].includes(recorder.state);
  useEffect(() => { if (new URLSearchParams(window.location.search).get('mode') === 'upload') setMode('upload'); }, []);
  useEffect(() => { if (!file) { setUrl(''); return; } const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if ((file || recording) && !complete.current) { event.preventDefault(); } };
    const click = (event: MouseEvent) => { const anchor = (event.target as Element).closest('a[href]'); if (anchor && (file || recording) && !complete.current && !window.confirm('Leave this page? Unsaved audio will be lost.')) event.preventDefault(); };
    window.addEventListener('beforeunload', handler); document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', handler); document.removeEventListener('click', click, true); };
  }, [file, recording]);
  async function clear() {
    setClearing(true); setError('');
    try { if (path) await removeAudio(path); setPath(null); setUploaded(null); recorder.reset(); setPhase('idle'); if (input.current) input.current.value = ''; }
    catch (error) { setError((error as Error).message); }
    finally { setClearing(false); }
  }
  async function transcribe() {
    if (!file || !session || lock.current) return;
    const invalid = validateAudio(file); if (invalid) { setError(invalid); return; }
    lock.current = true; setError('');
    try {
      let reference = path;
      if (!reference) { setPhase('uploading'); reference = await uploadAudio(session.user.id, file); setPath(reference); }
      setPhase('transcribing');
      const { data } = await getSupabase()!.auth.getSession();
      if (!data.session) throw new Error('Your session expired. Sign in again to continue.');
      const response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ audio_reference: reference, duration: uploaded ? null : recorder.seconds }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Transcription failed. Please retry.');
      setPhase('completed'); complete.current = true; router.push(`/transcripts/${result.transcript.id}`);
    } catch (error) { setPhase('failed'); setError(error instanceof TypeError ? 'The connection was interrupted. Your audio is still available; retry when you are online.' : (error as Error).message); }
    finally { lock.current = false; }
  }
  function choose(file: File | undefined) {
    if (!file) return;
    const invalid = validateAudio(file);
    if (invalid) { setError(invalid); if (input.current) input.current.value = ''; return; }
    setError(''); setUploaded(file); setPhase('idle');
  }
  return <><div className="page-heading"><p className="eyebrow">START WITH YOUR VOICE</p><h1>{mode === 'record' ? 'New recording' : 'Upload audio'}</h1><p>One thought, a conversation, or anything you want to keep.</p></div><div className="tabs" aria-label="Audio source"><button className={mode === 'record' ? 'selected' : 'secondary'} disabled={busy || recording || !!file} onClick={() => setMode('record')}>Record voice</button><button className={mode === 'upload' ? 'selected' : 'secondary'} disabled={busy || recording || !!file} onClick={() => setMode('upload')}>Upload audio</button></div><section className="card recorder">{!file && mode === 'record' && <><div className={`mic-symbol ${recorder.state === 'recording' ? 'is-recording' : ''}`} aria-hidden="true">●</div><div className="duration" aria-label="Recording duration">{formatDuration(recorder.seconds)}</div><p className="muted" role="status">{({ idle: 'Ready when you are', requesting: 'Waiting for microphone permission…', recording: 'Recording', paused: 'Paused', stopping: 'Finishing recording…', ready: 'Ready to transcribe' })[recorder.state]}</p><div className="button-row">{recorder.state === 'idle' && <button onClick={() => void recorder.start()}>Start recording</button>}{recorder.state === 'recording' && <button className="secondary" onClick={recorder.pause}>Pause</button>}{recorder.state === 'paused' && <button className="secondary" onClick={recorder.resume}>Resume</button>}{['recording', 'paused'].includes(recorder.state) && <button onClick={recorder.stop}>Stop recording</button>}</div><p className="small muted">Microphone access is requested when you start. Audio stays here until you transcribe it.</p></>}{!file && mode === 'upload' && <div className="upload-area"><span className="action-icon outline" aria-hidden="true">↑</span><h2>Choose your audio</h2><p className="muted">MP3, MP4, M4A, MPEG, WAV, or WebM · Up to 24 MB</p><label className="file-button" htmlFor="audio-upload">Choose audio file</label><input ref={input} id="audio-upload" type="file" accept={AUDIO_ACCEPT} onChange={event => choose(event.target.files?.[0])} /></div>}{file && <><p className="eyebrow">AUDIO READY</p><h2 className="file-name">{file.name}</h2><p className="muted">{(file.size / 1024 / 1024).toFixed(1)} MB{!uploaded ? ` · ${formatDuration(recorder.seconds)}` : ''}</p><audio controls src={url || undefined} preload="metadata" aria-label="Preview your audio" /><div className="button-row"><button disabled={busy || phase === 'completed'} onClick={() => void transcribe()}>{phase === 'uploading' ? 'Uploading…' : phase === 'transcribing' ? 'Transcribing…' : phase === 'completed' ? 'Completed' : phase === 'failed' ? 'Retry transcription' : 'Transcribe audio'}</button><button className="secondary" disabled={busy || phase === 'completed'} onClick={() => void clear()}>{clearing ? 'Removing…' : 'Delete / start over'}</button></div><p role="status" className="small muted">{phase === 'uploading' ? 'Uploading your audio to private storage…' : phase === 'transcribing' ? 'Turning your audio into text. Keep this page open.' : phase === 'completed' ? 'Completed. Opening your saved transcript…' : phase === 'failed' ? 'Failed. Your audio is preserved for retry.' : 'Your transcript will be saved to your account after transcription.'}</p></>}{(error || recorder.error) && <p className="error" role="alert">{error || recorder.error}</p>}</section></>;
}
