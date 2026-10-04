import { getSupabase } from './supabase/browser';
import { AUDIO_BUCKET, audioPath } from './audio';
export async function uploadAudio(userId: string, file: File): Promise<string> {
  const path = audioPath(userId, crypto.randomUUID(), file.name);
  const { error } = await getSupabase()!.storage.from(AUDIO_BUCKET).upload(path, file, { contentType: file.type.split(';')[0] || 'application/octet-stream', upsert: false });
  if (error) throw new Error('Audio upload failed. Check your connection and storage configuration, then retry. Your audio is still available.');
  return path;
}
export async function removeAudio(path: string): Promise<void> {
  const { error } = await getSupabase()!.storage.from(AUDIO_BUCKET).remove([path]);
  if (error) throw new Error('Could not remove the audio from storage. Please retry before leaving this page.');
}
