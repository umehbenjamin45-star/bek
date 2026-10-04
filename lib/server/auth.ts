import 'server-only';
import { createClient } from '@supabase/supabase-js';
export async function authenticate(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get('authorization');
  if (!url || !key) return { error: 'Authentication is not configured.', status: 503 } as const;
  if (!authorization?.startsWith('Bearer ')) return { error: 'Please sign in to transcribe audio.', status: 401 } as const;
  const token = authorization.slice(7);
  // Use the user's JWT, never a service-role key. Database and storage RLS still apply.
  const supabase = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: 'Your session expired. Please sign in again.', status: 401 } as const;
  return { supabase, user: data.user } as const;
}
