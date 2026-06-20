import Link from 'next/link';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'My Tickets', href: '/my-tickets' },
  { label: 'Login', href: '/login' },
  { label: 'All Events', href: '/events' },
];

const supportLinks = [
  { label: 'FAQ', href: '#' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Terms of Service', href: '#' },
  { label: 'Privacy Policy', href: '#' },
];

export default function Footer() {
  return (
    <footer className="oz-footer">
      <div className="oz-footer__accent" />
      <div className="oz-footer__inner">
        <div className="oz-footer__grid">

          {/* Brand */}
          <div>
            <p className="oz-footer__logo">Vietix</p>
            <p className="oz-footer__desc">
              Event ticket booking platform with realtime inventory updates.
              Find, book, and experience the moments that matter.
            </p>
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

          {/* Navigate */}
          <div>
            <p className="oz-footer__col-title">Navigate</p>
            <div className="oz-footer__links">
              {navLinks.map(({ label, href }) => (
                <Link key={label} href={href} className="oz-footer__link">
                  <span className="oz-footer__link-bar" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Support */}
          <div>
            <p className="oz-footer__col-title">Support</p>
            <div className="oz-footer__links">
              {supportLinks.map(({ label, href }) => (
                <a key={label} href={href} className="oz-footer__link">
                  <span className="oz-footer__link-bar" />
                  {label}
                </a>
              ))}
            </div>
          </div>

        </div>

        <div className="oz-footer__bottom">
          <p className="oz-footer__copy">
            © 2026 <strong>Vietix</strong>. All rights reserved.
          </p>
          <p className="oz-footer__tagline">
            Made with <span>♥</span> for live experiences
          </p>
        </div>
      </div>
    </footer>
  );
}