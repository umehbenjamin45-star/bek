export type Transcript = {
  id: string; user_id: string; title: string; transcript_text: string;
  audio_reference: string | null; duration: number | null;
  created_at: string; updated_at: string;
};
