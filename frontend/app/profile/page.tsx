'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

// ─── helpers ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#e02020', '#0f35ff', '#007aff', '#34aadc', '#10b981', '#f59e0b', '#8b5cf6'];

function avatarColor(email: string) {
  return AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(email: string) {
  const local = email.split('@')[0];
  const parts = local.split(/[._-]/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : local.slice(0, 2).toUpperCase();
}

function decodeJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtPrice(n: number) {
  return n.toLocaleString('vi-VN') + '₫';
}

// ─── status badge ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  HOLD:       { label: 'Đang giữ',   cls: 'pp-badge--hold' },
  CONFIRMED:  { label: 'Đã xác nhận', cls: 'pp-badge--confirmed' },
  PAID:       { label: 'Đã thanh toán', cls: 'pp-badge--confirmed' },
  EXPIRED:    { label: 'Hết hạn',    cls: 'pp-badge--expired' },
  CANCELLED:  { label: 'Đã huỷ',     cls: 'pp-badge--expired' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'pp-badge--expired' };
  return <span className={`pp-status-badge ${s.cls}`}>{s.label}</span>;
}

// ─── types ────────────────────────────────────────────────────────────────────

interface UserInfo {
  id: number;
  email: string;
  googleId: string | null;
  role: string;
}

interface Reservation {
  id: number;
  status: string;
  createdAt: string;
  ticket: {
    name: string;
    price: number;
    event: { name: string; date?: string };
  };
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState<number | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.replace('/login'); return; }

    const payload = decodeJwt(token);
    if (!payload?.email) { router.replace('/login'); return; }
    setEmail(payload.email);
    setJoinedAt(payload.iat ?? null);

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      api.get('/auth/me', { headers }).then(r => r.data).catch(() => null),
      api.get('/reservations/my', { headers }).then(r => r.data).catch(() => []),
    ]).then(([me, res]) => {
      if (me) setUser(me);
      if (Array.isArray(res)) setReservations(res.slice(0, 3));
      setLoading(false);
    });
  }, [router]);

  const logout = () => {
    localStorage.removeItem('access_token');
    window.dispatchEvent(new Event('auth-changed'));
    router.push('/');
  };

  // ── skeleton ──
  if (loading) {
    return (
      <main className="pp-root">
        <div className="pp-wrap">
          <div className="pp-hero-card">
            <div className="pp-sk-circle" />
            <div className="pp-sk-line" style={{ width: '40%' }} />
            <div className="pp-sk-line" style={{ width: '60%', height: 12 }} />
          </div>
        </div>
      </main>
    );
  }

  const color = avatarColor(email!);
  const inits = initials(email!);
  const displayName = email!.split('@')[0];
  const isGoogle = !!user?.googleId;
  const totalRes = reservations.length;   // only loaded 3 but enough for badge

  return (
    <main className="pp-root">
      <div className="pp-wrap">

        {/* ── hero ─────────────────────────────────── */}
        <div className="pp-hero-card">
          <div className="pp-avatar-ring" style={{ '--ac': color } as React.CSSProperties}>
            <div className="pp-avatar" style={{ background: color }}>{inits}</div>
          </div>

          <div className="pp-identity">
            <h1 className="pp-display-name">{displayName}</h1>
            <span className="pp-email-text">{email}</span>

            <div className="pp-pill-row">
              {isGoogle && (
                <span className="pp-pill pp-pill--google">
                  <svg width="12" height="12" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Google
                </span>
              )}
              {!isGoogle && (
                <span className="pp-pill pp-pill--email">
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Email
                </span>
              )}
              <span className="pp-pill pp-pill--role">{user?.role ?? 'USER'}</span>
            </div>
          </div>

          {/* stats row */}
          <div className="pp-stats">
            <div className="pp-stat">
              <span className="pp-stat__num">{totalRes}</span>
              <span className="pp-stat__label">Đặt chỗ</span>
            </div>
            <div className="pp-stat-divider" />
            <div className="pp-stat">
              <span className="pp-stat__num">{joinedAt ? new Date(joinedAt * 1000).getFullYear() : '-'}</span>
              <span className="pp-stat__label">Tham gia từ</span>
            </div>
            <div className="pp-stat-divider" />
            <div className="pp-stat">
              <span className="pp-stat__num">{user?.role === 'ADMIN' ? 'Admin' : 'Member'}</span>
              <span className="pp-stat__label">Hạng</span>
            </div>
          </div>
        </div>

        {/* ── recent reservations ───────────────────── */}
        <div className="pp-section">
          <div className="pp-section-head">
            <span className="pp-section-title">Đặt chỗ gần đây</span>
            <Link href="/my-tickets" className="pp-section-link">
              Xem tất cả
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6h8M6 2.5L9.5 6 6 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>

          {reservations.length === 0 ? (
            <div className="pp-empty">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="6" width="20" height="14" rx="2" stroke="#c7c7cc" strokeWidth="1.5"/>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#c7c7cc" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 6v14M16 6v14" stroke="#c7c7cc" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span>Chưa có đặt chỗ nào</span>
              <Link href="/events" className="pp-empty-cta">Khám phá sự kiện</Link>
            </div>
          ) : (
            <div className="pp-res-list">
              {reservations.map((r) => (
                <div key={r.id} className="pp-res-item">
                  <div className="pp-res-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="1.5" y="4.5" width="13" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M5.5 4.5v7M10.5 4.5v7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="pp-res-body">
                    <span className="pp-res-event">{r.ticket?.event?.name ?? 'Sự kiện'}</span>
                    <span className="pp-res-meta">
                      {r.ticket?.name} · {fmtPrice(r.ticket?.price ?? 0)} · {fmtDate(r.createdAt)}
                    </span>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── account info ─────────────────────────── */}
        <div className="pp-section">
          <div className="pp-section-head">
            <span className="pp-section-title">Thông tin tài khoản</span>
          </div>
          <div className="pp-info-table">
            <div className="pp-info-row">
              <span className="pp-info-key">Email</span>
              <span className="pp-info-val">{email}</span>
            </div>
            <div className="pp-info-row">
              <span className="pp-info-key">Đăng nhập qua</span>
              <span className="pp-info-val">{isGoogle ? 'Google' : 'Email & Mật khẩu'}</span>
            </div>
            <div className="pp-info-row">
              <span className="pp-info-key">Quyền</span>
              <span className="pp-info-val">{user?.role ?? 'USER'}</span>
            </div>
            {joinedAt && (
              <div className="pp-info-row">
                <span className="pp-info-key">Phiên đăng nhập</span>
                <span className="pp-info-val">{fmtDate(new Date(joinedAt * 1000).toISOString())}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── logout ───────────────────────────────── */}
        <button className="pp-logout-btn" onClick={logout}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M10.5 10.5L13.5 8l-3-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.5 8H6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Đăng xuất
        </button>

      </div>
    </main>
  );
}
