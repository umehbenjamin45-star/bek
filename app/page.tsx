'use client';
import Link from 'next/link';
import { AuthGate } from '@/components/auth-provider';
import { useTranscripts } from '@/hooks/use-transcripts';
import { TranscriptList } from '@/components/transcript-list';
function Home() {
  const { items, loading, error, refresh } = useTranscripts();
  return <><div className="page-heading"><p className="eyebrow">YOUR PERSONAL WORKSPACE</p><h1>Make room for your words.</h1><p>Capture a thought. Let your voice do the writing.</p></div><div className="actions-grid"><Link href="/record" className="action-card"><span className="action-icon" aria-hidden="true">●</span><h2>New recording</h2><p>Speak freely. We’ll take it from here.</p><span className="action-link">Start recording <span aria-hidden="true">→</span></span></Link><Link href="/record?mode=upload" className="action-card"><span className="action-icon outline" aria-hidden="true">↑</span><h2>Upload audio</h2><p>Bring an existing recording with you.</p><span className="action-link">Choose an audio file <span aria-hidden="true">→</span></span></Link></div><section className="recent"><div className="section-heading"><h2>Recent transcripts</h2><Link href="/history">View history <span aria-hidden="true">→</span></Link></div>{loading ? <p role="status">Loading transcripts…</p> : error ? <div className="error" role="alert">{error} <button className="secondary" onClick={() => void refresh()}>Retry</button></div> : items.length ? <TranscriptList items={items.slice(0, 5)} /> : <div className="empty"><span className="empty-symbol" aria-hidden="true">≡</span><h3>Your first words belong here.</h3><p>Record or upload audio to create your first transcript.</p></div>}</section></>;
}
export default function Page() { return <AuthGate><Home /></AuthGate>; }
