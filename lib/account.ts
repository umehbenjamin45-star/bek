export function normalizeUsername(value: string): string { return value.trim().toLowerCase(); }
export function validateUsername(value: string): string | null {
  return /^[a-z][a-z0-9_]{2,29}$/.test(normalizeUsername(value)) ? null : 'Use 3–30 characters: start with a letter, then use letters, numbers, or underscores.';
}
export function validatePassword(value: string): string | null {
  return value.length < 12 || value.length > 128 ? 'Use a password between 12 and 128 characters.' : null;
}
export function authErrorMessage(code?: string, signup = false): string {
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') return 'Too many attempts. Please wait a few minutes and try again.';
  if (code === 'email_not_confirmed') return 'Confirm your email before signing in. Check your inbox and spam folder.';
  if (code === 'weak_password') return 'Choose a stronger password with at least 12 characters.';
  if (code === 'signup_disabled') return 'Account creation is currently disabled in Supabase. Enable new user sign-ups in Authentication settings.';
  if (signup) return 'Could not create your account. Try another username, or sign in / reset your password if you already have an account.';
  return 'The username/email or password is incorrect. Please try again.';
}
