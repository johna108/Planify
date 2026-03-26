import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BrainCircuit, CheckCircle2, Loader2, ShieldCheck, Sparkles } from 'lucide-react';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const highlights = [
    {
      icon: <Sparkles size={16} />,
      title: 'AI-first planning',
      description: 'Turn rough thoughts into prioritized tasks instantly.',
    },
    {
      icon: <CheckCircle2 size={16} />,
      title: 'Adaptive scheduling',
      description: 'Reschedules around availability without breaking your day.',
    },
    {
      icon: <ShieldCheck size={16} />,
      title: 'Production-ready security',
      description: 'Supabase auth with reliable session persistence.',
    },
  ];

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      console.log('[Auth] Message received:', { origin: event.origin, type: event.data?.type });
      
      // Allow messages from the same origin only
      if (event.origin !== window.location.origin && !event.origin.includes('localhost')) {
        console.log('[Auth] Message blocked, origin mismatch');
        return;
      }
      
      // Legacy message-based auth (if still needed for some flows)
      if (event.data?.type === 'SUPABASE_AUTH_SUCCESS') {
        console.log('[Auth] Processing legacy auth success');
        // Auth state will be updated via onAuthStateChange listener
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[Auth] Starting Google OAuth flow');
      const redirectUrl = window.location.origin; // Redirect to root instead of /auth/callback
      console.log('[Auth] Redirect URL:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        }
      });
      
      if (error) {
        console.error('[Auth] OAuth error:', error);
        throw error;
      }
      
      if (data?.url) {
        console.log('[Auth] Opening OAuth popup');
        const authWindow = window.open(data.url, 'oauth_popup', 'width=600,height=700');
        if (!authWindow) {
          setError('Please allow popups for this site to sign in with Google.');
        }
      } else {
        setError('Could not start Google login. Please try again.');
      }
    } catch (err: any) {
      console.error('[Auth] Google login error:', err);
      setError(err.message || 'An error occurred during Google authentication');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-stone-50 font-sans text-stone-900">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-28 h-72 w-72 rounded-full bg-rose-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-2 lg:items-center">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              <Sparkles size={14} />
              Smart planning that fits real life
            </div>
            <h1 className="mt-5 text-5xl font-extrabold leading-tight tracking-tight text-stone-900">
              Welcome back to
              <span className="block text-amber-600">
                Planify
              </span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-stone-600">
              Sign in to keep your tasks, reminders, and calendar in one synchronized command center.
            </p>

            <div className="mt-8 space-y-3">
              {highlights.map((item) => (
                <div key={item.title} className="rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-stone-900">
                    <span className="rounded-md bg-amber-100 p-1.5 text-amber-700">{item.icon}</span>
                    <p className="text-sm font-semibold">{item.title}</p>
                  </div>
                  <p className="mt-1.5 text-xs text-stone-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md lg:max-w-lg">
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-stone-900 p-2.5 text-white shadow-sm">
                <BrainCircuit size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Planify</h2>
                <p className="text-xs text-stone-600">{isSignUp ? 'Create your account' : 'Sign in to your account'}</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleAuth}>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                {message}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : isSignUp ? (
                  'Sign up'
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>

          <div className="mt-5">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-stone-500">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-stone-500">
                  {isSignUp ? 'Already have an account?' : 'New to Planify?'}
                </span>
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="inline-flex w-full items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                {isSignUp ? 'Sign in instead' : 'Create an account'}
              </button>
            </div>
          </div>
        </div>
        </section>
      </div>
    </div>
  );
}
