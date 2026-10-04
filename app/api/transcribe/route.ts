import { authenticate } from '@/lib/server/auth';
import { transcribeAudio, TranscriptionError } from '@/lib/server/transcription';
import { AUDIO_BUCKET, hasAudioSignature, ownsAudioPath, validateAudio } from '@/lib/audio';
export const runtime = 'nodejs';
export const maxDuration = 180;
const fail = (message: string, status: number) => Response.json({ error: message }, { status });
export async function POST(request: Request) {
  try {
    const auth = await authenticate(request);
    if (auth.error) return fail(auth.error, auth.status);
    if (Number(request.headers.get('content-length') || 0) > 4096) return fail('The request is too large.', 413);
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return fail('Send a JSON transcription request.', 415);
    let body: { audio_reference?: unknown; duration?: unknown };
    try {
      const reader = request.body?.getReader();
      if (!reader) return fail('Invalid transcription request.', 400);
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) { await reader.cancel(); return fail('The request is too large.', 413); }
        chunks.push(value);
      }
      body = JSON.parse(await new Blob(chunks as BlobPart[]).text());
    } catch { return fail('Invalid transcription request.', 400); }
    if (!body || typeof body.audio_reference !== 'string' || !ownsAudioPath(auth.user.id, body.audio_reference)) return fail('Choose an audio file belonging to your account.', 400);
    if (body.duration != null && (typeof body.duration !== 'number' || !Number.isFinite(body.duration) || body.duration < 0 || body.duration > 86400)) return fail('Invalid recording duration.', 400);
    const path = body.audio_reference;
    const { data: existing, error: lookupError } = await auth.supabase.from('transcripts').select('*').eq('audio_reference', path).maybeSingle();
    if (lookupError) return fail('Could not access your transcripts. Check the database setup and retry.', 503);
    if (existing) return Response.json({ transcript: existing });
    const { data: audio, error: downloadError } = await auth.supabase.storage.from(AUDIO_BUCKET).download(path);
    if (downloadError || !audio) return fail('Could not retrieve your audio. Upload it again and retry.', 400);
    const filename = path.split('/').pop()!;
    const fileError = validateAudio({ name: filename, size: audio.size, type: audio.type === 'application/octet-stream' ? '' : audio.type });
    if (fileError) return fail(fileError, 400);
    if (!hasAudioSignature(new Uint8Array(await audio.slice(0, 16).arrayBuffer()), filename.split('.').pop()!)) return fail('This file does not contain a supported audio format.', 400);
    const text = await transcribeAudio(audio, filename);
    const { data, error } = await auth.supabase.from('transcripts').insert({ user_id: auth.user.id, title: 'Untitled transcript', transcript_text: text, audio_reference: path, duration: body.duration ?? null }).select().single();
    if (error?.code === '23505') {
      const { data: saved } = await auth.supabase.from('transcripts').select('*').eq('audio_reference', path).single();
      if (saved) return Response.json({ transcript: saved });
    }
    if (error || !data) return fail('Transcription finished, but saving failed. Your audio is preserved; retry to save it.', 503);
    return Response.json({ transcript: data }, { status: 201 });
  } catch (error) {
    if (error instanceof TranscriptionError) return fail(error.message, 502);
    return fail('Something went wrong. Your audio is preserved; please retry.', 503);
  }
}
