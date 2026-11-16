'use client';

import { useState, useEffect, useRef } from 'react';

const LANGS = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export function getLang(): string {
  if (typeof window === 'undefined') return 'vi';
  return localStorage.getItem('lang') || 'vi';
}

export default function LanguageSwitcher() {
  const [lang, setLang] = useState('vi');
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLang(getLang());
    setMounted(true);

    // A second switcher lives in the mobile menu; follow changes made there.
    const onChanged = () => setLang(getLang());
    window.addEventListener('lang-changed', onChanged);
    return () => window.removeEventListener('lang-changed', onChanged);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const select = (code: string) => {
    setLang(code);
    localStorage.setItem('lang', code);
    setOpen(false);
    window.dispatchEvent(new Event('lang-changed'));
  };

  const current = LANGS.find((l) => l.code === lang) || LANGS[0];

  if (!mounted) return <div className="lang-toggle" style={{ width: 60, height: 36 }} />;

  return (
    <div className="lang-wrap" ref={ref}>
      <button className="lang-toggle" onClick={() => setOpen(!open)} aria-label="Chọn ngôn ngữ">
        <span className="lang-flag">{current.flag}</span>
        <span className="lang-code">{current.code.toUpperCase()}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`lang-chevron ${open ? 'lang-chevron--open' : ''}`}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="lang-dropdown">
          {LANGS.map((l) => (
            <button
              key={l.code}
              className={`lang-option ${l.code === lang ? 'lang-option--active' : ''}`}
              onClick={() => select(l.code)}
            >
              <span className="lang-flag">{l.flag}</span>
              <span>{l.label}</span>
              {l.code === lang && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="lang-check">
                  <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
