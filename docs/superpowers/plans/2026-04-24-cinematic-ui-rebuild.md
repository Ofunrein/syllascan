# SyllaScan Cinematic UI Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SyllaScan's current light-themed UI with a dark cinematic aesthetic — full-screen looping video background on the landing page, liquid glass components throughout, and Instrument Serif headings — while preserving all upload, event-extraction, auth, and Google Calendar functionality.

**Architecture:** The homepage (`/`) becomes a cinematic landing page with full-screen video. The current tab-based upload/events/calendar UI (currently on `/`) moves to a new `/scan` route. The Header becomes a transparent liquid-glass overlay on dark pages. All functional pages adopt a dark `#0a0a0f` base. No API routes, auth logic, or utility files are touched.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, lucide-react. Liquid-glass CSS and Instrument Serif are already in `globals.css`. Firebase Auth, Google Calendar API, OpenAI extraction — all unchanged.

---

### Task 1: Verify existing CSS infrastructure

**Files:**
- Read: `src/app/globals.css` (already done — confirmed complete)

Both the `.liquid-glass` class (lines 300–323) and the `@import` for Instrument Serif (line 1) are already correct in `globals.css`. No changes needed here.

- [ ] **Step 1: Confirm Instrument Serif import is line 1 of globals.css**

```bash
head -1 src/app/globals.css
```
Expected output: `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');`

- [ ] **Step 2: Confirm .liquid-glass is defined**

```bash
grep -n "liquid-glass" src/app/globals.css
```
Expected: lines referencing `.liquid-glass` and `.liquid-glass::before`.

- [ ] **Step 3: No commit needed — infrastructure already correct**

---

### Task 2: Update `layout.tsx` — add Instrument Serif to font preload + dark body

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add Instrument Serif to the `<link>` tag in layout.tsx**

Current link href in `src/app/layout.tsx`:
```
https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap
```

Replace with:
```
https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap
```

- [ ] **Step 2: Default body background to black in globals.css**

Find in `src/app/globals.css`:
```css
body {
  font-family: var(--font-body);
  background-color: var(--background);
  color: var(--foreground);
  min-height: 100vh;
  position: relative;
}
```

Replace with:
```css
body {
  font-family: var(--font-body);
  background-color: #000;
  color: var(--foreground);
  min-height: 100vh;
  position: relative;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "style: add Instrument Serif to font preload, default body background to black"
```

---

### Task 3: Create cinematic landing page at `src/app/page.tsx`

**Files:**
- Rewrite: `src/app/page.tsx`

This replaces the entire current homepage. All upload functionality moves to `/scan` in Task 5.

- [ ] **Step 1: Write the new `src/app/page.tsx`**

Replace the entire file contents with:

```tsx
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
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        if (video) video.style.opacity = String(startOpacity + (1 - startOpacity) * progress);
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
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        if (video) video.style.opacity = String(startOpacity * (1 - progress));
        if (progress < 1) rafRef.current = requestAnimationFrame(step);
      }
      rafRef.current = requestAnimationFrame(step);
    }

    function handleTimeUpdate() {
      if (!video) return;
      const remaining = video.duration - video.currentTime;
      if (remaining <= 0.55 && !fadingOutRef.current) fadeOut();
    }

    function handleEnded() {
      if (!video) return;
      video.style.opacity = '0';
      fadingOutRef.current = false;
      setTimeout(() => {
        if (!video) return;
        video.currentTime = 0;
        video.play().then(() => fadeIn(0));
      }, 100);
    }

    video.style.opacity = '0';
    video.addEventListener('canplay', () => fadeIn(0), { once: true });
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      cancelRaf();
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black overflow-hidden flex flex-col">
      {/* Background video */}
      <video
        ref={videoRef}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4"
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover translate-y-[17%] pointer-events-none"
        style={{ opacity: 0 }}
      />

      {/* Nav */}
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

      {/* Hero */}
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

      {/* Social footer */}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: cinematic landing page with looping video and liquid glass UI"
```

---

