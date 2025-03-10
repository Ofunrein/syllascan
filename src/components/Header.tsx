'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/lib/UserContext';
import { useState, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const { user, loading, signIn, signOut } = useUser();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Determine if a link is active based on the current path
  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(path);
  };

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="container">
        <div className="header-content">
          <div className="logo-container">
            <Link href="/" className="logo">
              <span className="logo-icon">📅</span>
              <span className="logo-text syllascan-logo">SyllaScan</span>
                  </Link>
                </div>
          
          <nav className="desktop-nav">
            <Link href="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
              <span className="nav-icon">🏠</span>
              <span className="nav-text">Home</span>
                  </Link>
            <Link href="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
              <span className="nav-icon">📊</span>
              <span className="nav-text">Dashboard</span>
                  </Link>
          </nav>
          
          <div className="header-actions">
                <ThemeToggle />
                
                {loading ? (
              <div className="user-placeholder"></div>
                ) : user ? (
              <div className="user-menu">
                <button 
                  className="user-button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="User menu"
                >
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt={user.displayName || 'User profile'}
                      className="user-avatar"
                          />
                        ) : (
                    <div className="user-initial">
                            {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                          </div>
                        )}
                </button>
                
                {menuOpen && (
                  <div className="dropdown-menu">
                    <div className="user-info">
                      <div className="user-name">{user.displayName || 'User'}</div>
                      <div className="user-email">{user.email || 'Anonymous User'}</div>
                    </div>
                    <Link href="/dashboard" className="menu-item">
                      <span className="menu-icon">📊</span>
                              Dashboard
                            </Link>
                    <button onClick={signOut} className="menu-item">
                      <span className="menu-icon">🚪</span>
                              Sign out
                            </button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={signIn} className="sign-in-button">
                <span className="button-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972-3.332 0-6.033-2.701-6.033-6.032s2.701-6.032 6.033-6.032c1.498 0 2.866.549 3.921 1.453l2.814-2.814C17.503 2.988 15.139 2 12.545 2 7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" fill="currentColor"/>
                  </svg>
                </span>
                Sign in with Google
              </button>
            )}
            
            <button 
              className="mobile-menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <div className={`menu-icon ${menuOpen ? 'open' : ''}`}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </button>
            </div>
          </div>

        {menuOpen && (
          <div className="mobile-menu">
            <Link href="/" className={`mobile-nav-link ${isActive('/') ? 'active' : ''}`}>
              <span className="nav-icon">🏠</span>
              Home
            </Link>
            <Link href="/dashboard" className={`mobile-nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
              <span className="nav-icon">📊</span>
                Dashboard
            </Link>
            
            {!user && (
              <button onClick={signIn} className="mobile-sign-in">
                <span className="button-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972-3.332 0-6.033-2.701-6.033-6.032s2.701-6.032 6.033-6.032c1.498 0 2.866.549 3.921 1.453l2.814-2.814C17.503 2.988 15.139 2 12.545 2 7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" fill="currentColor"/>
                    </svg>
                </span>
                    Sign in with Google
                  </button>
            )}
            
            {user && (
              <button onClick={signOut} className="mobile-sign-out">
                <span className="button-icon">🚪</span>
                Sign out
              </button>
            )}
                </div>
              )}
            </div>
      
      <style jsx>{`
        .site-header {
          background-color: var(--card);
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
          position: sticky;
          top: 0;
          z-index: 50;
          transition: all 0.3s ease;
        }
        
        .site-header.scrolled {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          backdrop-filter: blur(8px);
          background-color: rgba(var(--card-rgb, 255, 255, 255), 0.8);
        }
        
        /* Add dark mode support for scrolled header */
        :global(.dark) .site-header.scrolled {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
          background-color: rgba(var(--card-rgb, 17, 24, 39), 0.8);
        }
        
        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 4.5rem;
        }
        
        .logo-container {
          display: flex;
          align-items: center;
        }
        
        .logo {
          display: flex;
          align-items: center;
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--primary);
          text-decoration: none;
          transition: transform 0.2s;
          font-family: 'Montserrat', 'Arial', sans-serif;
        }
        
        .logo:hover {
          transform: scale(1.05);
          text-decoration: none;
        }
        
        .logo-icon {
          margin-right: 0.5rem;
          font-size: 1.5rem;
        }
        
        .logo-text {
          background: linear-gradient(to right, var(--primary), var(--secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-transform: none;
          letter-spacing: 0.02em;
          text-decoration: none;
        }
        
        .desktop-nav {
          height: 100%;
          display: none;
        }
        
        @media (min-width: 640px) {
          .desktop-nav {
            display: flex;
            margin-left: 2rem;
            align-items: center;
          }
        }
        
        .nav-link {
          display: inline-flex;
          align-items: center;
          padding: 0.5rem 1rem;
          margin: 0 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--foreground);
          opacity: 0.7;
          text-decoration: none;
          border-radius: 0.375rem;
          transition: all 0.2s ease;
          position: relative;
          height: 100%;
        }
        
        .nav-icon {
          margin-right: 0.5rem;
          font-size: 1rem;
        }
        
        .nav-link:hover {
          text-decoration: none;
          opacity: 0.9;
          background-color: rgba(var(--primary-rgb), 0.05);
        }
        
        .nav-link.active {
          color: var(--foreground);
          opacity: 1;
          background-color: rgba(var(--primary-rgb), 0.08);
          font-weight: 700;
          border: none;
          box-shadow: none;
        }
        
        .nav-link.active .nav-text {
          background: linear-gradient(to right, var(--primary), var(--secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        /* Dark mode specific styles */
        :global(.dark) .nav-link {
          color: rgba(255, 255, 255, 0.9);
          opacity: 0.9;
        }
        
        :global(.dark) .nav-link:hover {
          color: white;
          opacity: 1;
        }
        
        :global(.dark) .nav-link.active {
          color: white;
          opacity: 1;
          background-color: rgba(var(--primary-rgb), 0.15);
          font-weight: 700;
          border: none;
          box-shadow: none;
        }
        
        :global(.dark) .nav-link.active .nav-text {
          background: linear-gradient(to right, var(--primary), var(--secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .header-actions {
          display: flex;
          align-items: center;
        }
        
        .user-placeholder {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 9999px;
          background-color: var(--input);
          margin-left: 0.75rem;
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .user-menu {
          position: relative;
          margin-left: 0.75rem;
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
        }
        
        .user-button:hover {
          transform: scale(1.05);
        }
        
        .user-avatar {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 9999px;
          object-fit: cover;
          border: 2px solid var(--primary);
        }
        
        .user-initial {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 9999px;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          color: white;
          font-weight: 600;
          border: 2px solid transparent;
        }
        
        .dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 0.5rem;
          width: 14rem;
          background-color: var(--card);
          border-radius: var(--radius);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          z-index: 20;
          animation: slideDown 0.2s ease-out;
        }
        
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .user-info {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
        }
        
        .user-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--foreground);
          margin-bottom: 0.25rem;
        }
        
        .user-email {
          font-size: 0.75rem;
          color: var(--foreground);
          opacity: 0.7;
        }
        
        .menu-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 0.75rem 1rem;
          text-align: left;
          font-size: 0.875rem;
          color: var(--foreground);
          background: none;
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: background-color 0.2s;
        }
        
        .menu-icon {
          margin-right: 0.75rem;
          font-size: 1rem;
        }
        
        .menu-item:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
        
        .sign-in-button {
          display: none;
        }
        
        @media (min-width: 640px) {
          .sign-in-button {
            display: inline-flex;
            align-items: center;
            margin-left: 0.75rem;
            padding: 0.5rem 1rem;
            background: linear-gradient(to right, var(--primary), var(--secondary));
            color: white;
            font-size: 0.875rem;
            font-weight: 500;
            border-radius: 9999px;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          
          .sign-in-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          
          .button-icon {
            display: flex;
            margin-right: 0.5rem;
          }
        }
        
        .mobile-menu-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          margin-left: 0.5rem;
          background: none;
          border: none;
          cursor: pointer;
        }
        
        @media (min-width: 640px) {
          .mobile-menu-button {
            display: none;
          }
        }
        
        .menu-icon {
          position: relative;
          width: 1.5rem;
          height: 1.25rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        
        .menu-icon span {
          display: block;
          width: 100%;
          height: 2px;
          background-color: var(--foreground);
          border-radius: 9999px;
          transition: all 0.3s;
        }
        
        .menu-icon.open span:nth-child(1) {
          transform: translateY(10px) rotate(45deg);
        }
        
        .menu-icon.open span:nth-child(2) {
          opacity: 0;
        }
        
        .menu-icon.open span:nth-child(3) {
          transform: translateY(-10px) rotate(-45deg);
        }
        
        .mobile-menu {
          display: flex;
          flex-direction: column;
          padding: 0.5rem 0;
          border-top: 1px solid var(--border);
          animation: fadeIn 0.3s ease-out;
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
          font-size: 1rem;
          color: var(--foreground);
          text-decoration: none;
          transition: background-color 0.2s;
        }
        
        .mobile-nav-link.active {
          color: var(--primary);
          background-color: rgba(var(--primary-rgb, 79, 70, 229), 0.1);
        }
        
        .mobile-sign-in,
        .mobile-sign-out {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 0.75rem 1rem;
          margin-top: 0.5rem;
          text-align: left;
          font-size: 1rem;
          background: none;
          border: none;
          border-top: 1px solid var(--border);
          cursor: pointer;
        }
        
        .mobile-sign-in {
          color: var(--primary);
        }
        
        .mobile-sign-out {
          color: #ef4444;
        }
        
        .button-icon {
          display: flex;
          margin-right: 0.75rem;
        }
      `}</style>
    </header>
  );
} 