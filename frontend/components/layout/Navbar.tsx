'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api from '../../lib/api';
import { useTranslation } from '../../lib/i18n';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import { backendUrl } from '@/lib/config';

const NAV_KEYS = [
  { key: 'nav_events' as const, href: '/events' },
  { key: 'nav_my_tickets' as const, href: '/my-tickets' },
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
  const { t } = useTranslation();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Mobile (<=640px) menu: links, contact, language and theme move here.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const refreshAuth = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      const email = decodeJwtEmail(token);
      setUserEmail(email);
      api.get('/users/profile')
        .then((res) => {
          setUserRole(res.data?.role || null);
          setUserAvatar(res.data?.avatarUrl || null);
          setUserName(res.data?.name || null);
        })
        .catch(() => {
          api.get('/auth/me')
            .then((res) => setUserRole(res.data?.role || null))
            .catch(() => setUserRole(null));
        });
    } else {
      setUserEmail(null);
      setUserRole(null);
      setUserAvatar(null);
      setUserName(null);
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

  // Close the mobile menu on navigation, Escape and outside clicks.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || menuBtnRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [menuOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    router.push(q ? `/events?search=${encodeURIComponent(q)}` : '/events');
  };

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
            {NAV_KEYS.map((item) => (
              <Link key={item.key} href={item.href} className="onezone-nav__link">
                {t[item.key]}
              </Link>
            ))}
          </div>
        </div>

        {/* CENTER */}
        <div className="onezone-nav__search-wrap">
          <form onSubmit={handleSearch} className={`onezone-nav__search ${searchFocused ? 'onezone-nav__search--focused' : ''}`}>
            <button type="submit" className="onezone-nav__search-icon" aria-label="Tìm kiếm" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex' }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <input
              placeholder={t.nav_search}
              className="onezone-nav__search-input"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </form>
        </div>

        {/* RIGHT: Liên hệ → Ngôn ngữ → Dark mode → Profile */}
        <div className="onezone-nav__right">
          <Link href="/contact" className="nav-header-link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="M2 7l10 7 10-7" />
            </svg>
            <span className="nav-header-link__text">{t.nav_contact}</span>
          </Link>
          <LanguageSwitcher />
          <ThemeToggle />
          {userEmail ? (
            <div className="nav-avatar-wrap" ref={dropdownRef}>
              <button
                className="nav-avatar-btn"
                onClick={() => setDropdownOpen((o) => !o)}
                style={{ '--avatar-color': getAvatarColor(userEmail) } as React.CSSProperties}
                aria-label="Tài khoản"
                aria-expanded={dropdownOpen}
              >
                {userAvatar ? (
                  <img
                    src={backendUrl(userAvatar)}
                    alt=""
                    className="nav-avatar-img"
                  />
                ) : (
                  <span className="nav-avatar-initials">{getInitials(userEmail)}</span>
                )}
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
                    {userAvatar ? (
                      <img
                        src={backendUrl(userAvatar)}
                        alt=""
                        className="nav-dropdown__avatar nav-dropdown__avatar--img"
                      />
                    ) : (
                      <div className="nav-dropdown__avatar" style={{ background: getAvatarColor(userEmail) }}>
                        {getInitials(userEmail)}
                      </div>
                    )}
                    <div className="nav-dropdown__email-wrap">
                      {userName && <span className="nav-dropdown__name">{userName}</span>}
                      <span className={userName ? 'nav-dropdown__email' : 'nav-dropdown__label'}>{userName ? userEmail : t.nav_login_with}</span>
                      {!userName && <span className="nav-dropdown__email">{userEmail}</span>}
                    </div>
                  </div>

                  <div className="nav-dropdown__divider" />

                  <Link href="/profile" className="nav-dropdown__item" onClick={() => setDropdownOpen(false)}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M2.5 13.5c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    {t.nav_profile}
                  </Link>

                  <Link href="/my-tickets" className="nav-dropdown__item" onClick={() => setDropdownOpen(false)}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <rect x="1.5" y="4.5" width="13" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M5.5 4.5v7M10.5 4.5v7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    {t.nav_tickets}
                  </Link>

                  {userRole === 'ADMIN' && (
                    <Link href="/admin" className="nav-dropdown__item" onClick={() => setDropdownOpen(false)}>
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                        <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                      </svg>
                      {t.nav_admin}
                    </Link>
                  )}

                  <div className="nav-dropdown__divider" />

                  <button className="nav-dropdown__item nav-dropdown__item--logout" onClick={handleLogout}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M10.5 10.5L13.5 8l-3-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M13.5 8H6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    {t.nav_logout}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="onezone-nav__login">
              {t.nav_login}
            </Link>
          )}
          <button
            ref={menuBtnRef}
            type="button"
            className={`nav-menu-btn ${menuOpen ? 'nav-menu-btn--open' : ''}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={t.nav_menu}
            aria-expanded={menuOpen}
            aria-controls="nav-mobile-menu"
          >
            <span className="nav-menu-btn__bar" />
            <span className="nav-menu-btn__bar" />
            <span className="nav-menu-btn__bar" />
          </button>
        </div>

      </div>

      {menuOpen && (
        <div id="nav-mobile-menu" className="nav-mobile-menu" ref={menuRef}>
          {NAV_KEYS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="nav-mobile-menu__item"
              onClick={() => setMenuOpen(false)}
            >
              {t[item.key]}
            </Link>
          ))}
          <Link href="/contact" className="nav-mobile-menu__item" onClick={() => setMenuOpen(false)}>
            {t.nav_contact}
          </Link>
          <div className="nav-mobile-menu__divider" />
          <div className="nav-mobile-menu__row">
            <span>{t.nav_language}</span>
            <LanguageSwitcher />
          </div>
          <div className="nav-mobile-menu__row">
            <span>{t.nav_appearance}</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </nav>
  );
}
