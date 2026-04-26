'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function AuthForm() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const result = await signUpWithEmail(email, password, name);
        if (result.error) {
          setError(result.error);
        } else {
          setCheckEmail(true);
        }
      } else {
        const result = await signInWithEmail(email, password);
        if (result.error) {
          setError(result.error);
        } else {
          router.push('/scan');
        }
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (checkEmail) {
    return (
      <div className="liquid-glass rounded-2xl p-8 max-w-md mx-auto text-center">
        <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
        <p className="text-white/60">
          We sent a confirmation link to <strong className="text-white">{email}</strong>.
          Click it to activate your account.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-8 max-w-md mx-auto w-full"
      style={{
        background: 'rgba(10, 10, 20, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.08), 0 24px 64px rgba(0,0,0,0.6)',
      }}
    >
      <h2 className="text-xl font-semibold text-white mb-6 text-center">
        {mode === 'signin' ? 'Sign In' : 'Create Account'}
      </h2>

      <button
        onClick={signInWithGoogle}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl
                   bg-white/10 hover:bg-white/18 text-white transition-colors mb-6 border border-white/10"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-white/20" />
        <span className="text-white/40 text-sm">or</span>
        <div className="flex-1 h-px bg-white/20" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                       text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                     text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                     text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
        />

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                     text-white font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-white/40 text-sm mt-4">
        {mode === 'signin' ? (
          <>
            Don&apos;t have an account?{' '}
            <button onClick={() => { setMode('signup'); setError(null); }} className="text-blue-400 hover:text-blue-300">
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button onClick={() => { setMode('signin'); setError(null); }} className="text-blue-400 hover:text-blue-300">
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
