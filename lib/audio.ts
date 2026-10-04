export const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
export const AUDIO_BUCKET = 'recordings';
export const AUDIO_ACCEPT = '.mp3,.mp4,.m4a,.mpeg,.mpga,.wav,.webm';
const extensions = new Set(['mp3', 'mp4', 'm4a', 'mpeg', 'mpga', 'wav', 'webm']);
const types = new Set(['application/octet-stream', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'video/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/webm', 'video/webm']);
export function validateAudio(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (!file.size) return 'This audio file is empty. Choose another file.';
  if (file.size > MAX_AUDIO_BYTES) return 'Choose an audio file smaller than 24 MB.';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!extensions.has(ext) || (file.type && !types.has(file.type.split(';')[0]))) return 'Use an MP3, MP4, M4A, MPEG, WAV, or WebM audio file.';
  return null;
}
export function hasAudioSignature(bytes: Uint8Array, extension: string): boolean {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length < 12) return false;
  switch (extension) {
    case 'wav': return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE';
    case 'webm': return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    case 'm4a': case 'mp4': return ascii(4, 8) === 'ftyp';
    case 'mp3': case 'mpga': case 'mpeg': return ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    default: return false;
  }
}
export function formatDuration(seconds: number): string {
  const total = Math.floor(Math.max(0, seconds));
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}
export function audioPath(userId: string, id: string, name: string): string {
  return `${userId}/${id}.${name.split('.').pop()!.toLowerCase()}`;
}
export function ownsAudioPath(userId: string, path: string): boolean {
  return new RegExp(`^${userId}/[0-9a-f-]{36}\\.(mp3|mp4|m4a|mpeg|mpga|wav|webm)$`).test(path);
}
