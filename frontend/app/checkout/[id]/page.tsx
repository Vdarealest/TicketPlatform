'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AxiosError } from 'axios';

import api from '@/lib/api';
import { formatCurrencyVND } from '@/lib/format';

interface ReservationDetail {
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

export default function CheckoutPage() {
  const params = useParams<{ id: string }>();

  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [payState, setPayState] = useState<PayState>('idle');
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get<ReservationDetail>(`/reservations/${params.id}`)
      .then((res) => { if (active) setReservation(res.data); })
      .catch((err: AxiosError<{ message?: string }>) => {
        if (!active) return;
        setLoadError(err.response?.data?.message || 'Không tìm thấy đơn giữ vé.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.id]);

  useEffect(() => {
    if (!reservation || reservation.status !== 'HOLD') {
      setRemaining(null);
      return;
    }

    const tick = () => {
      const secs = Math.max(0, Math.round((new Date(reservation.expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(secs);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [reservation]);

  const handleConfirm = async () => {
    if (!reservation) return;
    setPayState('loading');
    setPayError(null);
    try {
      const res = await api.post(`/payments/mock-success/${reservation.id}`);
      setReservation((prev) => prev ? { ...prev, status: res.data.reservation.status } : prev);
      setPayState('success');
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setPayState('error');
      setPayError(axiosErr.response?.data?.message || axiosErr.message || 'Thanh toán không thành công.');
    }
  };

  if (loading) {
    return (
      <div className="tsp-loading">
        <div className="edp-spinner" />
        <span>Đang tải...</span>
      </div>
    );
  }

  if (loadError || !reservation) {
    return (
      <div className="tsp-error">
        <p>{loadError || 'Không tìm thấy đơn giữ vé.'}</p>
        <Link href="/events" className="tsp-error__link">← Về danh sách sự kiện</Link>
      </div>
    );
  }

  const { ticket, seat } = reservation;
  const event = ticket.event;
  const expired = reservation.status === 'HOLD' && remaining === 0;
  const formattedRemaining = remaining !== null ? `00:${String(remaining).padStart(2, '0')}` : null;

  const formattedDate = event.startTime
    ? new Date(event.startTime).toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <main className="tsp-root">
      <div className="tsp-inner checkout-inner">

        <div className="tsp-header">
          {reservation.status === 'HOLD' && !expired && (
            <Link href={`/events/${event.id}/tickets`} className="tsp-back">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M9.5 3L5 8l4.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Quay lại chọn ghế
            </Link>
          )}
          <h1 className="tsp-title">Thanh toán</h1>
        </div>

        <div className="checkout-card tsp-card">

          <div className="tsp-header__main">
            <img
              src={event.bannerUrl ? (event.bannerUrl.startsWith('http') ? event.bannerUrl : `/img/${event.bannerUrl}`) : '/img/placeholder.jpg'}
              alt={event.title}
              className="tsp-header__img"
              style={{ objectPosition: `${event.bannerFocusX ?? 50}% ${event.bannerFocusY ?? 50}%` }}
            />
            <div className="tsp-header__info">
              <h2 className="tsp-card__title" style={{ display: 'block' }}>{event.title}</h2>
              <div className="tsp-header__meta">
                {formattedDate && (
                  <span className="tsp-header__meta-item">{formattedDate}</span>
                )}
                {event.location && (
                  <span className="tsp-header__meta-item">{event.location}</span>
                )}
              </div>
            </div>
          </div>

          <div className="tsp-summary__divider" style={{ margin: '20px 0' }} />

          <div className="tsp-summary__rows">
            <div className="tsp-summary__row">
              <span>Loại vé</span>
              <strong>{ticket.type}</strong>
            </div>
            <div className="tsp-summary__divider" />
            <div className="tsp-summary__row">
              <span>Ghế</span>
              <strong>{seat ? seat.label : '—'}</strong>
            </div>
            <div className="tsp-summary__divider" />
            <div className="tsp-summary__row">
              <span>Giá vé</span>
              <strong className="tsp-summary__price">{formatCurrencyVND(ticket.price)}</strong>
            </div>
          </div>

          {payState === 'success' || reservation.status === 'CONFIRMED' ? (
            <div className="tsp-alert tsp-alert--success">
              🎉 Thanh toán thành công! Vé của bạn đã được xác nhận.
              <Link href={`/events/${event.id}`} className="tsp-alert__link">Về trang sự kiện →</Link>
            </div>
          ) : expired ? (
            <div className="tsp-alert tsp-alert--error">
              ⏱ Đã hết thời gian giữ ghế. Vui lòng chọn lại ghế.
              <Link href={`/events/${event.id}/tickets`} className="tsp-alert__link">Chọn lại ghế →</Link>
            </div>
          ) : (
            <>
              {formattedRemaining && (
                <p className="tsp-summary__timer">
                  ⏱ Hoàn tất thanh toán trong <strong>{formattedRemaining}</strong>
                </p>
              )}

              {payState === 'error' && (
                <div className="tsp-alert tsp-alert--error">{payError}</div>
              )}

              <button
                type="button"
                onClick={handleConfirm}
                disabled={payState === 'loading'}
                className="tsp-reserve-btn"
              >
                {payState === 'loading' ? (
                  <><span className="tsp-btn-spinner" /> Đang xử lý...</>
                ) : 'Xác nhận thanh toán'}
              </button>
            </>
          )}

          <p className="tsp-summary__note">🔒 Thanh toán bảo mật · Hoàn tiền trong 24h</p>
        </div>

      </div>
    </main>
  );
}
