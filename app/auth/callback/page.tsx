'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase/browser';
export default function Callback() {
  const router = useRouter(); const started = useRef(false); const [error, setError] = useState('');
  useEffect(() => {
    if (started.current) return; started.current = true;
    const url = new URL(window.location.href); const code = url.searchParams.get('code');
    const recovery = url.searchParams.get('next') === 'reset';
    window.history.replaceState({}, '', '/auth/callback');
    const supabase = getSupabase();
    if (!supabase || !code || url.searchParams.has('error')) { setError('This account link could not be completed. Please request a new link.'); return; }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setError('This link expired or was opened in a different browser. Request a new link and open it in the browser where you started.');
      else router.replace(recovery ? '/auth/reset-password' : '/');
    }).catch(() => setError('Could not connect. Please check your connection and request a new link.'));
  }, [router]);
  return <section className="card"><h1>Confirming your account</h1>{error ? <><p className="error" role="alert">{error}</p><Link href="/">Return to sign in</Link></> : <p role="status">Completing your account link…</p>}</section>;
}
