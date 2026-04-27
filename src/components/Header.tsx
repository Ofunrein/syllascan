'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useState, useEffect, useRef } from 'react';
import ThemeToggle from './ThemeToggle';
import { Calendar, LayoutDashboard, Settings, LogOut, Upload } from 'lucide-react';

export default function Header() {
  const { user, profile, loading, authenticated, signInWithGoogle, signOut } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close user dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [userMenuOpen]);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path);
  };

  // Logo always links to / (landing page) — from there, auth redirects to /scan if logged in
  const logoHref = '/';

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="container">
        <div className="header-content">
          {/* Logo */}
          <div className="logo-container">
            <Link href={logoHref} className="logo">
              <svg className="logo-icon-svg w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="7" y1="14" x2="17" y2="14" strokeOpacity="0.5" />
                <line x1="7" y1="17" x2="13" y2="17" strokeOpacity="0.5" />
              </svg>
              <span className="syllascan-logo">SyllaScan</span>
            </Link>
          </div>

          {/* Desktop nav — only Upload + Calendar when authenticated */}
          {authenticated && (
            <nav className="desktop-nav">
              <Link href="/scan" className={`nav-link ${isActive('/scan') ? 'active' : ''}`}>
                <Upload size={14} strokeWidth={2} />
                <span className="nav-text">Upload</span>
              </Link>
              <Link href="/calendar" className={`nav-link ${isActive('/calendar') ? 'active' : ''}`}>
                <Calendar size={14} strokeWidth={2} />
                <span className="nav-text">Calendar</span>
              </Link>
            </nav>
          )}

          {/* Actions */}
          <div className="header-actions">
            <ThemeToggle />

            {loading ? (
              <div className="user-placeholder" />
            ) : user ? (
              <div className="user-menu" ref={userMenuRef}>
                <button
                  className="user-button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-label="User menu"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name || 'User profile'}
                      className="user-avatar"
                    />
                  ) : (
                    <div className="user-initial">
                      {(profile?.display_name?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase()}
                    </div>
                  )}
                </button>

                {userMenuOpen && (
                  <div className="dropdown-menu">
                    <div className="user-info">
                      <div className="user-name">{profile?.display_name || 'User'}</div>
                      <div className="user-email">{user.email || ''}</div>
                    </div>
                    <Link href="/scan#events" className="menu-item" onClick={() => setUserMenuOpen(false)}>
                      <LayoutDashboard size={15} strokeWidth={2} />
                      My Events
                    </Link>
                    <Link href="/settings" className="menu-item" onClick={() => setUserMenuOpen(false)}>
                      <Settings size={15} strokeWidth={2} />
                      Settings
                    </Link>
                    <div className="menu-divider" />
                    <button onClick={signOut} className="menu-item menu-item--danger">
                      <LogOut size={15} strokeWidth={2} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={signInWithGoogle} className="sign-in-button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="google-icon">
                  <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972-3.332 0-6.033-2.701-6.033-6.032s2.701-6.032 6.033-6.032c1.498 0 2.866.549 3.921 1.453l2.814-2.814C17.503 2.988 15.139 2 12.545 2 7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" fill="currentColor" />
                </svg>
                Sign in
              </button>
            )}

            {/* Mobile hamburger */}
            <button
              className="mobile-menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <div className={`hamburger ${menuOpen ? 'open' : ''}`}>
                <span />
                <span />
                <span />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="mobile-menu">
            {authenticated && (
              <>
                <Link href="/scan#events" className={`mobile-nav-link ${isActive('/scan') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                  My Events
                </Link>
                <Link href="/scan" className={`mobile-nav-link ${isActive('/scan') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                  Upload
                </Link>
                <Link href="/calendar" className={`mobile-nav-link ${isActive('/calendar') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                  Calendar
                </Link>
                <Link href="/settings" className={`mobile-nav-link ${isActive('/settings') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                  Settings
                </Link>
              </>
            )}

            {!user && (
              <button onClick={() => { setMenuOpen(false); signInWithGoogle(); }} className="mobile-sign-in">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="google-icon">
                  <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972-3.332 0-6.033-2.701-6.033-6.032s2.701-6.032 6.033-6.032c1.498 0 2.866.549 3.921 1.453l2.814-2.814C17.503 2.988 15.139 2 12.545 2 7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" fill="currentColor" />
                </svg>
                Sign in
              </button>
            )}

            {user && (
              <button onClick={signOut} className="mobile-sign-out">
                <LogOut size={15} strokeWidth={2} />
                Sign out
              </button>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .site-header {
          background: rgba(255, 255, 255, 0.6);
          background-blend-mode: luminosity;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          position: sticky;
          top: 0;
          z-index: 50;
          transition: background 0.3s ease;
        }
        .site-header.scrolled {
          background: rgba(255, 255, 255, 0.85);
          box-shadow: 0 1px 24px rgba(0, 0, 0, 0.08);
        }
        :global(.dark) .site-header {
          background: rgba(255, 255, 255, 0.01);
          border-bottom-color: rgba(255, 255, 255, 0.07);
        }
        :global(.dark) .site-header.scrolled {
          background: rgba(8, 8, 14, 0.62);
          box-shadow: 0 1px 24px rgba(0, 0, 0, 0.5);
        }

        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 4rem;
        }

        .logo-container {
          display: flex;
          align-items: center;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
          transition: opacity 0.2s;
        }

        .logo:hover {
          opacity: 0.8;
          text-decoration: none;
        }

        .logo :global(.syllascan-logo) { color: #111827 !important; }
        :global(.dark) .logo :global(.syllascan-logo) { color: #fff !important; }
        .logo-icon-svg { color: #111827 !important; flex-shrink: 0; }
        :global(.dark) .logo-icon-svg { color: #fff !important; }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .user-placeholder {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 9999px;
          background-color: rgba(0, 0, 0, 0.08);
          animation: pulse 1.5s infinite;
        }
        :global(.dark) .user-placeholder {
          background-color: rgba(255, 255, 255, 0.14);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .user-menu {
          position: relative;
        }

        .user-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
          transition: transform 0.2s;
          border-radius: 9999px;
        }

        .user-button:hover {
          transform: scale(1.05);
        }

        .user-avatar {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 9999px;
          object-fit: cover;
          border: 2px solid var(--border);
        }

        .user-initial {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 9999px;
          background-color: var(--cal-blue);
          color: #fff;
          font-weight: 600;
          font-size: 0.875rem;
          font-family: var(--font-heading);
        }

        .dropdown-menu {
          position: absolute;
          top: calc(100% + 0.5rem);
          right: 0;
          width: 220px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 0.625rem;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          padding: 0.375rem 0;
          z-index: 100;
          border: 1px solid rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }
        :global(.dark) .dropdown-menu {
          background: rgba(12, 12, 18, 0.88);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .user-info {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
          margin-bottom: 0.25rem;
        }

        .user-name { font-weight: 600; color: #111827; font-size: 0.875rem; font-family: var(--font-heading); }
        :global(.dark) .user-name { color: #fff; }
        .user-email { color: rgba(0, 0, 0, 0.45); font-size: 0.75rem; margin-top: 0.125rem; }
        :global(.dark) .user-email { color: rgba(255, 255, 255, 0.45); }
        .menu-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; color: rgba(0, 0, 0, 0.75); font-size: 0.875rem; transition: background-color 0.15s; text-decoration: none; width: 100%; text-align: left; background: none; border: none; cursor: pointer; font-weight: 500; font-family: var(--font-body); }
        .menu-item:hover { background-color: rgba(0, 0, 0, 0.04); }
        :global(.dark) .menu-item { color: rgba(255, 255, 255, 0.85); }
        :global(.dark) .menu-item:hover { background-color: rgba(255, 255, 255, 0.08); }

        .menu-divider {
          height: 1px;
          background: var(--border);
          margin: 0.25rem 0;
        }

        .menu-item--danger {
          color: var(--deadline);
        }

        .sign-in-button {
          display: none;
        }

        @media (min-width: 640px) {
          .sign-in-button {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.45rem 0.875rem;
            background: rgba(0, 0, 0, 0.06);
            color: #111827;
            font-size: 0.8125rem;
            font-weight: 500;
            border-radius: 9999px;
            border: 1px solid rgba(0, 0, 0, 0.1);
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: var(--font-heading);
            backdrop-filter: blur(4px);
          }
          .sign-in-button:hover {
            background: rgba(0, 0, 0, 0.1);
            transform: scale(1.03);
          }
          :global(.dark) .sign-in-button {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
            border-color: rgba(255, 255, 255, 0.18);
          }
          :global(.dark) .sign-in-button:hover {
            background: rgba(255, 255, 255, 0.2);
          }
        }

        .google-icon {
          display: block;
          flex-shrink: 0;
        }

        .mobile-menu-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          background: none;
          border: none;
          cursor: pointer;
          border-radius: 0.375rem;
          transition: background-color 0.2s;
        }

        .mobile-menu-button:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        @media (min-width: 640px) {
          .mobile-menu-button {
            display: none;
          }
        }

        .hamburger {
          position: relative;
          width: 1.25rem;
          height: 1rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .hamburger span {
          display: block;
          width: 100%;
          height: 1.5px;
          background-color: rgba(0, 0, 0, 0.7);
          border-radius: 9999px;
          transition: all 0.25s ease;
        }
        :global(.dark) .hamburger span {
          background-color: rgba(255, 255, 255, 0.85);
        }

        .hamburger.open span:nth-child(1) {
          transform: translateY(7px) rotate(45deg);
        }

        .hamburger.open span:nth-child(2) {
          opacity: 0;
        }

        .hamburger.open span:nth-child(3) {
          transform: translateY(-7px) rotate(-45deg);
        }

        .mobile-menu {
          display: flex;
          flex-direction: column;
          padding: 0.5rem 0;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          animation: fadeIn 0.2s ease-out;
        }
        :global(.dark) .mobile-menu {
          border-top-color: rgba(255, 255, 255, 0.08);
          background: rgba(8, 8, 14, 0.92);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (min-width: 640px) {
          .mobile-menu {
            display: none;
          }
        }

        .mobile-nav-link {
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          font-size: 0.9375rem;
          color: rgba(0, 0, 0, 0.65);
          text-decoration: none;
          transition: background-color 0.15s;
          font-family: var(--font-heading);
          font-weight: 500;
        }
        :global(.dark) .mobile-nav-link {
          color: rgba(255, 255, 255, 0.75);
        }

        .mobile-nav-link:hover {
          background-color: rgba(0, 0, 0, 0.04);
        }

        .mobile-nav-link.active {
          color: #111827;
          background-color: rgba(0, 0, 0, 0.04);
        }
        :global(.dark) .mobile-nav-link.active {
          color: #fff;
          background-color: rgba(255, 255, 255, 0.08);
        }

        .mobile-sign-in,
        .mobile-sign-out {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.75rem 1rem;
          margin-top: 0.25rem;
          text-align: left;
          font-size: 0.9375rem;
          background: none;
          border: none;
          border-top: 1px solid var(--border);
          cursor: pointer;
          font-family: var(--font-heading);
          font-weight: 500;
        }

        .mobile-sign-in {
          color: rgba(0, 0, 0, 0.75);
        }
        :global(.dark) .mobile-sign-in {
          color: rgba(255, 255, 255, 0.85);
        }

        .mobile-sign-out {
          color: var(--deadline);
        }
      `}</style>
    </header>
  );
}