### Task 4: Update `Header.tsx` — liquid glass dark overlay

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/app/globals.css`

The Header needs to work as a transparent dark overlay on all interior pages (`/scan`, `/dashboard`, `/settings`). The landing page has its own inline nav and does not render the Header component.

- [ ] **Step 1: Replace `.site-header` background styles in `Header.tsx`**

In `src/components/Header.tsx` in the `<style jsx>` block, find and replace:

```css
.site-header {
  background-color: var(--card);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 50;
  transition: box-shadow 0.3s ease, background-color 0.3s ease;
}

.site-header.scrolled {
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
  background-color: rgba(255, 255, 255, 0.92);
}

:global(.dark) .site-header.scrolled {
  background-color: rgba(31, 41, 55, 0.92);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.3);
}
```

With:

```css
.site-header {
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  position: sticky;
  top: 0;
  z-index: 50;
  transition: background 0.3s ease;
}

.site-header.scrolled {
  background: rgba(0, 0, 0, 0.7);
  box-shadow: 0 1px 24px rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 2: Override logo text color to white**

In the same `<style jsx>` block, add after the `.logo:hover` rule:

```css
.logo :global(.syllascan-logo) {
  color: #fff !important;
}

.logo-icon-svg {
  color: #fff !important;
}
```

- [ ] **Step 3: Update `.sign-in-button` to liquid-glass pill style**

Find the `.sign-in-button` rule (inside `@media (min-width: 640px)`) and replace:

```css
@media (min-width: 640px) {
  .sign-in-button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.875rem;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: var(--font-heading);
    backdrop-filter: blur(4px);
  }

  .sign-in-button:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.03);
  }
}
```

- [ ] **Step 4: Update dropdown menu to dark glass style**

Find `.dropdown-menu` and replace:

```css
.dropdown-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 220px;
  background: rgba(12, 12, 18, 0.88);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 0.625rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  padding: 0.375rem 0;
  z-index: 100;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}
```

Find `.user-name`, `.user-email`, `.menu-item` and replace:

```css
.user-name {
  font-weight: 600;
  color: #fff;
  font-size: 0.875rem;
  font-family: var(--font-heading);
}

.user-email {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.75rem;
  margin-top: 0.125rem;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.875rem;
  transition: background-color 0.15s;
  text-decoration: none;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 500;
  font-family: var(--font-body);
}

.menu-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

:global(.dark) .menu-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
}
```

- [ ] **Step 5: Update mobile menu to dark glass style**

Find `.mobile-menu` and replace:

```css
.mobile-menu {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(8, 8, 14, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  animation: fadeIn 0.2s ease-out;
}
```

Find `.mobile-nav-link` and replace `color: var(--foreground)` with `color: rgba(255, 255, 255, 0.75)`.

Find `.mobile-nav-link.active` and replace `color: var(--cal-blue)` with `color: #fff` and `background-color: rgba(37, 99, 235, 0.06)` with `background-color: rgba(255, 255, 255, 0.08)`.

Find `.mobile-sign-in { color: var(--cal-blue); }` and replace with `color: rgba(255, 255, 255, 0.85);`.

- [ ] **Step 6: Update desktop nav link colors in globals.css**

In `src/app/globals.css`, find:

```css
.desktop-nav .nav-link {
  position: relative;
  padding: 0.4rem 0.75rem;
  margin: 0 0.125rem;
  transition: all 0.2s ease;
  opacity: 0.7;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  text-decoration: none;
  border-radius: 0.375rem;
  color: var(--foreground);
  font-family: var(--font-heading);
  font-size: 0.875rem;
  font-weight: 500;
}
```

Change `color: var(--foreground)` to `color: rgba(255, 255, 255, 0.75)`.

Find:

```css
.desktop-nav .nav-link.active {
  opacity: 1;
  color: var(--cal-blue);
  background-color: rgba(37, 99, 235, 0.07);
}
```

Replace with:

```css
.desktop-nav .nav-link.active {
  opacity: 1;
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
}
```

Find:

```css
.dark .desktop-nav .nav-link.active {
  color: var(--primary);
  background-color: rgba(96, 165, 250, 0.1);
}
```

Replace with:

```css
.dark .desktop-nav .nav-link.active {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
}
```

- [ ] **Step 7: Add Upload link to Header desktop nav**

In `src/components/Header.tsx`, update the import:

```tsx
import { Calendar, LayoutDashboard, Settings, LogOut, LogIn, Upload } from 'lucide-react';
```

Find the desktop nav JSX:

```tsx
<nav className="desktop-nav">
  <Link href="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
    <span className="nav-text">Home</span>
  </Link>
  <Link href="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
    <LayoutDashboard size={14} strokeWidth={2} />
    <span className="nav-text">Dashboard</span>
  </Link>
</nav>
```

Replace with:

```tsx
<nav className="desktop-nav">
  <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
    <span className="nav-text">Home</span>
  </Link>
  <Link href="/scan" className={`nav-link ${isActive('/scan') ? 'active' : ''}`}>
    <Upload size={14} strokeWidth={2} />
    <span className="nav-text">Upload</span>
  </Link>
  <Link href="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
    <LayoutDashboard size={14} strokeWidth={2} />
    <span className="nav-text">Dashboard</span>
  </Link>
</nav>
```

Also update the mobile menu to include the Upload link. Find the mobile menu JSX block and add:

```tsx
<Link href="/scan" className={`mobile-nav-link ${isActive('/scan') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
  Upload
</Link>
```

between the Home and Dashboard links.

- [ ] **Step 8: Commit**

```bash
git add src/components/Header.tsx src/app/globals.css
git commit -m "style: liquid glass dark header, white nav text, upload link added"
```

---

### Task 5: Create `/scan` page — dark cinematic upload app

**Files:**
- Create: `src/app/scan/page.tsx`

This is the current homepage tab UI (FileUploader, EventList, LiveCalendar, EmbeddedCalendar) re-styled with the dark cinematic theme.

- [ ] **Step 1: Create `src/app/scan/` directory**

```bash
mkdir -p /Users/martinofunrein/Downloads/syllascan/src/app/scan
```

- [ ] **Step 2: Write `src/app/scan/page.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import FileUploader from '@/components/FileUploader';
import EventList from '@/components/EventList';
import { Event } from '@/lib/openai';
import LiveCalendarView from '@/components/LiveCalendarView';
import GoogleAuthWrapper from '@/components/GoogleAuthWrapper';
import EmbeddedCalendarView from '@/components/EmbeddedCalendarView';
import CalendarAuthBanner from '@/components/CalendarAuthBanner';
import { Upload, Calendar, CalendarCheck, LayoutGrid } from 'lucide-react';

export default function ScanPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'events' | 'live-calendar' | 'embedded-calendar'>('upload');
  const [isCalendarExpired, setIsCalendarExpired] = useState(false);

  const handleEventsExtracted = (extractedEvents: Event[]) => {
    setEvents(extractedEvents);
    setActiveTab('events');
  };

  const handleClearEvents = () => {
    setEvents([]);
    setActiveTab('upload');
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'live-calendar') setActiveTab('live-calendar');
      else if (hash === 'embedded-calendar') setActiveTab('embedded-calendar');
      else if (hash === 'events' && events.length > 0) setActiveTab('events');
      else if (hash === 'upload') setActiveTab('upload');
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [events]);

  const handleTabClick = (tab: 'upload' | 'events' | 'live-calendar' | 'embedded-calendar') => {
    setActiveTab(tab);
    window.history.pushState(null, '', `#${tab}`);
  };

  const tabs: Array<{
    id: 'upload' | 'events' | 'live-calendar' | 'embedded-calendar';
    label: string;
    Icon: React.ElementType;
    disabled?: boolean;
  }> = [
    { id: 'upload', label: 'Upload', Icon: Upload },
    { id: 'events', label: 'Events', Icon: Calendar, disabled: events.length === 0 },
    { id: 'live-calendar', label: 'Live Calendar', Icon: CalendarCheck },
    { id: 'embedded-calendar', label: 'Embedded', Icon: LayoutGrid },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f9fafb' }}>
      {isCalendarExpired && <CalendarAuthBanner />}
      <Header />

      <main style={{ padding: '2rem 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                color: '#fff',
                marginBottom: '0.75rem',
                letterSpacing: '-0.02em',
              }}
            >
              SyllaScan
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem', maxWidth: '32rem', margin: '0 auto' }}>
              Upload your syllabus and automatically extract events to your Google Calendar
            </p>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              marginBottom: '1.5rem',
              gap: '0.25rem',
              flexWrap: 'wrap',
            }}
          >
            {tabs.map(({ id, label, Icon, disabled }) => (
              <button
                key={id}
                onClick={() => !disabled && handleTabClick(id)}
                disabled={disabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: activeTab === id ? '#fff' : 'rgba(255,255,255,0.45)',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === id ? '2px solid rgba(255,255,255,0.85)' : '2px solid transparent',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.3 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Content panel */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '0.875rem',
              border: '1px solid rgba(255,255,255,0.07)',
              padding: '1.5rem',
            }}
          >
            {activeTab === 'upload' && (
              <FileUploader
                onEventsExtracted={handleEventsExtracted}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
              />
            )}
            {activeTab === 'events' && (
              <EventList events={events} onClearEvents={handleClearEvents} />
            )}
            {activeTab === 'live-calendar' && (
              <GoogleAuthWrapper>
                <LiveCalendarView />
              </GoogleAuthWrapper>
            )}
            {activeTab === 'embedded-calendar' && (
              <GoogleAuthWrapper>
                <EmbeddedCalendarView />
              </GoogleAuthWrapper>
            )}
          </div>
        </div>
      </main>

      <footer
        style={{
          textAlign: 'center',
          padding: '2rem',
          color: 'rgba(255,255,255,0.35)',
          fontSize: '0.875rem',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          marginTop: '3rem',
        }}
      >
        © {new Date().getFullYear()} SyllaScan. All rights reserved.{' '}
        <a href="/privacy-policy" style={{ color: 'rgba(255,255,255,0.45)' }}>Privacy Policy</a>
        {' | '}
        <a href="/terms-of-service" style={{ color: 'rgba(255,255,255,0.45)' }}>Terms of Service</a>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/scan/page.tsx
git commit -m "feat: dark cinematic /scan page with upload/events/calendar tabs"
```

---

### Task 6: Apply dark theme to Dashboard page

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Read the full dashboard page**

```bash
cat src/app/dashboard/page.tsx
```

- [ ] **Step 2: Wrap the dashboard root in a dark container**

Find the `return (` statement. The outermost JSX element (likely a `<div className="...">` or similar) needs a dark background override. Find whatever the root div is and add:

```tsx
style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f9fafb' }}
```

For example, if it reads:
```tsx
return (
  <div className="dashboard-container">
```
Change to:
```tsx
return (
  <div className="dashboard-container" style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f9fafb' }}>
```

- [ ] **Step 3: Style any card/panel elements to dark glass**

Scan the JSX for elements that render white cards or light backgrounds. For each panel-like element using `className="content-panel"`, `bg-white`, `bg-gray-50`, or `var(--card)`, add:

```tsx
style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.75rem' }}
```

For section headers, ensure text color is white or near-white. Find any `color: var(--foreground)` inline styles or light-mode text classes and override:

```tsx
style={{ color: 'rgba(255,255,255,0.9)' }}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "style: dark cinematic theme for dashboard page"
```

---

### Task 7: Final visual verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify landing page at `http://localhost:3000`**

Check:
- Black background visible immediately
- Video fades in from opacity 0 over 500ms after `canplay` fires
- Video loops: at 0.55s before end, fades out; on `ended`, resets and fades back in
- Liquid glass nav bar: blurred glass border visible, SyllaScan logo in white
- Desktop nav links (Upload, Dashboard, About) visible in white/80
- "Built for the curious" heading renders in Instrument Serif (serif font, not sans-serif)
- Email input bar with arrow CTA
- "Scan your syllabus" pill button
- Three social icon buttons at bottom (Instagram, Twitter, Globe)

- [ ] **Step 3: Verify `/scan` at `http://localhost:3000/scan`**

Check:
- Dark `#0a0a0f` background
- Liquid glass dark header (no white background)
- "SyllaScan" in Instrument Serif
- Four tabs visible: Upload, Events (disabled until events extracted), Live Calendar, Embedded
- FileUploader renders and accepts PDF/image files
- After uploading, Events tab activates
- Live Calendar tab shows GoogleAuthWrapper
- No JS console errors

- [ ] **Step 4: Verify auth flow**

Check:
- Click "Sign in" button in header
- Google OAuth popup appears
- After sign-in, user avatar appears
- Clicking avatar opens dark dropdown with Dashboard/Settings/Sign out
- Sign out works

- [ ] **Step 5: Verify `/dashboard` at `http://localhost:3000/dashboard`**

Check:
- Dark background
- Components render with dark styling
- Calendar/history content visible

- [ ] **Step 6: Verify landing page video is not rendered on `/scan` or `/dashboard`**

The `/scan` and `/dashboard` pages render `<Header />` (dark glass header). The landing page (`/`) renders its own inline nav, not `<Header />`. Confirm the `<Header />` component is not used in `src/app/page.tsx`.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete cinematic UI rebuild — landing page, scan app, dark dashboard, glass header"
```

---

## Self-Review Against Spec

**Spec requirement checklist:**

| Requirement | Covered in |
|---|---|
| Full-screen muted autoplay video, object-cover | Task 3, Step 1 (`<video>` element) |
| Video shifted down 17% (`translate-y-[17%]`) | Task 3, Step 1 (`className="... translate-y-[17%]"`) |
| 500ms RAF fade-in on load/loop | Task 3, Step 1 (`fadeIn()` function) |
| 500ms fade-out at 0.55s before end | Task 3, Step 1 (`handleTimeUpdate` → `fadeOut()`) |
| `fadingOutRef` prevents re-triggering | Task 3, Step 1 (`if (fadingOutRef.current) return`) |
| On ended: opacity 0, 100ms pause, reset, play, fade in | Task 3, Step 1 (`handleEnded()`) |
| Each fade cancels prior RAF | Task 3, Step 1 (`cancelRaf()` at top of `fadeIn`/`fadeOut`) |
| Outer container `min-h-screen bg-black overflow-hidden` | Task 3, Step 1 (`className="min-h-screen bg-black overflow-hidden flex flex-col"`) |
| Instrument Serif font import | Task 1 (already in globals.css) |
| Heading `fontFamily: "'Instrument Serif', serif"` inline style | Task 3, Step 1 |
| `.liquid-glass` CSS class with all spec properties | Task 1 (already in globals.css) |
| Nav: rounded-full, max-w-5xl, logo + links + auth buttons | Task 3, Step 1 |
| Nav: "SyllaScan" logo (adjusted from spec "Asme") | Task 3, Step 1 |
| Nav: Upload/Dashboard/About links hidden on mobile, md:flex | Task 3, Step 1 |
| Hero: `-translate-y-[20%]` centering offset | Task 3, Step 1 |
| Hero heading text-5xl → text-7xl | Task 3, Step 1 |
| Email input: liquid-glass rounded-full, white arrow button | Task 3, Step 1 |
| Subtitle text | Task 3, Step 1 |
| Manifesto/CTA button: liquid-glass rounded-full | Task 3, Step 1 |
| Social icons: Instagram, Twitter, Globe | Task 3, Step 1 |
| Social icons: liquid-glass rounded-full p-4 | Task 3, Step 1 |
| Social icons: aria-label on each | Task 3, Step 1 |
| All existing upload/events/calendar functionality preserved | Task 5 |
| Auth (sign in/out, user avatar, dropdown) preserved | Task 4 |
| Next.js 15 / React 19 / TypeScript / Tailwind CSS 4 stack | Unchanged throughout |
| No emoji | No emoji in any new file |

**Placeholder scan:** No TBDs, no "implement later", no vague "add appropriate error handling" — all code blocks are complete and runnable.

**Type consistency:** `Event` type is imported from `@/lib/openai` in Task 5, consistent with the original homepage. `handleEventsExtracted`, `handleClearEvents`, `handleTabClick` signatures match `FileUploader` and `EventList` prop contracts from the original page.tsx.
