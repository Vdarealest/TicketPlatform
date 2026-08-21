'use client';

import Link from 'next/link';
import { useTranslation } from '../../lib/i18n';

export default function Footer() {
  const { t } = useTranslation();

  const navLinks = [
    { label: t.footer_home, href: '/' },
    { label: t.nav_my_tickets, href: '/my-tickets' },
    { label: t.nav_login, href: '/login' },
    { label: t.nav_events, href: '/events' },
  ];

  const supportLinks = [
    { label: 'FAQ', href: '/faq' },
    { label: t.nav_contact, href: '/contact' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
  ];

  return (
    <footer className="oz-footer">
      <div className="oz-footer__accent" />
      <div className="oz-footer__inner">
        <div className="oz-footer__grid">

          <div>
            <p className="oz-footer__logo">Vietix</p>
            <p className="oz-footer__desc">{t.footer_desc}</p>
            <div className="oz-footer__socials">
              <a href="#" aria-label="Instagram" className="oz-footer__social-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a href="#" aria-label="TikTok" className="oz-footer__social-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.17 8.17 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
                </svg>
              </a>
              <a href="#" aria-label="Facebook" className="oz-footer__social-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <p className="oz-footer__col-title">{t.footer_navigate}</p>
            <div className="oz-footer__links">
              {navLinks.map(({ label, href }) => (
                <Link key={href} href={href} className="oz-footer__link">
                  <span className="oz-footer__link-bar" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="oz-footer__col-title">{t.footer_support}</p>
            <div className="oz-footer__links">
              {supportLinks.map(({ label, href }) => (
                <Link key={href} href={href} className="oz-footer__link">
                  <span className="oz-footer__link-bar" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

        </div>

        <div className="oz-footer__bottom">
          <p className="oz-footer__copy">
            © 2026 <strong>Vietix</strong>. {t.footer_rights}
          </p>
          
        </div>
      </div>
    </footer>
  );
}
