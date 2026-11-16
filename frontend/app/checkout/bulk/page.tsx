'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import api, { apiErrorMessage } from '@/lib/api';
import { formatCurrencyVND } from '@/lib/format';
import { cdnImage } from '@/lib/image';
import { useTranslation, fmt, tr } from '@/lib/i18n';

interface ReservationItem {
  id: number;
  status: string;
  expiresAt: string;
  seat: { id: number; label: string } | null;
  ticket: {
    id: number;
    type: string;
    price: number;
    seating?: 'SEATED' | 'GENERAL';
    event: {
      id: number;
      title: string;
      bannerUrl?: string;
      bannerFocusX?: number;
      bannerFocusY?: number;
      location?: string;
      startTime?: string;
    };
  };
}

type PayState = 'idle' | 'loading' | 'success' | 'error';
type PayMethod = 'vnpay' | 'momo' | 'vietqr';
type MomoMethod = 'captureWallet' | 'payWithATM';
interface QrData { qrUrl: string; orderId: string; amount: number; bankId: string; accountNo: string; accountName: string; }

const formatMMSS = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// MoMo is hidden from checkout for now. The backend routes, the return page and
// all the wiring stay in place — flip this to true to bring the option back.
const SHOW_MOMO = false;

function BulkCheckoutContent() {
  const { t, lang } = useTranslation();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get('ids') || '';
  const deadlineParam = searchParams.get('deadline');
  const guestToken = searchParams.get('guestToken') || undefined;

  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [payState, setPayState] = useState<PayState>('idle');
  const [payError, setPayError] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>('vnpay');
  const [momoMethod, setMomoMethod] = useState<MomoMethod>('captureWallet');
  const [qr, setQr] = useState<QrData | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Hidden until the server says it's on — it refuses VietQR otherwise.
  const [vietqrEnabled, setVietqrEnabled] = useState(false);

  const ids = idsParam.split(',').map(Number).filter(Boolean);

  useEffect(() => {
    api.get('/payments/methods')
      .then((res) => setVietqrEnabled(!!res.data?.vietqr))
      .catch(() => setVietqrEnabled(false));
  }, []);

  useEffect(() => {
    if (!ids.length) { setLoadError('co_no_reservations'); setLoading(false); return; }
    let active = true;
    setLoading(true);
    api.post('/reservations/bulk/details', { ids, guestToken })
      .then((res) => { if (active) setReservations(res.data); })
      .catch(() => { if (active) setLoadError('co_load_failed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [idsParam]);

  // Countdown — tiếp tục từ session deadline của trang chọn vé
  useEffect(() => {
    if (!reservations.length) return;
    const deadline = deadlineParam ? Number(deadlineParam) : null;
    if (!deadline) return;

    const tick = () => {
      const secs = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(secs);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [reservations, deadlineParam]);

  const handlePay = async () => {
    setPayState('loading');
    setPayError(null);
    try {
      // VietQR: no redirect — fetch the QR and show it inline.
      if (payMethod === 'vietqr') {
        const res = await api.post('/payments/vietqr/create', { reservationIds: ids, guestToken });
        setQr(res.data);
        setPayState('idle');
        return;
      }

      const endpoint = payMethod === 'momo'
        ? '/payments/momo/create-url'
        : '/payments/vnpay/create-url';
      const payload = payMethod === 'momo'
        ? { reservationIds: ids, requestType: momoMethod, guestToken }
        : { reservationIds: ids, guestToken };
      const res = await api.post(endpoint, payload);
      const { paymentUrl } = res.data;
      if (paymentUrl) {
        window.location.href = paymentUrl;
      } else {
        throw new Error(t.co_no_pay_url);
      }
    } catch (err) {
      setPayState('error');
      setPayError(apiErrorMessage(err, t.co_pay_link_failed));
    }
  };

  // Manual confirm for VietQR (test flow — no bank webhook).
  const handleConfirmVietQR = async () => {
    if (!qr) return;
    setConfirming(true);
    setPayError(null);
    try {
      const res = await api.post('/payments/vietqr/confirm', { orderId: qr.orderId, guestToken });
      if (res.data?.success) {
        setPayState('success');
      } else {
        throw new Error(res.data?.message || t.co_confirm_failed);
      }
    } catch (err) {
      setPayError(apiErrorMessage(err, t.co_confirm_pay_failed));
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return <div className="tsp-loading"><div className="edp-spinner" /><span>{t.loading}</span></div>;

  if (loadError || !reservations.length) {
    return (
      <div className="tsp-error">
        <p>{loadError ? tr(t, loadError) : t.co_not_found}</p>
        <Link href="/" className="tsp-error__link">{t.co_back_home}</Link>
      </div>
    );
  }

  const firstRes = reservations[0];
  const event = firstRes.ticket.event;
  const ticketType = firstRes.ticket.type;
  const unitPrice = firstRes.ticket.price;
  const totalPrice = unitPrice * reservations.length;
  const allHold = reservations.every((r) => r.status === 'HOLD');
  const expired = remaining !== null && remaining <= 0 && allHold;
  const seatLabels = reservations.map((r) => r.seat?.label).filter(Boolean).join(', ');

  const formattedDate = event.startTime
    ? new Date(event.startTime).toLocaleDateString(lang === 'en' ? 'en-US' : 'vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  // Shown as an 88px thumbnail; 200px stays sharp on 2x screens.
  const bannerSrc = cdnImage(event.bannerUrl, 200);

  const payMethods: { key: PayMethod; label: string; desc?: string; logoBg: string; logoText: string }[] = [
    { key: 'vnpay', label: 'VNPay', desc: 'ATM, Visa', logoBg: '#0a5cb8', logoText: 'VN' },
    ...(SHOW_MOMO
      ? [{ key: 'momo' as PayMethod, label: 'MoMo', desc: t.co_momo_wallet, logoBg: '#a50064', logoText: 'M' }]
      : []),
    ...(vietqrEnabled
      ? [{ key: 'vietqr' as PayMethod, label: 'VietQR', logoBg: '#0a8a5f', logoText: 'QR' }]
      : []),
  ];

  return (
    <main className="tsp-root">
      <div className="tsp-inner checkout-inner" style={{ margin: '0 auto' }}>

        {/* Header */}
        <div className="tsp-header">
          <Link href={`/events/${event.id}/tickets`} className="tsp-back">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M9.5 3L5 8l4.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {t.co_back_to_seats}
          </Link>
          <div className="tsp-header__main">
            <img
              src={bannerSrc} alt={event.title} className="tsp-header__img"
              style={{ objectPosition: `${event.bannerFocusX ?? 50}% ${event.bannerFocusY ?? 50}%` }}
            />
            <div className="tsp-header__info">
              <h1 className="tsp-title">{event.title}</h1>
              <div className="tsp-header__meta">
                {formattedDate && <span className="tsp-header__meta-item">{formattedDate}</span>}
                {event.location && <span className="tsp-header__meta-item">{event.location}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Checkout card */}
        <div className="tsp-summary checkout-card" style={{ marginTop: 24 }}>

          {payState === 'success' ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="28" height="28" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>{t.co_success_title}</h2>
              <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 20 }}>
                {fmt(t.co_n_of_type, { n: reservations.length, type: ticketType })}{seatLabels ? ` — ${seatLabels}` : ''}
              </p>
              {guestToken && (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                  {t.co_email_sent}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {!guestToken && (
                  <Link href="/my-tickets" style={{ padding: '10px 20px', borderRadius: 10, background: '#111', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                    {t.co_view_my_tickets}
                  </Link>
                )}
                <Link href={`/events/${event.id}`} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border-input)', background: 'var(--surface-primary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                  {t.co_back_to_event}
                </Link>
              </div>
            </div>
          ) : expired ? (
            <div className="tsp-alert tsp-alert--error" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <p style={{ fontWeight: 700, marginBottom: 6 }}>{t.co_hold_expired}</p>
              <p>{firstRes.ticket.seating === 'GENERAL' ? t.co_hold_expired_ga : t.co_hold_expired_seated}</p>
              <Link href={`/events/${event.id}/tickets`} className="tsp-alert__link">
                {firstRes.ticket.seating === 'GENERAL' ? t.co_reselect_ga : t.co_reselect_seats}
              </Link>
            </div>
          ) : (
            <>
              <div className="tsp-summary__header" style={{ marginBottom: 4 }}>
                <p className="tsp-summary__label">{t.co_confirm_payment}</p>
              </div>

              {/* Seat list */}
              <div style={{ margin: '12px 0', border: '1px solid var(--border-secondary)', borderRadius: 12, overflow: 'hidden' }}>
                {reservations.map((r, i) => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', borderBottom: i < reservations.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.seat?.label ? fmt(t.co_seat, { label: r.seat.label }) : fmt(t.co_ticket_n, { n: i + 1 })}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>{ticketType}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrencyVND(unitPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="tsp-summary__divider" />

              <div className="tsp-summary__rows">
                <div className="tsp-summary__row">
                  <span>{t.co_quantity}</span>
                  <strong>{fmt(t.co_n_tickets, { n: reservations.length })}</strong>
                </div>
                <div className="tsp-summary__divider" />
                <div className="tsp-summary__row">
                  <span>{t.co_total}</span>
                  <strong className="tsp-summary__price">{formatCurrencyVND(totalPrice)}</strong>
                </div>
              </div>

              {remaining !== null && allHold && (
                <p className="tsp-summary__timer">
                  {firstRes.ticket.seating === 'GENERAL' ? t.co_held_ga : t.co_held_seated} — {t.co_time_left} <strong>{formatMMSS(remaining)}</strong>
                </p>
              )}

              {/* VietQR: mã QR hiện ngay, xác nhận thủ công (luồng test nhanh) */}
              {qr ? (
                <div style={{ marginTop: 18, textAlign: 'center' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                    {t.co_scan_vietqr}
                  </p>
                  <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 16, border: '1px solid var(--border-input)' }}>
                    <img src={qr.qrUrl} alt="VietQR" style={{ width: 240, height: 240, display: 'block' }} />
                  </div>
                  <div style={{ margin: '14px 0 4px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <div>{t.co_amount} <strong style={{ color: 'var(--text-primary)' }}>{formatCurrencyVND(qr.amount)}</strong></div>
                    <div>{t.co_transfer_note} <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{qr.orderId}</strong></div>
                  </div>

                  {payError && <div className="tsp-alert tsp-alert--error" style={{ marginTop: 12 }}>{payError}</div>}

                  <button
                    type="button"
                    onClick={handleConfirmVietQR}
                    disabled={confirming}
                    className="tsp-reserve-btn"
                    style={{ background: '#0a8a5f', marginTop: 14 }}
                  >
                    {confirming
                      ? <><span className="tsp-btn-spinner" /> {t.co_confirming}</>
                      : t.co_i_paid}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQr(null); setPayError(null); }}
                    disabled={confirming}
                    style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {t.co_other_method}
                  </button>
                  <p className="tsp-summary__note" style={{ marginTop: 10 }}>
                    {t.co_test_mode_note}
                  </p>
                </div>
              ) : (
              <>
              {/* Chọn phương thức thanh toán */}
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '18px 0 10px' }}>
                {t.co_payment_method}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${payMethods.length}, 1fr)`, gap: 10 }}>
                {payMethods.map((m) => {
                  const active = payMethod === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setPayMethod(m.key)}
                      disabled={payState === 'loading'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                        border: active ? '2px solid var(--text-primary)' : '1.5px solid var(--border-input)',
                        background: active ? '#fafafa' : '#fff',
                        textAlign: 'left', transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      <span style={{
                        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                        background: m.logoBg, color: '#fff', fontWeight: 800, fontSize: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {m.logoText}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{m.label}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-quaternary)' }}>{m.desc}</span>
                      </span>
                      {active && (
                        <svg width="16" height="16" fill="none" stroke="#111" strokeWidth="2.5" viewBox="0 0 24 24" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Lựa chọn con cho MoMo: ví QR hay thẻ ATM */}
              {payMethod === 'momo' && (
                <div style={{
                  marginTop: 10, padding: '12px 14px', borderRadius: 12,
                  background: '#fdf2f8', border: '1px solid #fbcfe8',
                }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#9d174d', margin: '0 0 8px' }}>
                    {t.co_momo_how}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {([
                      { key: 'captureWallet' as const, label: t.co_momo_wallet, desc: t.co_momo_scan_app },
                      { key: 'payWithATM' as const, label: t.co_atm_card, desc: t.co_via_momo },
                    ]).map((mm) => {
                      const active = momoMethod === mm.key;
                      return (
                        <button
                          key={mm.key}
                          type="button"
                          onClick={() => setMomoMethod(mm.key)}
                          disabled={payState === 'loading'}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                            padding: '9px 11px', borderRadius: 9, cursor: 'pointer',
                            border: active ? '2px solid #a50064' : '1.5px solid #f5d0e3',
                            background: active ? '#fff' : 'transparent',
                            textAlign: 'left', transition: 'border-color 0.15s, background 0.15s',
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{mm.label}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>{mm.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {payError && <div className="tsp-alert tsp-alert--error" style={{ marginTop: 14 }}>{payError}</div>}

              {(() => {
                const label = payMethod === 'momo' ? 'MoMo' : payMethod === 'vietqr' ? 'VietQR' : 'VNPay';
                const bg = payMethod === 'momo' ? '#a50064' : payMethod === 'vietqr' ? '#0a8a5f' : '#0a5cb8';
                return (
                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={payState === 'loading'}
                    className="tsp-reserve-btn"
                    style={{ background: bg, marginTop: 16 }}
                  >
                    {payState === 'loading'
                      ? <><span className="tsp-btn-spinner" /> {t.co_processing}</>
                      : payMethod === 'vietqr'
                        ? fmt(t.co_create_vietqr, { amount: formatCurrencyVND(totalPrice) })
                        : fmt(t.co_pay_via, { method: label, amount: formatCurrencyVND(totalPrice) })}
                  </button>
                );
              })()}

              <p className="tsp-summary__note">
                {payMethod === 'momo'
                  ? (momoMethod === 'payWithATM'
                      ? t.co_note_momo_atm
                      : t.co_note_momo_wallet)
                  : payMethod === 'vietqr'
                    ? t.co_note_vietqr
                    : t.co_note_vnpay}
              </p>
              </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

// useSearchParams() opts the tree into client-side rendering, so Next requires
// a Suspense boundary above it or the production build fails at prerender.
export default function BulkCheckoutPage() {
  return (
    <Suspense fallback={null}>
      <BulkCheckoutContent />
    </Suspense>
  );
}
