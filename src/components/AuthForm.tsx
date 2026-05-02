'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

interface AuthFormProps {
  onClose?: () => void;
}

export default function AuthForm({ onClose }: AuthFormProps = {}) {
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
        if (result.error) setError(result.error);
        else setCheckEmail(true);
      } else {
        const result = await signInWithEmail(email, password);
        if (result.error) setError(result.error);
        else { onClose?.(); router.push('/scan'); }
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (checkEmail) {
    return (
      <div style={{ background:'rgba(10,10,20,0.92)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 24px 64px rgba(0,0,0,0.7)' }} className="relative rounded-2xl p-8 max-w-md mx-auto w-full text-center">
        {onClose && <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white text-xl leading-none">×</button>}
        <h2 className="text-lg font-semibold text-white mb-2">Check your email</h2>
        <p className="text-white/60 text-sm">We sent a confirmation link to <strong className="text-white">{email}</strong>. Click it to activate your account.</p>
      </div>
    );
  }

  return (
    <div
      style={{ background:'rgba(10,12,22,0.72)', backdropFilter:'blur(28px) saturate(180%)', WebkitBackdropFilter:'blur(28px) saturate(180%)', border:'1px solid rgba(255,255,255,0.13)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.1), 0 24px 64px rgba(0,0,0,0.65)' }}
      className="relative rounded-2xl p-8 max-w-md mx-auto w-full"
    >
      {/* X close */}
      {onClose && (
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/8 transition-colors text-lg leading-none cursor-pointer">
          ×
        </button>
      )}

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-7">
        <svg className="w-6 h-6 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="7" y1="14" x2="17" y2="14" strokeOpacity="0.5" />
          <line x1="7" y1="17" x2="13" y2="17" strokeOpacity="0.5" />
        </svg>
        <span className="text-white font-semibold tracking-widest uppercase text-sm">SyllaScan</span>
      </div>

      {/* Tab toggle */}
      <div className="flex rounded-full bg-white/6 border border-white/10 p-1 mb-7">
        <button
          type="button"
          onClick={() => { setMode('signin'); setError(null); }}
          className={`flex-1 py-2.5 rounded-full text-sm font-semibold tracking-wide uppercase transition-all cursor-pointer ${mode === 'signin' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => { setMode('signup'); setError(null); }}
          className={`flex-1 py-2.5 rounded-full text-sm font-semibold tracking-wide uppercase transition-all cursor-pointer ${mode === 'signup' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}
        >
          Sign Up
        </button>
      </div>

      {/* Google */}
      <button
        onClick={signInWithGoogle}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white/8 hover:bg-white/15 text-white transition-colors mb-5 border border-white/10 text-sm font-medium cursor-pointer"
      >
        <svg className="w-4.5 h-4.5 flex-shrink-0" viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-white/12" />
        <span className="text-white/30 text-xs uppercase tracking-widest">or</span>
        <div className="flex-1 h-px bg-white/12" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-1.5">Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 text-sm"
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-1.5">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-1.5">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 text-sm"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-full bg-white text-black font-semibold uppercase tracking-widest text-sm hover:bg-white/90 transition-all disabled:opacity-50 mt-1 cursor-pointer"
        >
          {loading ? '...' : mode === 'signin' ? 'Log In' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
