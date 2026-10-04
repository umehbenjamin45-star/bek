import { getSupabase } from './supabase/browser';
import type { Transcript } from './types';
export async function listTranscripts(userId: string): Promise<Transcript[]> {
  const { data, error } = await getSupabase()!.from('transcripts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw new Error('Could not load your transcripts. Check your connection and try again.');
  return data as Transcript[];
}
export async function getTranscript(id: string, userId: string): Promise<Transcript> {
  const { data, error } = await getSupabase()!.from('transcripts').select('*').eq('id', id).eq('user_id', userId).single();
  if (error || !data) throw new Error('This transcript is unavailable, or you do not have access to it.');
  return data as Transcript;
}
export async function saveTranscript(id: string, userId: string, title: string, text: string, expectedUpdatedAt: string): Promise<Transcript> {
  const { data, error } = await getSupabase()!.from('transcripts').update({ title: title.trim() || 'Untitled transcript', transcript_text: text }).eq('id', id).eq('user_id', userId).eq('updated_at', expectedUpdatedAt).select().maybeSingle();
  if (error) throw new Error('Your changes could not be saved. Keep this page open and retry.');
  if (!data) throw new Error('This transcript changed on another device or was deleted. Copy your edits before reloading to review the latest version.');
  return data as Transcript;
}
export function filterTranscripts(items: Transcript[], search: string): Transcript[] {
  const query = search.trim().toLocaleLowerCase();
  return items.filter(item => `${item.title}\n${item.transcript_text}`.toLocaleLowerCase().includes(query));
}
export function exportText(title: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `${title.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 80) || 'transcript'}.txt`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
