# Bek — personal voice to text

Phase 1: a Next.js / TypeScript web application with one shared Supabase backend. No native mobile application, payments, summaries, or mock application data.

The implemented workflow is **record or upload → private audio upload → server-side transcription → editor → save → history**. Completed transcriptions are saved immediately; title and text edits autosave after 1.5 seconds and can also be saved manually. Audio is kept after failures for retry. Only Supabase stores permanent transcripts.

## Free-tier transcription

Create a key at https://console.groq.com/keys and add it securely as `GROQ_API_KEY`. The default provider is Groq; no OpenAI credits are needed. Keep the Groq account on its Free plan. Limits apply and may change: the current published Whisper limits are 20 requests/minute, 2,000 requests/day, 7,200 audio seconds/hour, and 28,800 audio seconds/day, shared across the organization. See https://console.groq.com/docs/rate-limits and your account limits. A limit error retains audio for retry and does not switch to a paid provider. Free-tier uploads are capped at 25 MB; a file near the app’s 24 MiB ceiling may need reducing slightly. Audio is sent to Groq for recognition; Supabase continues storing the account, audio, and transcript.

Free-tier cloud services are subject to quotas and changing terms; this does not promise unlimited, permanently free hosting or transcription.

## Prerequisites and configuration

Use Node.js 22 or newer (tested here with Node 24) and npm. Install with `npm ci`. In this cloud machine, use `npm ci --cache /tmp/bek-npm-cache` because the home directory is read-only.

Copy `.env.example` to `.env.local` **only if it does not already exist**, then fill it locally. Alternatively, configure these variables in your hosting platform / cloud environment settings. Never commit the file or put private keys into chat.

| Variable | Where to obtain it | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API / Connect | Public project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page: publishable key or legacy `anon` key | Public; RLS protects data |
| `SUPABASE_SERVER_KEY` | Supabase project → Settings → API Keys: secret key or legacy `service_role` | Server only; private username-to-account lookup |
| `TRANSCRIPTION_PROVIDER` | Defaults to `groq`; OpenAI requires explicitly setting `openai` | Server configuration |
| `GROQ_API_KEY` | Groq Console → API Keys; keep the account on the Free plan | Server only |
| `GROQ_TRANSCRIPTION_MODEL` | Optional, defaults to `whisper-large-v3-turbo` | Server configuration |
| `TRANSCRIPTION_API_KEY` / `TRANSCRIPTION_MODEL` | Optional paid OpenAI configuration; ignored for Groq | Server only |

Do **not** use a Supabase secret or service-role key in the public key variable. The optional server key is used only by the private username sign-in endpoint. Never prefix it with `NEXT_PUBLIC_`. Email/password sign-in works without it; username sign-in requires it. Transcript and storage endpoints continue to use the authenticated user JWT and RLS. Groq credentials are sent only to `api.groq.com`. Optional OpenAI credentials are sent only to `api.openai.com`. There is no automatic fallback to OpenAI.

Cloud draft requirements and reusable installation/startup instructions have been saved, including a separate `GROQ_API_KEY` binding for `api.groq.com`. The Supabase project is configured. Draft saving does not apply values, run migrations, or publish the environment.

Required network destinations: your exact Supabase project host (normally `<project-ref>.supabase.co`) for Auth, REST, Storage and Realtime; `api.groq.com` for transcription (or `api.openai.com` only if explicitly using OpenAI); and the npm registry for installation. Google credentials and Google Cloud setup are no longer required.

Public Next.js variables are compiled into browser bundles. Restart development after changing them; rebuild production after changing them. Configure actual values before building/deploying production.

### Supabase database and storage

Create one Supabase project for both web and future mobile clients. Run `supabase/migrations/202610040001_initial.sql` **once** in that project's SQL editor, or link the Supabase CLI and use `supabase db push`. This creates:

- `public.transcripts` with UUID ownership, creation/update timestamps, and indexes;
- owner-only select/insert/update/delete RLS policies;
- a private `recordings` bucket, a 24 MB upload limit, and owner-folder storage policies;
- a timestamp trigger and Supabase Realtime publication membership.

The migration requires a normal Supabase project with Auth, Storage, and `supabase_realtime` available. It is not an idempotent SQL script to paste repeatedly. CLI migrations track execution for you.

### Username / password accounts (replaces Google)

