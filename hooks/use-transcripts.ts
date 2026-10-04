'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { getSupabase } from '@/lib/supabase/browser';
import { listTranscripts } from '@/lib/transcripts';
import type { Transcript } from '@/lib/types';
export function useTranscripts() {
  const { session } = useAuth(); const id = session?.user.id;
  const [items, setItems] = useState<Transcript[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (!id) return;
    const request = ++version.current;
    try { const data = await listTranscripts(id); if (version.current === request) { setItems(data); setError(''); } }
    catch (error) { if (version.current === request) setError((error as Error).message); }
    finally { if (version.current === request) setLoading(false); }
  }, [id]);
  useEffect(() => {
    if (!id) return;
    void refresh();
    const supabase = getSupabase()!;
    const channel = supabase.channel(`transcripts-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transcripts', filter: `user_id=eq.${id}` }, () => { void refresh(); }).subscribe();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    // Fallback for brief disconnections and DELETE events with RLS.
    const timer = setInterval(onFocus, 30_000);
    return () => { ++version.current; void supabase.removeChannel(channel); window.removeEventListener('focus', onFocus); clearInterval(timer); };
  }, [id, refresh]);
  return { items, loading, error, refresh };
}
