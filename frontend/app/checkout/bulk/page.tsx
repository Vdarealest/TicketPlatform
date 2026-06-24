'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import api from '@/lib/api';
import { formatCurrencyVND } from '@/lib/format';

interface ReservationItem {
  id: number;
  status: string;
  expiresAt: string;
  seat: { id: number; label: string } | null;
  ticket: {
    id: number;
    type: string;
    price: number;
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
type PayMethod = 'vnpay' | 'momo';
type MomoMethod = 'captureWallet' | 'payWithATM';

const formatMMSS = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function BulkCheckoutPage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get('ids') || '';
  const deadlineParam = searchParams.get('deadline');

  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [payState, setPayState] = useState<PayState>('idle');
  const [payError, setPayError] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>('vnpay');
  const [momoMethod, setMomoMethod] = useState<MomoMethod>('captureWallet');

  const ids = idsParam.split(',').map(Number).filter(Boolean);

  useEffect(() => {
    if (!ids.length) { setLoadError('Không có đơn đặt vé nào.'); setLoading(false); return; }
    let active = true;
    setLoading(true);
    api.post('/reservations/bulk/details', { ids })
      .then((res) => { if (active) setReservations(res.data); })
      .catch(() => { if (active) setLoadError('Không thể tải thông tin đặt vé.'); })
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
      const endpoint = payMethod === 'momo'
        ? '/payments/momo/create-url'
        : '/payments/vnpay/create-url';
      const payload = payMethod === 'momo'
        ? { reservationIds: ids, requestType: momoMethod }
        : { reservationIds: ids };
      const res = await api.post(endpoint, payload);
      const { paymentUrl } = res.data;
      if (paymentUrl) {
        window.location.href = paymentUrl;
      } else {
        throw new Error('Không nhận được URL thanh toán.');
      }
    } catch (err: any) {
      setPayState('error');
      setPayError(err.response?.data?.message || 'Không thể tạo liên kết thanh toán.');
    }
  };

  if (loading) return <div className="tsp-loading"><div className="edp-spinner" /><span>Đang tải...</span></div>;

  if (loadError || !reservations.length) {
    return (
      <div className="tsp-error">
        <p>{loadError || 'Không tìm thấy đơn đặt vé.'}</p>
        <Link href="/" className="tsp-error__link">Về trang chủ</Link>
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
    ? new Date(event.startTime).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const bannerSrc = event.bannerUrl
    ? (event.bannerUrl.startsWith('http') ? event.bannerUrl : `/img/${event.bannerUrl}`)
    : '/img/placeholder.jpg';

  return (
    <main className="tsp-root">
      <div className="tsp-inner checkout-inner" style={{ margin: '0 auto' }}>

        {/* Header */}
        <div className="tsp-header">
          <Link href={`/events/${event.id}/tickets`} className="tsp-back">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M9.5 3L5 8l4.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Quay lại chọn ghế
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
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111', margin: '0 0 6px' }}>Thanh toán thành công!</h2>
              <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
                {reservations.length} vé {ticketType} — {seatLabels}
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <Link href="/my-tickets" style={{ padding: '10px 20px', borderRadius: 10, background: '#111', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                  Xem vé của tôi
                </Link>
                <Link href={`/events/${event.id}`} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #e5e7ea', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                  Về sự kiện
                </Link>
              </div>
            </div>
          ) : expired ? (
            <div className="tsp-alert tsp-alert--error" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <p style={{ fontWeight: 700, marginBottom: 6 }}>Hết thời gian giữ ghế</p>
              <p>Vui lòng quay lại chọn ghế và thử lại.</p>
              <Link href={`/events/${event.id}/tickets`} className="tsp-alert__link">Chọn ghế lại</Link>
            </div>
          ) : (
            <>
              <div className="tsp-summary__header" style={{ marginBottom: 4 }}>
                <p className="tsp-summary__label">Xác nhận thanh toán</p>
              </div>

              {/* Seat list */}
              <div style={{ margin: '12px 0', border: '1px solid #f0f2f5', borderRadius: 12, overflow: 'hidden' }}>
                {reservations.map((r, i) => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', borderBottom: i < reservations.length - 1 ? '1px solid #f4f4f5' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Ghế {r.seat?.label || '—'}</span>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{ticketType}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{formatCurrencyVND(unitPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="tsp-summary__divider" />

              <div className="tsp-summary__rows">
                <div className="tsp-summary__row">
                  <span>Số lượng</span>
                  <strong>{reservations.length} vé</strong>
                </div>
                <div className="tsp-summary__divider" />
                <div className="tsp-summary__row">
                  <span>Tổng thanh toán</span>
                  <strong className="tsp-summary__price">{formatCurrencyVND(totalPrice)}</strong>
                </div>
              </div>

              {remaining !== null && allHold && (
                <p className="tsp-summary__timer">
                  Ghế đang được giữ — còn <strong>{formatMMSS(remaining)}</strong>
                </p>
              )}

              {/* Chọn phương thức thanh toán */}
              <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '18px 0 10px' }}>
                Phương thức thanh toán
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {([
                  { key: 'vnpay' as const, label: 'VNPay', desc: 'ATM, Visa, QR', logoBg: '#0a5cb8', logoText: 'VN' },
                  { key: 'momo' as const, label: 'MoMo', desc: 'Ví MoMo', logoBg: '#a50064', logoText: 'M' },
                ]).map((m) => {
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
                        border: active ? '2px solid #111' : '1.5px solid #e5e7ea',
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
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{m.label}</span>
                        <span style={{ fontSize: 11.5, color: '#9ca3af' }}>{m.desc}</span>
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
                    Cách thanh toán MoMo
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {([
                      { key: 'captureWallet' as const, label: 'Ví MoMo', desc: 'Quét QR bằng app' },
                      { key: 'payWithATM' as const, label: 'Thẻ ATM', desc: 'Qua cổng MoMo' },
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
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{mm.label}</span>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>{mm.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {payError && <div className="tsp-alert tsp-alert--error" style={{ marginTop: 14 }}>{payError}</div>}

              <button
                type="button"
                onClick={handlePay}
                disabled={payState === 'loading'}
                className="tsp-reserve-btn"
                style={{ background: payMethod === 'momo' ? '#a50064' : '#0a5cb8', marginTop: 16 }}
              >
                {payState === 'loading'
                  ? <><span className="tsp-btn-spinner" /> Đang chuyển đến {payMethod === 'momo' ? 'MoMo' : 'VNPay'}...</>
                  : `Thanh toán qua ${payMethod === 'momo' ? 'MoMo' : 'VNPay'} — ${formatCurrencyVND(totalPrice)}`}
              </button>

              <p className="tsp-summary__note">
                {payMethod === 'momo'
                  ? (momoMethod === 'payWithATM'
                      ? 'Thanh toán qua thẻ ATM nội địa — cổng MoMo'
                      : 'Quét QR bằng app MoMo để thanh toán bằng ví')
                  : 'Thanh toán bảo mật qua VNPay — Hỗ trợ ATM, Visa, MasterCard, QR Pay'}
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
