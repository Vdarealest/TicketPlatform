'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import api from '@/lib/api';
import { formatCurrencyVND } from '@/lib/format';
import { resolveImageUrl } from '@/lib/image';

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
type PayMethod = 'vnpay' | 'momo' | 'vietqr';
type MomoMethod = 'captureWallet' | 'payWithATM';
interface QrData { qrUrl: string; orderId: string; amount: number; bankId: string; accountNo: string; accountName: string; }

const formatMMSS = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function BulkCheckoutPage() {
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

  const ids = idsParam.split(',').map(Number).filter(Boolean);

  useEffect(() => {
    if (!ids.length) { setLoadError('Không có đơn đặt vé nào.'); setLoading(false); return; }
    let active = true;
    setLoading(true);
    api.post('/reservations/bulk/details', { ids, guestToken })
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
        throw new Error('Không nhận được URL thanh toán.');
      }
    } catch (err: any) {
      setPayState('error');
      setPayError(err.response?.data?.message || 'Không thể tạo liên kết thanh toán.');
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
        throw new Error(res.data?.message || 'Xác nhận thất bại.');
      }
    } catch (err: any) {
      setPayError(err.response?.data?.message || 'Không thể xác nhận thanh toán.');
    } finally {
      setConfirming(false);
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

  const bannerSrc = resolveImageUrl(event.bannerUrl);

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
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>Thanh toán thành công!</h2>
              <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 20 }}>
                {reservations.length} vé {ticketType} — {seatLabels}
              </p>
              {guestToken && (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                  📧 Vé và mã xác nhận đã được gửi đến email bạn đăng ký.
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {!guestToken && (
                  <Link href="/my-tickets" style={{ padding: '10px 20px', borderRadius: 10, background: '#111', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                    Xem vé của tôi
                  </Link>
                )}
                <Link href={`/events/${event.id}`} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border-input)', background: 'var(--surface-primary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
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
              <div style={{ margin: '12px 0', border: '1px solid var(--border-secondary)', borderRadius: 12, overflow: 'hidden' }}>
                {reservations.map((r, i) => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', borderBottom: i < reservations.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Ghế {r.seat?.label || '—'}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>{ticketType}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrencyVND(unitPrice)}</span>
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

              {/* VietQR: mã QR hiện ngay, xác nhận thủ công (luồng test nhanh) */}
              {qr ? (
                <div style={{ marginTop: 18, textAlign: 'center' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                    Quét mã VietQR để thanh toán
                  </p>
                  <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 16, border: '1px solid var(--border-input)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr.qrUrl} alt="VietQR" style={{ width: 240, height: 240, display: 'block' }} />
                  </div>
                  <div style={{ margin: '14px 0 4px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <div>Số tiền: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrencyVND(qr.amount)}</strong></div>
                    <div>Nội dung: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{qr.orderId}</strong></div>
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
                      ? <><span className="tsp-btn-spinner" /> Đang xác nhận...</>
                      : 'Tôi đã thanh toán'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQr(null); setPayError(null); }}
                    disabled={confirming}
                    style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Chọn phương thức khác
                  </button>
                  <p className="tsp-summary__note" style={{ marginTop: 10 }}>
                    Chế độ test — bấm &quot;Tôi đã thanh toán&quot; để xác nhận ngay (không cần chuyển khoản thật).
                  </p>
                </div>
              ) : (
              <>
              {/* Chọn phương thức thanh toán */}
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '18px 0 10px' }}>
                Phương thức thanh toán
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {([
                  { key: 'vnpay' as const, label: 'VNPay', desc: 'ATM, Visa', logoBg: '#0a5cb8', logoText: 'VN' },
                  { key: 'momo' as const, label: 'MoMo', desc: 'Ví MoMo', logoBg: '#a50064', logoText: 'M' },
                  { key: 'vietqr' as const, label: 'VietQR', desc: 'Test nhanh', logoBg: '#0a8a5f', logoText: 'QR' },
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
                      ? <><span className="tsp-btn-spinner" /> Đang xử lý...</>
                      : payMethod === 'vietqr'
                        ? `Tạo mã VietQR — ${formatCurrencyVND(totalPrice)}`
                        : `Thanh toán qua ${label} — ${formatCurrencyVND(totalPrice)}`}
                  </button>
                );
              })()}

              <p className="tsp-summary__note">
                {payMethod === 'momo'
                  ? (momoMethod === 'payWithATM'
                      ? 'Thanh toán qua thẻ ATM nội địa — cổng MoMo'
                      : 'Quét QR bằng app MoMo để thanh toán bằng ví')
                  : payMethod === 'vietqr'
                    ? 'VietQR — chế độ test, xác nhận thủ công ngay trên trang, không cần chuyển khoản thật.'
                    : 'Thanh toán bảo mật qua VNPay — Hỗ trợ ATM, Visa, MasterCard, QR Pay'}
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
