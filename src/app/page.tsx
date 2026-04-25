'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { Instagram, Twitter, Globe, ArrowRight, UploadCloud } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import AuthForm from '@/components/AuthForm';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadingOutRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const { user, profile, authenticated, signOut } = useAuth();

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

      <nav className="relative z-20 pl-6 pr-6 py-6">
        <div className="liquid-glass rounded-full px-6 py-3 flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="7" y1="14" x2="17" y2="14" strokeOpacity="0.5" />
                <line x1="7" y1="17" x2="13" y2="17" strokeOpacity="0.5" />
              </svg>
              <span className="text-white font-semibold text-lg">SyllaScan</span>
            </Link>
            {authenticated && (
              <div className="hidden md:flex items-center gap-6">
                <Link href="/dashboard" className="text-white/70 hover:text-white transition-colors text-sm font-medium">Dashboard</Link>
                <Link href="/scan" className="text-white/70 hover:text-white transition-colors text-sm font-medium">Upload</Link>
                <Link href="/calendar" className="text-white/70 hover:text-white transition-colors text-sm font-medium">Calendar</Link>
                <Link href="/settings" className="text-white/70 hover:text-white transition-colors text-sm font-medium">Settings</Link>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {authenticated ? (
              <>
                <span className="text-white/60 text-sm hidden md:block">{profile?.display_name || user?.email}</span>
                {profile?.avatar_url && (
                  <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                )}
                <button onClick={signOut} className="text-white/60 hover:text-white text-sm transition-colors">Sign out</button>
              </>
            ) : (
              <>
                <button onClick={() => setShowAuth(true)} className="text-white text-sm font-medium">Sign in</button>
                <Link href="/scan" className="liquid-glass rounded-full px-5 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center -translate-y-[20%]">
        <h1
          className="text-5xl md:text-6xl lg:text-7xl text-white mb-8 tracking-tight whitespace-nowrap"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Built for the curious
        </h1>

        <div className="max-w-xl w-full space-y-4">
          <Link
            href="/scan"
            className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3 text-left transition-colors hover:bg-white/5"
            aria-label="Start scanning a syllabus"
          >
            <UploadCloud size={20} className="shrink-0 text-white/70" />
            <span className="flex-1 bg-transparent text-white/80 text-base outline-none">
              Upload a syllabus
            </span>
            <span className="bg-white rounded-full p-3 text-black flex items-center justify-center">
              <ArrowRight size={20} />
            </span>
          </Link>

          <p className="text-white text-sm leading-relaxed px-4">
            Upload your syllabus and automatically extract deadlines, exams, and assignments to your Google Calendar. Built for students who mean business.
          </p>

          {authenticated ? (
            <p className="text-white/50 text-sm">
              Welcome back, {profile?.display_name || user?.email?.split('@')[0]}
            </p>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="text-white/40 hover:text-white/60 text-sm transition-colors"
            >
              Sign in to save your events
            </button>
          )}

          <div className="flex justify-center">
            <Link
              href="/scan"
              className="liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Scan your syllabus
            </Link>
          </div>
        </div>
      </div>

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