1. In Supabase → Authentication → Sign In / Providers, keep **Email** enabled and enable new user sign-ups. Email/password is already enabled on the configured project, as verified by its live Auth settings endpoint.
2. Run `supabase/migrations/202610040002_password_accounts.sql` once in the SQL editor (or apply it with `supabase db push`). If you already ran the original transcript migration, do not rerun that file. This additive migration creates owner-readable usernames and an Auth registration trigger without changing existing accounts, transcripts or audio.
3. For **username** sign-in, enter a Supabase server secret key (or legacy `service_role` key) as `SUPABASE_SERVER_KEY` in secure cloud environment settings. Obtain it from Supabase → Settings → API Keys. It stays on the Next.js server and is never part of the browser bundle. Email sign-in remains available if this key has not been configured.
4. In Supabase → Authentication → URL Configuration, set the Site URL to the actual app origin. Allow the app's `/auth/callback` and `/auth/callback?next=reset` URLs for confirmation and recovery. Include your development origin when developing locally. No Google OAuth client or callback is involved.
5. Create an account in Bek with a username, a real email and a password of at least 12 characters. Confirm the email using the same browser where you registered, then sign in using the username **or email** and password. Browser password-manager autocomplete is supported; the app never stores plaintext passwords.
6. Forgot password sends a Supabase recovery email. Follow that link in the same browser and save a new password. Settings also contains a Change password link.

Supabase owns password hashing, verification, sessions, and recovery. The profile table contains **no passwords or emails**. Usernames are unique and case-insensitive (lowercase canonical form), begin with a letter, and use 3–30 letters, numbers or underscores. Usernames are immutable in this phase. Unauthenticated clients cannot enumerate username/email mappings. Login errors do not expose a user's email.

Existing accounts keep their Supabase UUID and data. The migration assigns an existing account a `user_<uuid-without-dashes>` username; use its original email and password recovery to set a password, then Settings shows its username. Do not register a new account with a different email if you want to retain the original identity.

Supabase's default email service has delivery restrictions and low rate limits. For sending confirmation/recovery emails to addresses beyond those supported by the default service, configure a trusted SMTP provider in Supabase. Mail delivery is a hosted configuration prerequisite; the app cannot bypass it. Do not disable email verification merely to make a test pass.

### Cloud proxy runtime

This cloud environment injects `HTTP_PROXY` / `HTTPS_PROXY` and its trusted CA. On Node 24, start the server with `NODE_USE_ENV_PROXY=1` so server-side Supabase and transcription requests use that route. The reusable environment draft declares this variable. For manual shell startup, use `NODE_USE_ENV_PROXY=1 npm run dev` (or the equivalent for `npm start`). Do not disable TLS or certificate verification. The live Supabase Auth settings check passed through this supported proxy route.

## Run

```sh
npm ci --cache /tmp/bek-npm-cache
npm run dev
```

Next.js defaults to port 3000. Microphone capture requires HTTPS or a browser-trusted loopback development origin. Use a supported current Chrome, Edge, Firefox, or Safari browser; upload is available when microphone recording is unsupported. If prompted, grant microphone access.

Production:

```sh
npm run build
npm start
```

The transcription endpoint uses Node.js and may run for up to 180 seconds. Choose a host that supports that request duration; short serverless timeouts can interrupt long transcription requests. Uploading goes directly to private Supabase Storage, so large files do not pass through Next.js request-body limits.

## Shared backend contract for future Expo clients

Use the **same project URL, public key, Supabase user ID, tables, and private bucket**. Native account confirmation/recovery deep-link configuration belongs to a later phase; no separate mobile database is needed.

