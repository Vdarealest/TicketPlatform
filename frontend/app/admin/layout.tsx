'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import api from '../../lib/api';

const NAV_ITEMS = [
  {
    href: '/admin',
    label: 'Tổng quan',
    exact: true,
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/admin/events',
    label: 'Sự kiện',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    href: '/admin/users',
    label: 'Người dùng',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
      </svg>
    ),
  },
  {
    href: '/admin/orders',
    label: 'Đơn hàng',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
];

const S = {
  layout: { display: 'flex', minHeight: '100dvh', background: '#f0f2f5', fontFamily: "'DM Sans', sans-serif" } as const,
  sidebar: {
    width: 230, background: '#fff', display: 'flex', flexDirection: 'column' as const, flexShrink: 0,
    position: 'fixed' as const, top: 0, left: 0, bottom: 0, zIndex: 100,
    borderRight: '1px solid #e8eaed', boxShadow: '2px 0 8px rgba(0,0,0,0.03)',
  },
  logo: {
    fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '0.05em',
    color: '#e02020', padding: '22px 24px 20px', lineHeight: 1, textDecoration: 'none', display: 'block',
    borderBottom: '1px solid #f0f2f5',
  },
  nav: { display: 'flex', flexDirection: 'column' as const, gap: 2, padding: '16px 12px', flex: 1 },
  link: (active: boolean) => ({
    display: 'flex', alignItems: 'center' as const, gap: 12, padding: '10px 14px', borderRadius: 10,
    fontSize: 13.5, fontWeight: active ? 600 : 500,
    color: active ? '#e02020' : '#6b7280',
    background: active ? 'rgba(224,32,32,0.06)' : 'transparent',
    textDecoration: 'none', transition: 'all 0.15s',
    borderLeft: active ? '3px solid #e02020' : '3px solid transparent',
  }),
  linkIcon: (active: boolean) => ({ width: 18, height: 18, flexShrink: 0, opacity: active ? 1 : 0.55, color: active ? '#e02020' : '#6b7280' } as const),
  bottom: { padding: '16px 12px', borderTop: '1px solid #f0f2f5' },
  main: { flex: 1, marginLeft: 230, padding: '28px 36px 48px', minHeight: '100dvh' } as const,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.replace('/login'); return; }
    api.get('/auth/me')
      .then((res) => {
        if (res.data?.role !== 'ADMIN') { router.replace('/'); }
        else { setAuthorized(true); setUserEmail(res.data.email || ''); }
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: 12, color: '#a1a1aa', fontSize: 14 }}>
        <div className="edp-spinner" />
        <span>Đang xác thực...</span>
      </div>
    );
  }

  return (
    <div style={S.layout}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <Link href="/" style={S.logo}>Vietix</Link>
        <nav style={S.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} style={S.link(isActive)}>
                <span style={S.linkIcon(isActive)}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={S.bottom}>
          <Link href="/" style={{ ...S.link(false), fontSize: 13, color: '#9ca3af' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
              <path d="M15 19l-7-7 7-7" />
            </svg>
            Về trang chính
          </Link>
          {userEmail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 4px', marginTop: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#e02020',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {userEmail.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail.split('@')[0]}
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>Admin</div>
              </div>
            </div>
          )}
        </div>
      </aside>
      <main style={S.main}>{children}</main>
    </div>
  );
}
