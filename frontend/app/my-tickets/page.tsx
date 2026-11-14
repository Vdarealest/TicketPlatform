'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

// ─── helpers ─────────────────────────────────────────────────────────────────

function decodeJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

function fmtDateTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

function fmtPrice(n: number) {
  return n.toLocaleString('vi-VN') + '₫';
}

function fmtRef(id: number) {
  return '#' + String(id).padStart(5, '0');
}

// ─── status config ────────────────────────────────────────────────────────────

function getStatusCfg(status: string, t: any) {
  const map: Record<string, { label: string; color: string; cls: string }> = {
    HOLD:      { label: t.status_hold,      color: '#f59e0b', cls: 'tk-badge--hold' },
    CONFIRMED: { label: t.status_confirmed, color: '#10b981', cls: 'tk-badge--confirmed' },
    PAID:      { label: t.status_paid,      color: '#10b981', cls: 'tk-badge--confirmed' },
    EXPIRED:   { label: t.status_expired,   color: '#52525b', cls: 'tk-badge--expired' },
    CANCELLED: { label: t.status_cancelled, color: '#52525b', cls: 'tk-badge--expired' },
  };
  return map[status] ?? { label: status, color: '#52525b', cls: 'tk-badge--expired' };
}

// ─── types ────────────────────────────────────────────────────────────────────

interface Reservation {
  id: number;
  status: string;
  createdAt: string;
  expiresAt: string;
  confirmationCode: string | null;
  seat?: { id: number; label: string } | null;
  ticket: {
    id: number;
    type: string;
    price: number;
    event: {
      id: number;
      title: string;
      location: string;
      startTime: string;
      endTime: string;
      bannerUrl: string;
    };
  };
}

// ─── filter ───────────────────────────────────────────────────────────────────

// Only purchased tickets are shown here. HOLD/EXPIRED/CANCELLED are excluded.
const PURCHASED = ['CONFIRMED', 'PAID'];

type FilterKey = 'active' | 'history';

const FILTER_KEYS: { key: FilterKey; tKey: 'mt_tab_active' | 'mt_tab_history' }[] = [
  { key: 'active',  tKey: 'mt_tab_active' },
  { key: 'history', tKey: 'mt_tab_history' },
];

function applyFilter(list: Reservation[], f: FilterKey) {
  const purchased = list.filter(r => PURCHASED.includes(r.status));
  const now = Date.now();
  if (f === 'active') {
    // event hasn't ended yet (or no endTime info)
    return purchased.filter(r => {
      const end = r.ticket?.event?.endTime;
      return !end || new Date(end).getTime() > now;
    });
  }
  // history: event has already ended
  return purchased.filter(r => {
    const end = r.ticket?.event?.endTime;
    return !!end && new Date(end).getTime() <= now;
  });
}

// ─── QR code component ──────────────────────────────────────────────────────

function TicketQr({ code }: { code: string | null }) {
  if (!code) {
    return (
      <svg className="tk-qr-svg" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="2"  y="2"  width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="6"  y="6"  width="8"  height="8"  fill="currentColor"/>
        <rect x="26" y="2"  width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="30" y="6"  width="8"  height="8"  fill="currentColor"/>
        <rect x="2"  y="26" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="6"  y="30" width="8"  height="8"  fill="currentColor"/>
        <rect x="26" y="26" width="4"  height="4"  fill="currentColor"/>
        <rect x="32" y="26" width="4"  height="4"  fill="currentColor"/>
        <rect x="38" y="26" width="4"  height="4"  fill="currentColor"/>
        <rect x="26" y="32" width="4"  height="4"  fill="currentColor"/>
        <rect x="38" y="32" width="4"  height="4"  fill="currentColor"/>
        <rect x="26" y="38" width="4"  height="4"  fill="currentColor"/>
        <rect x="32" y="38" width="4"  height="4"  fill="currentColor"/>
      </svg>
    );
  }
  return (
    <QRCodeSVG
      value={code}
      size={72}
      level="M"
      bgColor="transparent"
      fgColor="#1a1a2e"
      className="tk-qr-svg"
    />
  );
}

// ─── ticket card ─────────────────────────────────────────────────────────────