1. Register through Supabase Email Auth with `options.data.username`, or sign in with email/password. To sign in with a username, call `POST /api/auth/login` with JSON `{ "identifier": "chosen_username", "password": "..." }`; securely establish the returned Supabase access/refresh token session in your client. Supabase password rules, confirmation and rate limits still apply. Obtain the user access token from that session.
2. Upload supported audio to `recordings/<user-uuid>/<random-uuid>.<extension>` using the authenticated Supabase client. Supported extensions: mp3, mp4, m4a, mpeg, mpga, wav, webm. Maximum size: 24 MB.
3. Call `POST /api/transcribe` on this deployed backend with `Authorization: Bearer <supabase-access-token>` and JSON `{ "audio_reference": "<user-uuid>/<audio-uuid>.wav", "duration": 12.5 }`. Duration may be null for uploaded audio.
4. The server verifies the user through Supabase Auth, downloads through that user's storage RLS, validates file size/type/container signature, calls `transcribeAudio()`, then inserts the canonical transcript. It never accepts a client-supplied owner or arbitrary download URL.
5. Success returns `{ "transcript": { ... } }`. Failures return a safe `{ "error": "..." }` message and retain the audio. Retrying an already-saved audio reference returns the existing transcript. Concurrent attempts may still call the speech provider twice, but the unique constraint prevents duplicate saved records.
6. Read and edit `transcripts` through the authenticated Supabase client. For edits, match both ID and last-seen `updated_at`; no matching row means a conflict or deletion. Web autosave stops rather than silently overwriting a newer device's changes.
7. Subscribe to Supabase Realtime and refetch the database on changes/reconnect/focus. The web also refreshes every 30 seconds to recover missed events, including deletions. Transcripts are not permanently cached in browser storage.

The speech adapter lives in `lib/server/transcription.ts`. Another provider implements `SpeechProvider`; no UI or database redesign is required. The key is never sent to the browser. Original audio playback uses short-lived signed URLs, not public audio URLs.

## Validation

```sh
npm run typecheck
npm test
npm run test:browser
npm run build
```

Browser tests require Chromium: this cloud machine provides `/usr/bin/chromium`. Else run `npx playwright install chromium` or set `CHROMIUM_EXECUTABLE` to an installed binary. Browser tests use a separate `.next-browser` build directory and launch a dedicated test server on port 3100. Their fake microphone is Chromium's generated test audio, and external services are explicitly intercepted **only in tests**.

- Unit tests cover file validation, signatures, storage ownership, duration formatting, history search and TXT bytes.
- Security tests execute the actual migration's table, trigger and policies in PGlite PostgreSQL with two users and an anonymous role. Hosted Auth/Storage infrastructure is represented by minimal schemas; hosted publication setup is not exercised by PGlite.
- Server tests exercise authentication, owned references, malformed audio, multipart provider calls, provider/save errors, and idempotent retry using external HTTP fixtures.
- Browser tests exercise real browser MediaRecorder start/pause/resume/stop, upload rejection, retained-audio retries, editing/autosave, history search, actual TXT downloads and a mobile viewport. Supabase authentication/database and speech responses are fixtures in these tests.

Current-instance results: production build and type checking passed; 36 unit/server/security tests and all 11 browser tests passed; the production server rendered the configuration-required screen without browser errors; the production dependency audit reported zero vulnerabilities.

These automated checks do **not** establish working live password registration, login, email confirmation/recovery, your hosted Supabase configuration, actual acoustic recognition, or your speech-provider billing/access. The configured Supabase public connection now works through the cloud proxy and reports Email Auth enabled with email confirmation required. The private username lookup key and hosted profile migration remain prerequisites; no real user password is available for live account tests. Those live requirements remain pending, so Phase 1 is not declared complete.

### Live acceptance checklist after configuration

Use a real microphone and a short supported audio file with known spoken words.

- Create a real username/email/password account, confirm its email, sign in with username and with email, and confirm Settings shows your account. Test wrong-password errors and recovery email delivery.
- Record, pause, resume, stop, and play the recording. Deny permission once and check the useful error message.
- Transcribe the recording and verify the returned text matches what you said.
- Upload the known file and verify a real transcription; try an unsupported file and an oversize file.
- Temporarily interrupt networking or the provider configuration; verify audio remains available and Retry succeeds after restoring it.
- Edit title and text; verify manual save and autosave survive reload.
- Copy text and export TXT; inspect the downloaded bytes.
- Open History, search by title and text, and reopen the saved transcript.
- Sign out and sign in again; verify the same records return from Supabase.
- Open a second browser/device with the same account; verify changes propagate and concurrent stale edits show a conflict instead of overwriting data.
- With a second authenticated user, attempt direct reads/updates/deletes of the first user's IDs and audio paths; verify RLS denies access on the hosted project too.
- Delete a transcript and verify its audio is removed. If storage deletion fails after the transcript is deleted, use the provided audio-cleanup retry before leaving.

Uploaded audio from an abandoned failed attempt can remain in private storage if the tab is closed before choosing Delete / start over. You can remove such objects in Supabase Storage. The browser warns before leaving with unsaved audio/edits, but closing it cannot preserve an in-memory recording that has not been uploaded. No offline persistence or background jobs are included in this phase.
