'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import api from '../../lib/api';
import ThemeToggle from '../../components/layout/ThemeToggle';

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
    href: '/admin/venues',
    label: 'Địa điểm',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        <circle cx="12" cy="9" r="2.5" />
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
  {
    href: '/admin/contacts',
    label: 'Liên hệ',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <rect x="2" y="4" width="20" height="16" rx="3" />
        <path d="M2 7l10 7 10-7" />
      </svg>
    ),
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [pendingContacts, setPendingContacts] = useState(0);

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

  useEffect(() => {
    if (!authorized) return;
    const fetchCount = () => {
      api.get('/contact')
        .then((r) => {
          const count = Array.isArray(r.data) ? r.data.filter((m: any) => m.status === 'PENDING').length : 0;
          setPendingContacts(count);
        })
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [authorized]);

  if (loading || !authorized) {
    return (
      <div className="adm-loading">
        <div className="edp-spinner" />
        <span>Đang xác thực...</span>
      </div>
    );
  }

  return (
    <div className="adm-layout">
      <aside className="adm-sidebar">
        <Link href="/" className="adm-logo">Vietix</Link>
        <nav className="adm-nav">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const isContact = item.href === '/admin/contacts';
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`adm-nav-link ${isActive ? 'adm-nav-link--active' : ''}`}
              >
                <span className="adm-nav-icon">{item.icon}</span>
                {item.label}
                {isContact && pendingContacts > 0 && (
                  <span className="adm-nav-noti">{pendingContacts}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="adm-sidebar-bottom">
          <div className="adm-theme-row">
            <ThemeToggle />
            <span className="adm-theme-label">Giao diện</span>
          </div>
          <Link href="/" className="adm-nav-link adm-back-link">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
              <path d="M15 19l-7-7 7-7" />
            </svg>
            Về trang chính
          </Link>
          {userEmail && (
            <div className="adm-user-info">
              <div className="adm-user-avatar">
                {userEmail.slice(0, 2).toUpperCase()}
              </div>
              <div className="adm-user-detail">
                <div className="adm-user-name">{userEmail.split('@')[0]}</div>
                <div className="adm-user-role">Admin</div>
              </div>
            </div>
          )}
        </div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
