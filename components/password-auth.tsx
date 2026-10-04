'use client';
import { useState, type FormEvent } from 'react';
import { getSupabase } from '@/lib/supabase/browser';
import { authErrorMessage, normalizeUsername, validatePassword, validateUsername } from '@/lib/account';
type Mode = 'signin' | 'signup' | 'reset';
export function PasswordAuth({ initialError = '' }: { initialError?: string }) {
  const [mode, setMode] = useState<Mode>('signin'); const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState(''); const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(initialError); const [notice, setNotice] = useState('');
  function switchMode(next: Mode) { setMode(next); setError(''); setNotice(''); setPassword(''); setConfirmation(''); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setError(''); setNotice('');
    if (mode === 'signup') {
      const invalid = validateUsername(username) || validatePassword(password);
      if (invalid) { setError(invalid); return; }
      if (password !== confirmation) { setError('Your passwords do not match. Please enter them again.'); return; }
    }
    setBusy(true);
    try {
      const supabase = getSupabase()!;
      if (mode === 'signin') {
        const response = await fetch('/api/auth/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ identifier: identifier.trim(), password }) });
        const result = await response.json();
        if (!response.ok) { setError(result.error || 'Sign-in failed. Please retry.'); return; }
        const { error } = await supabase.auth.setSession(result.session);
        if (error) { setError('Could not restore your account session. Please try signing in again.'); return; }
        setPassword('');
      } else if (mode === 'signup') {
        const { data: ready, error: setupError } = await supabase.rpc('password_accounts_ready');
        if (setupError || ready !== true) { setError('Account creation is not ready yet. Complete the Supabase account setup before creating an account.'); return; }
        const { data, error } = await supabase.auth.signUp({ email:email.trim(), password, options:{ data:{ username:normalizeUsername(username) }, emailRedirectTo:`${window.location.origin}/auth/callback` } });
        if (error) { setError(authErrorMessage(error.code, true)); return; }
        setPassword(''); setConfirmation('');
        if (!data.session) setNotice('Check your email to confirm your account, then sign in. If you already have an account, sign in or reset your password.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo:`${window.location.origin}/auth/callback?next=reset` });
        if (error) { setError('Could not send the reset email. Please wait a moment and try again.'); return; }
        setNotice('If an account exists for this email, you will receive a password-reset link. Check your inbox and spam folder.');
      }
    } catch { setError('Could not connect. Check your internet connection and try again.'); }
    finally { setBusy(false); }
  }
  return <section className="card welcome"><p className="eyebrow">YOUR WORDS, IN WRITING</p><h1>{mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome to Bek'}</h1><p>{mode === 'signup' ? 'Choose a username and password. Your email keeps your account recoverable.' : mode === 'reset' ? 'Enter your account email and we’ll send a reset link.' : 'Sign in to record, transcribe, and keep your words together.'}</p><form className="auth-form" onSubmit={submit}>
    {mode === 'signin' ? <><label htmlFor="identifier">Username or email</label><input id="identifier" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={identifier} onChange={event => setIdentifier(event.target.value)} maxLength={254} required disabled={busy} /></> : <>
      {mode === 'signup' && <><label htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={event => setUsername(event.target.value)} minLength={3} maxLength={30} required disabled={busy} /><p className="small muted">3–30 characters: letters, numbers, or underscores. Start with a letter.</p></>}
      <label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required disabled={busy} /></>}
    {mode !== 'reset' && <><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={mode === 'signup' ? 12 : undefined} maxLength={128} required disabled={busy} />{mode === 'signup' && <><p className="small muted">At least 12 characters. Your browser can offer to save it.</p><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} minLength={12} maxLength={128} required disabled={busy} /></>}</>}
    <button type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
  </form>{error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}<div className="auth-links">{mode === 'signin' ? <><button className="text-button" disabled={busy} onClick={() => switchMode('signup')}>Create an account</button><button className="text-button" disabled={busy} onClick={() => switchMode('reset')}>Forgot password?</button></> : <button className="text-button" disabled={busy} onClick={() => switchMode('signin')}>Back to sign in</button>}</div><p className="muted small">Your transcripts and audio are private to your account.</p></section>;
}
