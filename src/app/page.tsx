'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Instagram, Twitter, Globe, ArrowRight, UploadCloud, Sparkles, MessageSquare, CalendarSync } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import AuthForm from '@/components/AuthForm';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadingOutRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const router = useRouter();

  const { user, profile, authenticated, loading, signOut } = useAuth();

  const startFlow = () => {
    if (authenticated) {
      router.push('/scan');
    } else {
      setShowAuth(true);
    }
  };

  // Redirect authenticated users to upload
  useEffect(() => {
    if (authenticated && !loading) {
      router.push('/scan');
    }
  }, [authenticated, loading, router]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let restartTimer: ReturnType<typeof setTimeout> | null = null;

    function cancelRaf() {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }

    function fadeIn(startOpacity: number) {
      cancelRaf();
      fadingOutRef.current = false;
      const duration = 500;
      const start = performance.now();
      function step(now: number) {
        if (!video) return;
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        video.style.opacity = String(startOpacity + (1 - startOpacity) * progress);
        if (progress < 1) rafRef.current = requestAnimationFrame(step);
      }
      rafRef.current = requestAnimationFrame(step);
    }

    function fadeOut() {
      if (fadingOutRef.current) return;
      fadingOutRef.current = true;
      cancelRaf();
      const duration = 500;
      const start = performance.now();
      const startOpacity = video ? parseFloat(video.style.opacity || '1') : 1;
      function step(now: number) {
        if (!video) return;
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        video.style.opacity = String(startOpacity * (1 - progress));
        if (progress < 1) rafRef.current = requestAnimationFrame(step);
      }
      rafRef.current = requestAnimationFrame(step);
    }

    function handleTimeUpdate() {
      if (!video) return;
      const remaining = video.duration - video.currentTime;
      if (remaining <= 0.55 && !fadingOutRef.current) fadeOut();
    }

    function handleCanPlay() {
      fadeIn(0);
    }

    function handleEnded() {
      if (!video) return;
      video.style.opacity = '0';
      fadingOutRef.current = false;
      restartTimer = setTimeout(() => {
        if (!video) return;
        video.currentTime = 0;
        video.play().then(() => fadeIn(0)).catch(() => {});
      }, 100);
    }

    video.style.opacity = '0';
    video.addEventListener('canplay', handleCanPlay, { once: true });
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      cancelRaf();
      if (restartTimer !== null) clearTimeout(restartTimer);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black overflow-hidden flex flex-col">
      <video
        ref={videoRef}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4"
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover translate-y-[17%] pointer-events-none"
        style={{ opacity: 0 }}
      />

      {/* Landing page nav — clean: logo + sign in / get started */}
      <nav className="relative z-20 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="liquid-glass rounded-full px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="7" y1="14" x2="17" y2="14" strokeOpacity="0.5" />
                <line x1="7" y1="17" x2="13" y2="17" strokeOpacity="0.5" />
              </svg>
              <span className="text-white font-semibold text-base sm:text-lg">SyllaScan</span>
            </Link>
          </div>
          {loading ? (
            <div className="h-8 w-20 rounded-full bg-white/10 animate-pulse" />
          ) : authenticated ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/scan" className="text-white text-sm font-medium">Go to scan</Link>
              <button
                onClick={signOut}
                className="liquid-glass rounded-full px-4 sm:px-5 py-1.5 sm:py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Sign out
              </button>
              <Link
                href="/settings"
                className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-semibold text-white"
                aria-label="Account settings"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.display_name || user?.email || 'User'} className="h-full w-full object-cover" />
                ) : (
                  profile?.display_name?.charAt(0) || user?.email?.charAt(0) || 'U'
                )}
              </Link>
            </div>
          ) : (
            <div className="flex items-center">
              <button
                onClick={() => setShowAuth(true)}
                className="bg-white rounded-full px-5 py-2 text-black text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pt-8 sm:pt-12 pb-8 text-center">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white mb-6 sm:mb-8 tracking-tight"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Your academic calendar,
          <br className="hidden sm:block" />
          {' '}supercharged
        </h1>

        <div className="max-w-lg w-full space-y-4">
          <button
            onClick={startFlow}
            className="liquid-glass rounded-full pl-4 sm:pl-6 pr-2 py-2 flex items-center gap-3 text-left transition-colors hover:bg-white/5 w-full"
            aria-label="Upload any document"
          >
            <UploadCloud size={20} className="shrink-0 text-white" />
            <span className="flex-1 bg-transparent text-white text-sm sm:text-base outline-none">
              Upload any document
            </span>
            <span className="bg-white rounded-full p-2.5 sm:p-3 text-black flex items-center justify-center">
              <ArrowRight size={18} />
            </span>
          </button>

          <p className="text-white/90 text-xs sm:text-sm leading-relaxed px-2 sm:px-4">
            Upload syllabi, schedules, or any document — AI extracts deadlines, exams, and events automatically. Create events with natural language and sync everything to Google Calendar.
          </p>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="liquid-glass rounded-2xl p-5 sm:p-6 text-center">
          <Sparkles size={28} className="text-white mx-auto mb-3" />
          <h3 className="text-white font-semibold text-sm mb-1">Smart extraction</h3>
          <p className="text-white/90 text-xs leading-relaxed">
            Upload any document and AI extracts events, deadlines, and assignments automatically.
          </p>
        </div>
        <div className="liquid-glass rounded-2xl p-5 sm:p-6 text-center">
          <MessageSquare size={28} className="text-white mx-auto mb-3" />
          <h3 className="text-white font-semibold text-sm mb-1">Natural language</h3>
          <p className="text-white/90 text-xs leading-relaxed">
            Type &ldquo;midterm March 15 at 2pm&rdquo; and it creates the event instantly.
          </p>
        </div>
        <div className="liquid-glass rounded-2xl p-5 sm:p-6 text-center">
          <CalendarSync size={28} className="text-white mx-auto mb-3" />
          <h3 className="text-white font-semibold text-sm mb-1">Calendar sync</h3>
          <p className="text-white/90 text-xs leading-relaxed">
            Events sync to Google Calendar with one click. Never miss a deadline again.
          </p>
        </div>
      </div>

      {/* Social links */}
      <div className="relative z-10 flex justify-center gap-4 pb-12">
        <a href="https://instagram.com" aria-label="Instagram" className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all">
          <Instagram size={20} />
        </a>
        <a href="https://twitter.com" aria-label="Twitter" className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all">
          <Twitter size={20} />
        </a>
        <a href="/" aria-label="Website" className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all">
          <Globe size={20} />
        </a>
      </div>

      {/* Auth modal */}
      {showAuth && !authenticated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAuth(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <AuthForm />
          </div>
        </div>
      )}
    </div>
  );
}
