'use client';
import Link from 'next/link';
import type { Transcript } from '@/lib/types';
export function TranscriptList({ items }: { items: Transcript[] }) {
  return <div className="transcript-list">{items.map(item => <Link className="transcript-row" href={`/transcripts/${item.id}`} key={item.id}><span className="document-icon" aria-hidden="true">≡</span><div><h3>{item.title}</h3><p>{item.transcript_text.slice(0, 130) || 'Empty transcript'}</p><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></div><span className="row-arrow" aria-hidden="true">↗</span></Link>)}</div>;
}