function TicketCard({ r }: { r: Reservation }) {
  const { t } = useTranslation();
  const s = getStatusCfg(r.status, t);
  const isExpired = ['EXPIRED', 'CANCELLED'].includes(r.status);
  const eventTitle = r.ticket?.event?.title ?? t.event;
  const location   = r.ticket?.event?.location ?? '—';
  const startTime  = r.ticket?.event?.startTime ?? r.createdAt;
  const price      = r.ticket?.price ?? 0;
  const type       = r.ticket?.type ?? '—';
  const seatLabel  = r.seat?.label;

  return (
    <article className={`tk-card${isExpired ? ' tk-card--expired' : ''}`}>
      {/* colored left accent bar */}
      <div className="tk-accent" style={{ background: s.color }} />

      {/* main body */}
      <div className="tk-body">
        <h2 className="tk-event-title">{eventTitle}</h2>

        <div className="tk-meta-row">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 1v3M11 1v3M1.5 6.5h13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span>{fmtDateTime(startTime)}</span>
        </div>

        <div className="tk-meta-row">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 1.5A4.5 4.5 0 0 1 12.5 6c0 3-4.5 8.5-4.5 8.5S3.5 9 3.5 6A4.5 4.5 0 0 1 8 1.5z" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          <span>{location}</span>
        </div>

        <div className="tk-bottom-row">
          <span className="tk-ref">{fmtRef(r.id)}</span>
          <span className="tk-type-pill">{type}</span>
          {seatLabel && <span className="tk-type-pill" style={{ background: '#fef2f2', color: '#e02020' }}>{t.mt_seat} {seatLabel}</span>}
        </div>
      </div>

      {/* dashed divider + punch holes */}
      <div className="tk-divider" role="presentation">
        <div className="tk-punch tk-punch--top" />
        <div className="tk-punch tk-punch--bot" />
      </div>

      {/* stub */}
      <div className="tk-stub">
        <span className="tk-stub-logo">Vietix</span>
        <div className="tk-price">{fmtPrice(price)}</div>
        <span className={`tk-badge ${s.cls}`}>{s.label}</span>
        <div className="tk-qr-wrap">
          <TicketQr code={r.confirmationCode} />
        </div>
        {r.confirmationCode && (
          <p style={{ margin: '4px 0 0', fontSize: 9, color: '#9ca3af', fontFamily: 'monospace', textAlign: 'center', wordBreak: 'break-all' }}>
            {r.confirmationCode}
          </p>
        )}
      </div>
    </article>
  );
}

// ─── skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return <div className="mt-sk-card" aria-hidden="true" />;
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function MyTicketsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('active');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.replace('/login'); return; }
    if (!decodeJwt(token)?.email) { router.replace('/login'); return; }

    api.get('/reservations/my', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (Array.isArray(r.data)) setReservations(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const visible = useMemo(() => applyFilter(reservations, filter), [reservations, filter]);

  return (
    <main className="mt-root">
      <div className="mt-wrap">

        {/* header */}
        <div className="mt-header">
          <Link href="/profile" className="mt-back">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t.mt_profile}
          </Link>
          <h1 className="mt-title">
            {t.mt_title}
            {!loading && (
              <span className="mt-count">
                {reservations.filter(r => PURCHASED.includes(r.status)).length}
              </span>
            )}
          </h1>
        </div>

        {/* filter tabs */}
        <div className="mt-tabs" role="tablist" aria-label="Lọc vé">
          {FILTER_KEYS.map(f => {
            const count = applyFilter(reservations, f.key).length;
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                className={`mt-tab${filter === f.key ? ' mt-tab--active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {t[f.tKey]}
                {!loading && (
                  <span className="mt-tab-count">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* content */}
        {loading ? (
          <div className="mt-list">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-empty">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
              <rect x="4" y="14" width="44" height="30" rx="4" stroke="#2e2f3a" strokeWidth="2"/>
              <path d="M4 22h44" stroke="#2e2f3a" strokeWidth="2"/>
              <circle cx="13" cy="18" r="2" fill="#2e2f3a"/>
              <circle cx="21" cy="18" r="2" fill="#2e2f3a"/>
              <path d="M20 35c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#2e2f3a" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="26" cy="29" r="2" fill="#2e2f3a"/>
            </svg>
            <p className="mt-empty-msg">
              {filter === 'active'
                ? t.mt_empty_active
                : t.mt_empty_history}
            </p>
            <p className="mt-empty-sub">{t.mt_empty_cta}</p>
            <Link href="/events" className="mt-empty-cta">{t.mt_view_events}</Link>
          </div>
        ) : (
          <div className="mt-list">
            {visible.map(r => <TicketCard key={r.id} r={r} />)}
          </div>
        )}

      </div>
    </main>
  );
}
