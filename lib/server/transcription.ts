import 'server-only';
export class TranscriptionError extends Error {}
export interface SpeechProvider { transcribe(audio: Blob, filename: string): Promise<string> }
class ConfiguredSpeechProvider implements SpeechProvider {
  async transcribe(audio: Blob, filename: string): Promise<string> {
    const provider = process.env.TRANSCRIPTION_PROVIDER || 'groq';
    if (provider !== 'groq' && provider !== 'openai') throw new TranscriptionError('The transcription provider is not supported.');
    const groq = provider === 'groq';
    const key = groq ? process.env.GROQ_API_KEY : process.env.TRANSCRIPTION_API_KEY;
    if (!key) throw new TranscriptionError(groq ? 'Free-tier transcription is not configured. Add GROQ_API_KEY in secure environment settings.' : 'Speech-to-text is not configured. Add the server API key in environment settings.');
    if (groq && audio.size > 25_000_000) throw new TranscriptionError('Groq free-tier audio must be smaller than 25 MB. Choose a smaller file.');
    const form = new FormData();
    form.append('file', audio, filename);
    form.append('model', groq ? (process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo') : (process.env.TRANSCRIPTION_MODEL || 'whisper-1'));
    let response: Response;
    try {
      response = await fetch(groq ? 'https://api.groq.com/openai/v1/audio/transcriptions' : 'https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form,
        signal: AbortSignal.timeout(120_000),
      });
    } catch { throw new TranscriptionError('The transcription service could not be reached. Your audio is still available; please retry.'); }
    if (!response.ok) throw new TranscriptionError(response.status === 429 ? 'The transcription limit has been reached. Your audio is still available; please retry after the limit resets.' : 'The transcription service could not process this audio. Please retry or choose another file.');
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('text' in result) || typeof result.text !== 'string' || !result.text.trim()) throw new TranscriptionError('No speech was detected. Try a clearer recording.');
    return result.text.trim();
  }
}
// Future providers implement this interface; routes and clients remain unchanged.
export function transcribeAudio(audio: Blob, filename: string, provider: SpeechProvider = new ConfiguredSpeechProvider()): Promise<string> {
  return provider.transcribe(audio, filename);
}
