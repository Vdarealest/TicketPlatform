'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const NAV_LINKS = [
  { label: 'Events', href: '/events' },
  { label: 'My Tickets', href: '/my-tickets' },
];

const AVATAR_COLORS = ['#e02020', '#0f35ff', '#007aff', '#34aadc', '#10b981', '#f59e0b', '#8b5cf6'];

function getAvatarColor(email: string) {
  return AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length];
}

function getInitials(email: string) {
  const local = email.split('@')[0];
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function decodeJwtEmail(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.email ?? null;
  } catch {
    return null;
  }
}

export default function Navbar() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refreshAuth = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      const email = decodeJwtEmail(token);
      setUserEmail(email);
    } else {
      setUserEmail(null);
    }
  }, []);

  useEffect(() => {
    refreshAuth();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'access_token') refreshAuth();
    };
    const onAuthChanged = () => refreshAuth();

    window.addEventListener('storage', onStorage);
    window.addEventListener('auth-changed', onAuthChanged);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('auth-changed', onAuthChanged);
    };
  }, [refreshAuth]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [dropdownOpen]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    window.dispatchEvent(new Event('auth-changed'));
    setDropdownOpen(false);
    router.push('/');
  };

  return (
    <nav className={`onezone-nav ${scrolled ? 'onezone-nav--scrolled' : ''}`}>
      <div className="onezone-nav__inner">

        {/* LEFT */}
        <div className="onezone-nav__left">
          <Link href="/" className="onezone-nav__logo">Vietix</Link>
          <div className="onezone-nav__links">
            {NAV_LINKS.map((item) => (
              <Link key={item.label} href={item.href} className="onezone-nav__link">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* CENTER */}
        <div className="onezone-nav__search-wrap">
          <div className={`onezone-nav__search ${searchFocused ? 'onezone-nav__search--focused' : ''}`}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="onezone-nav__search-icon">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              placeholder="Search events..."
              className="onezone-nav__search-input"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </div>
        </div>

        {/* RIGHT */}
        <div className="onezone-nav__right">
          {userEmail ? (
            <div className="nav-avatar-wrap" ref={dropdownRef}>
              <button
                className="nav-avatar-btn"
                onClick={() => setDropdownOpen((o) => !o)}
                style={{ '--avatar-color': getAvatarColor(userEmail) } as React.CSSProperties}
                aria-label="Tài khoản"
                aria-expanded={dropdownOpen}
              >
                <span className="nav-avatar-initials">{getInitials(userEmail)}</span>
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  className={`nav-avatar-chevron ${dropdownOpen ? 'nav-avatar-chevron--open' : ''}`}
                >
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="nav-dropdown">
                  <div className="nav-dropdown__header">
                    <div className="nav-dropdown__avatar" style={{ background: getAvatarColor(userEmail) }}>
                      {getInitials(userEmail)}
                    </div>
                    <div className="nav-dropdown__email-wrap">
                      <span className="nav-dropdown__label">Đăng nhập với</span>
                      <span className="nav-dropdown__email">{userEmail}</span>
                    </div>
                  </div>

                  <div className="nav-dropdown__divider" />

                  <Link href="/profile" className="nav-dropdown__item" onClick={() => setDropdownOpen(false)}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M2.5 13.5c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    Hồ sơ của tôi
                  </Link>

                  <Link href="/my-tickets" className="nav-dropdown__item" onClick={() => setDropdownOpen(false)}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <rect x="1.5" y="4.5" width="13" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M5.5 4.5v7M10.5 4.5v7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    Vé của tôi
                  </Link>

                  <div className="nav-dropdown__divider" />

                  <button className="nav-dropdown__item nav-dropdown__item--logout" onClick={handleLogout}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M10.5 10.5L13.5 8l-3-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M13.5 8H6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="onezone-nav__login">
              Đăng nhập
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
        </div>

      </div>
    </nav>
  );
}
