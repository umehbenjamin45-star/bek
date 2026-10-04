'use client';
import { useState } from 'react';
import { AuthGate } from '@/components/auth-provider';
import { useTranscripts } from '@/hooks/use-transcripts';
import { filterTranscripts } from '@/lib/transcripts';
import { TranscriptList } from '@/components/transcript-list';
function History() {
  const { items, loading, error, refresh } = useTranscripts(); const [query, setQuery] = useState('');
  const filtered = filterTranscripts(items, query);
  return <><div className="page-heading"><p className="eyebrow">YOUR WORDS, KEPT TOGETHER</p><h1>History</h1><p>Pick up where you left off.</p></div><label className="search-label" htmlFor="search">Search transcripts</label><input id="search" type="search" className="search" placeholder="Search titles and transcript text…" value={query} onChange={event => setQuery(event.target.value)} />{loading ? <p role="status">Loading history…</p> : error ? <div role="alert" className="error">{error} <button onClick={() => void refresh()}>Retry</button></div> : filtered.length ? <TranscriptList items={filtered} /> : <div className="empty"><h3>{query ? 'No matching transcripts' : 'No transcripts yet'}</h3><p>{query ? 'Try another word or phrase.' : 'Your saved transcripts will appear here.'}</p></div>}</>;
}
export default function Page() { return <AuthGate><History /></AuthGate>; }
