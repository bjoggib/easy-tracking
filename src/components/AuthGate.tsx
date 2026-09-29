'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, usingSupabase } from '@/lib/supabase';

/** With Supabase storage, shows a sign-in form until there is a session. Otherwise renders children as is. */
export function AuthGate({ children }: { children: ReactNode }) {
  if (!usingSupabase) return <>{children}</>;
  return <SupabaseGate>{children}</SupabaseGate>;
}

function SupabaseGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const db = supabase();
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <p className="loading wrap">Loading…</p>;
  if (!session) return <SignIn />;
  // Keyed by user so signing in as someone else reloads their data.
  return <div key={session.user.id}>{children}</div>;
}

/** Supabase reports a failed OAuth sign-in in the URL (query or hash) of the redirect back. */
function redirectError() {
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.slice(1));
  return params.get('error_description');
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'google'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(redirectError()), []);

  const google = async () => {
    setState('google');
    setError(null);
    const { error } = await supabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/day' },
    });
    // On success the browser is already navigating to Google.
    if (error) {
      setError(error.message);
      setState('idle');
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError(null);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + '/day' },
    });
    if (error) {
      setError(error.message);
      setState('idle');
    } else setState('sent');
  };

  return (
    <main className="wrap signin">
      <h2>Easy Tracking</h2>
      {state === 'sent' ? (
        <>
          <p>Check {email} for a sign-in link. Open it in this browser.</p>
          <button className="btn quiet" onClick={() => setState('idle')}>Use another way</button>
        </>
      ) : (
        <>
          <button className="btn google" onClick={google} disabled={state === 'google'}>
            <GoogleIcon />
            {state === 'google' ? 'Opening Google…' : 'Continue with Google'}
          </button>
          <p className="or"><span>or</span></p>
          <form onSubmit={submit}>
            <label className="fld">
              Email
              <input className="txt" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            <p className="hint">We&apos;ll email you a sign-in link.</p>
            <button className="btn" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Email me a link'}
            </button>
          </form>
        </>
      )}
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
