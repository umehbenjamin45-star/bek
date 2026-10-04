'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGate, useAuth } from '@/components/auth-provider';
import { getSupabase } from '@/lib/supabase/browser';
function Settings() {
  const { session } = useAuth(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState(session?.user.user_metadata.username || '');
  useEffect(() => {
    let active = true;
    getSupabase()!.from('profiles').select('username').eq('user_id', session!.user.id).maybeSingle().then(({ data }) => { if (active && data) setUsername(data.username); });
    return () => { active = false; };
  }, [session]);
  async function signOut() {
    setBusy(true); setError('');
    try { const { error } = await getSupabase()!.auth.signOut({ scope: 'local' }); if (error) setError('Could not sign out. Please try again.'); }
    catch { setError('Could not sign out. Please check your connection.'); }
    finally { setBusy(false); }
  }
  return <><div className="page-heading"><p className="eyebrow">ACCOUNT</p><h1>Settings</h1><p>One account for all your words.</p></div><section className="card"><h2>Your account</h2><dl><dt>Username</dt><dd>{username || 'Not assigned yet'}</dd><dt>Email</dt><dd>{session?.user.email}</dd></dl><p className="muted">Transcripts are stored securely in your shared Supabase account.</p><p><Link href="/auth/reset-password">Change password</Link></p><button className="secondary" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>{error && <p role="alert" className="error">{error}</p>}</section></>;
}
export default function Page() { return <AuthGate><Settings /></AuthGate>; }
