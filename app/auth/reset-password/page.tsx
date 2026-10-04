'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { getSupabase } from '@/lib/supabase/browser';
import { validatePassword, authErrorMessage } from '@/lib/account';
export default function ResetPassword() {
  const { session, loading } = useAuth(); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [done, setDone] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); setError('');
    const invalid = validatePassword(password); if (invalid) { setError(invalid); return; }
    if (password !== confirmation) { setError('Your passwords do not match.'); return; }
    setBusy(true);
    try {
      const { error } = await getSupabase()!.auth.updateUser({ password });
      if (error) { setError(error.code === 'same_password' ? 'Choose a different password from your current one.' : authErrorMessage(error.code)); return; }
      setPassword(''); setConfirmation(''); setDone(true);
    } catch { setError('Could not update your password. Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">Checking your account…</p>;
  if (done) return <section className="card welcome"><h1>Password updated</h1><p>Your new password is saved securely by Supabase.</p><Link href="/">Return home</Link></section>;
  if (!session) return <section className="card welcome"><h1>Request a reset link</h1><p>Open a current password-reset email, or sign in before changing your password.</p><Link href="/">Return to sign in</Link></section>;
  return <section className="card welcome"><h1>Choose a new password</h1><form className="auth-form" onSubmit={save}><label htmlFor="new-password">New password</label><input id="new-password" name="password" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} maxLength={128} required disabled={busy} /><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} minLength={12} maxLength={128} required disabled={busy} /><button disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button></form>{error && <p className="error" role="alert">{error}</p>}</section>;
}
