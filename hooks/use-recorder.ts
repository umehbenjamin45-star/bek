'use client';
import { useEffect, useRef, useState } from 'react';
import { MAX_AUDIO_BYTES } from '@/lib/audio';
type State = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopping' | 'ready';
export function useRecorder() {
  const [state, setState] = useState<State>('idle'); const [file, setFile] = useState<File | null>(null);
  const [seconds, setSeconds] = useState(0); const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]); const elapsed = useRef(0); const runningSince = useRef(0); const active = useRef(true); const size = useRef(0);
  function release() { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; }
  function elapsedNow() { return elapsed.current + (runningSince.current ? (Date.now() - runningSince.current) / 1000 : 0); }
  function stop() {
    if (!recorder.current || recorder.current.state === 'inactive') return;
    elapsed.current = elapsedNow(); runningSince.current = 0; setSeconds(elapsed.current);
    setState('stopping'); recorder.current.stop(); release();
  }
  useEffect(() => {
    active.current = true;
    const timer = setInterval(() => { if (runningSince.current) setSeconds(elapsedNow()); }, 250);
    return () => { active.current = false; clearInterval(timer); if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop(); release(); };
  }, []);
  async function start() {
    if (stream.current || recorder.current?.state === 'recording') return;
    setError(''); setState('requesting');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Recording is unavailable in this browser. Use HTTPS and a supported browser, or upload an audio file.'); setState('idle'); return; }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!active.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mime) { release(); setError('Your browser cannot record a supported format. Upload an audio file instead.'); setState('idle'); return; }
      const next = new MediaRecorder(media, { mimeType: mime }); recorder.current = next; chunks.current = []; size.current = 0;
      elapsed.current = 0; runningSince.current = Date.now(); setSeconds(0); setFile(null);
      next.ondataavailable = event => {
        if (event.data.size) { chunks.current.push(event.data); size.current += event.data.size; }
        if (size.current >= MAX_AUDIO_BYTES - 1024 * 1024 && next.state !== 'inactive') { setError('Recording stopped near the 24 MB limit. You can transcribe it now.'); stop(); }
      };
      next.onerror = () => { if (active.current) { setError('Recording was interrupted. Any captured audio is available below.'); stop(); } };
      next.onstop = () => {
        release(); if (!active.current) return;
        const blob = new Blob(chunks.current, { type: mime.split(';')[0] });
        setSeconds(elapsed.current); runningSince.current = 0;
        if (!blob.size) { setError('No audio was captured. Check your microphone and try again.'); setState('idle'); return; }
        setFile(new File([blob], `recording.${mime.includes('mp4') ? 'mp4' : 'webm'}`, { type: blob.type })); setState('ready');
      };
      media.getAudioTracks()[0].onended = () => { if (next.state !== 'inactive') { setError('Your microphone disconnected. Any captured audio is available below.'); stop(); } };
      next.start(1000); setState('recording');
    } catch (error) {
      release(); runningSince.current = 0;
      if (!active.current) return;
      const name = (error as DOMException).name;
      setError(name === 'NotAllowedError' ? 'Microphone permission was denied. Allow access in your browser, or upload audio.' : name === 'NotFoundError' ? 'No microphone was found. Connect one or upload an audio file.' : 'Could not start the microphone. Check that it is connected and not in use.'); setState('idle');
    }
  }
  function pause() { if (recorder.current?.state !== 'recording') return; recorder.current.pause(); elapsed.current = elapsedNow(); runningSince.current = 0; setSeconds(elapsed.current); setState('paused'); }
  function resume() { if (recorder.current?.state !== 'paused') return; recorder.current.resume(); runningSince.current = Date.now(); setState('recording'); }
  function reset() { release(); recorder.current = null; chunks.current = []; runningSince.current = 0; elapsed.current = 0; setFile(null); setSeconds(0); setError(''); setState('idle'); }
  return { state, file, seconds, error, start, pause, resume, stop, reset };
}
