'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { PasswordAuth } from './password-auth';
import { getSupabase } from '@/lib/supabase/browser';
type AuthState = { session: Session | null; loading: boolean; error: string; configured: boolean };
const Context = createContext<AuthState>({ session: null, loading: true, error: '', configured: false });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(false);
  useEffect(() => {
    const supabase = getSupabase();
    setConfigured(!!supabase);
    if (!supabase) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setSession(data.session); setError(error ? 'Could not restore your session. Please sign in again.' : ''); setLoading(false);
    }).catch(() => { if (active) { setError('Could not connect to authentication. Check your connection.'); setLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setLoading(false); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return <Context.Provider value={{ session, loading, error, configured }}>{children}</Context.Provider>;
}
export const useAuth = () => useContext(Context);
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, configured, error } = useAuth();
  if (loading) return <div className="empty" role="status">Loading your account…</div>;
  if (!configured) return <section className="card welcome"><p className="eyebrow">SETUP REQUIRED</p><h1>Connect your Supabase project</h1><p>Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the server environment, apply the database migration, and enable email/password sign-in. Restart the app afterward.</p><p>See the repository README for the exact steps. No demo data is used.</p></section>;
  if (!session) return <PasswordAuth initialError={error} />;
  return <div key={session.user.id}>{children}</div>;
}
