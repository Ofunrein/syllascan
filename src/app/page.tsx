'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Instagram, Twitter, Globe, ArrowRight } from 'lucide-react';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadingOutRef = useRef(false);
  const rafRef = useRef<number | null>(null);

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
              <Calendar size={24} className="text-white" />
              <span className="text-white font-semibold text-lg">SyllaScan</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/scan" className="text-white/80 hover:text-white transition-colors text-sm font-medium">Upload</Link>
              <Link href="/dashboard" className="text-white/80 hover:text-white transition-colors text-sm font-medium">Dashboard</Link>
              <Link href="/#about" className="text-white/80 hover:text-white transition-colors text-sm font-medium">About</Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/scan" className="text-white text-sm font-medium">Get Started</Link>
            <Link href="/dashboard" className="liquid-glass rounded-full px-6 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors">
              Dashboard
            </Link>
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
          <div className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 bg-transparent text-white placeholder:text-white/40 text-base outline-none"
            />
            <Link href="/scan">
              <button className="bg-white rounded-full p-3 text-black flex items-center justify-center">
                <ArrowRight size={20} />
              </button>
            </Link>
          </div>

          <p className="text-white text-sm leading-relaxed px-4">
            Upload your syllabus and automatically extract deadlines, exams, and assignments to your Google Calendar. Built for students who mean business.
          </p>

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
    </div>
  );
}
