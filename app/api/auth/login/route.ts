import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { authErrorMessage, normalizeUsername } from '@/lib/account';
export const runtime = 'nodejs';
const reply = (data: unknown, status: number) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
// Resolve usernames only on the server; never expose an email lookup endpoint.
export async function POST(request: Request) {
  try {
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return reply({ error:'Send a JSON sign-in request.' }, 415);
    const reader = request.body?.getReader(); if (!reader) return reply({ error:'Enter your username/email and password.' }, 400);
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 4096) { await reader.cancel(); return reply({ error:'The request is too large.' }, 413); } chunks.push(value); }
    let body: { identifier?: unknown; password?: unknown };
    try { body = JSON.parse(await new Blob(chunks as BlobPart[]).text()); } catch { return reply({ error:'Invalid sign-in request.' }, 400); }
    if (!body || typeof body.identifier !== 'string' || typeof body.password !== 'string' || !body.password || body.password.length > 128 || body.identifier.length > 254) return reply({ error:'Enter your username/email and password.' }, 400);
    const identifier = body.identifier.trim();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !publicKey) return reply({ error:'Authentication is not configured.' }, 503);
    let email = identifier; let usernameFound = true;
    if (!identifier.includes('@')) {
      const username = normalizeUsername(identifier);
      if (!/^[a-z][a-z0-9_]{2,39}$/.test(username)) return reply({ error:authErrorMessage() }, 401);
      const serverKey = process.env.SUPABASE_SERVER_KEY;
      if (!serverKey) return reply({ error:'Username sign-in is not configured yet. Sign in with your email instead.' }, 503);
      // This privileged client is used only for username resolution. Transcript/storage
      // endpoints continue to use user JWTs and RLS, never this administrative key.
      const admin = createClient(url, serverKey, { auth: { persistSession:false, autoRefreshToken:false } });
      const { data: profile, error } = await admin.from('profiles').select('user_id').eq('username', username).maybeSingle();
      if (error) return reply({ error:'Username sign-in is unavailable. Sign in with your email or check the account migration.' }, 503);
      if (profile) {
        const { data, error: userError } = await admin.auth.admin.getUserById(profile.user_id);
        if (userError) return reply({ error:'Sign-in is temporarily unavailable. Please retry.' }, 503);
        email = data.user?.email || '';
      } else email = '';
      // Still make a password grant on an unknown username so missing names use
      // Supabase's failed-attempt rate limits and the same public failure message.
      if (!email) { usernameFound = false; email = 'unregistered-account@users.invalid'; }
    }
    const auth = createClient(url, publicKey, { auth: { persistSession:false, autoRefreshToken:false } });
    const { data, error } = await auth.auth.signInWithPassword({ email, password: body.password });
    if (!usernameFound || error || !data.session) return reply({ error:authErrorMessage(error?.code) }, error?.status === 429 ? 429 : 401);
    return reply({ session: { access_token:data.session.access_token, refresh_token:data.session.refresh_token } }, 200);
  } catch { return reply({ error:'Could not connect to sign-in. Please check your connection and try again.' }, 503); }
}
