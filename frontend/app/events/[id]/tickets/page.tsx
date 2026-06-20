'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AxiosError } from 'axios';

import api from '@/lib/api';
import { socket } from '@/lib/socket';
import { EventDetail, Seat, Ticket } from '@/lib/types';
import { formatCurrencyVND } from '@/lib/format';
import TicketTypeCard from '@/components/tickets/TicketTypeCard';
import SeatMap, { getZoneColor } from '@/components/tickets/SeatMap';

interface SeatUpdatePayload {
  ticketId: number;
  seatId: number;
  status: Seat['status'];
}

interface TicketUpdatePayload {
  ticketId: number;
  availableQuantity: number;
}

interface HoldInfo {
  id: number;
  expiresAt: number;
}

const SESSION_DURATION = 5 * 60; // seconds to complete the whole selection flow

const formatMMSS = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function TicketSelectionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [hold, setHold] = useState<HoldInfo | null>(null);
  const [holdLoading, setHoldLoading] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [sessionDeadline] = useState(() => Date.now() + SESSION_DURATION * 1000);
  const [sessionRemaining, setSessionRemaining] = useState(SESSION_DURATION);

  const holdRef = useRef<HoldInfo | null>(null);
  const skipCancelRef = useRef(false);

  useEffect(() => {
    holdRef.current = hold;
  }, [hold]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get<EventDetail>(`/events/${params.id}`)
      .then((res) => {
        if (!active) return;
        setEvent(res.data);
        if (res.data.tickets?.length) setSelectedTicket(res.data.tickets[0]);
      })
      .catch(() => { if (active) setLoadError('Không thể tải thông tin sự kiện.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.id]);

  useEffect(() => {
    const eventId = params.id;

    socket.emit('join-event', { eventId });

    const handleSeatUpdate = (payload: SeatUpdatePayload) => {
      setEvent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tickets: prev.tickets.map((ticket) =>
            ticket.id !== payload.ticketId || !ticket.seats
              ? ticket
              : {
                  ...ticket,
                  seats: ticket.seats.map((seat) =>
                    seat.id === payload.seatId ? { ...seat, status: payload.status } : seat
                  ),
                }
          ),
        };
      });

      setSelectedSeat((prev) => {
        if (!prev || prev.id !== payload.seatId) return prev;
        // Seat reverted to AVAILABLE elsewhere (hold expired) -> clear our selection
        if (payload.status === 'AVAILABLE') {
          setHold(null);
          return null;
        }
        return { ...prev, status: payload.status };
      });
    };

    const handleTicketUpdate = (payload: TicketUpdatePayload) => {
      setEvent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tickets: prev.tickets.map((ticket) =>
            ticket.id === payload.ticketId ? { ...ticket, quantity: payload.availableQuantity } : ticket
          ),
        };
      });
    };

    socket.on('seat-update', handleSeatUpdate);
    socket.on('ticket-update', handleTicketUpdate);

    return () => {
      socket.emit('leave-event', { eventId });
      socket.off('seat-update', handleSeatUpdate);
      socket.off('ticket-update', handleTicketUpdate);
    };
  }, [params.id]);

  // Countdown for the active seat hold
  useEffect(() => {
    if (!hold) {
      setRemaining(null);
      return;
    }

    const tick = () => {
      const secs = Math.max(0, Math.round((hold.expiresAt - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        setHold(null);
        setSelectedSeat(null);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [hold]);

  // Overall session countdown — starts the moment this page is opened
  useEffect(() => {
    const tick = () => {
      const secs = Math.max(0, Math.round((sessionDeadline - Date.now()) / 1000));
      setSessionRemaining(secs);
      if (secs <= 0) {
        if (holdRef.current) cancelHold(holdRef.current.id);
        skipCancelRef.current = true;
        router.replace(`/events/${params.id}`);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sessionDeadline, params.id, router]);

  // Release the hold if the user navigates away (but not when going to checkout)
  useEffect(() => {
    return () => {
      if (!skipCancelRef.current && holdRef.current) {
        api.post(`/reservations/${holdRef.current.id}/cancel`).catch(() => {});
      }
    };
  }, []);

  const cancelHold = async (id: number) => {
    try {
      await api.post(`/reservations/${id}/cancel`);
    } catch {
      // best-effort
    }
  };

  const handleSelectSeat = async (ticket: Ticket, seat: Seat) => {
    setHoldError(null);

    // Click on our own held seat again -> deselect / release the hold
    if (selectedSeat?.id === seat.id) {
      if (hold) {
        setHoldLoading(true);
        await cancelHold(hold.id);
        setHold(null);
        setHoldLoading(false);
      }
      setSelectedSeat(null);
      return;
    }

    if (seat.status !== 'AVAILABLE') return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      setHoldError('Bạn cần đăng nhập để chọn ghế.');
      return;
    }

    setHoldLoading(true);
    const previousHold = hold;

    try {
      const res = await api.post(`/reservations/${ticket.id}`, { seatId: seat.id });
      const reservation = res.data.reservation;

      setSelectedTicket(ticket);
      setSelectedSeat(seat);
      setHold({ id: reservation.id, expiresAt: new Date(reservation.expiresAt).getTime() });

      if (previousHold) cancelHold(previousHold.id);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setHoldError(
        axiosErr.response?.data?.message || axiosErr.message || 'Không thể giữ ghế này, vui lòng thử lại.'
      );
    } finally {
      setHoldLoading(false);
    }
  };

  const handleSelectTicket = (ticket: Ticket) => {
    if (selectedSeat && !ticket.seats?.some((s) => s.id === selectedSeat.id)) {
      if (hold) cancelHold(hold.id);
      setHold(null);
      setSelectedSeat(null);
    }
    setSelectedTicket(ticket);
  };

  const handleReserve = () => {
    if (!hold) return;
    skipCancelRef.current = true;
    router.push(`/checkout/${hold.id}`);
  };

  if (loading) {
    return (
      <div className="tsp-loading">
        <div className="edp-spinner" />
        <span>Đang tải...</span>
      </div>
    );
  }

  if (loadError || !event) {
    return (
      <div className="tsp-error">
        <p>{loadError || 'Không tìm thấy sự kiện.'}</p>
        <Link href={`/events/${params.id}`} className="tsp-error__link">← Quay lại trang sự kiện</Link>
      </div>
    );
  }

  const tickets = event.tickets ?? [];

  const formattedDate = event.startTime
    ? new Date(event.startTime).toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const step = !selectedTicket ? 1 : !selectedSeat ? 2 : 3;
  const zoneColor = selectedTicket ? getZoneColor(selectedTicket.type, tickets.findIndex((t) => t.id === selectedTicket.id)).color : '#e02020';
  const formattedRemaining = remaining !== null ? formatMMSS(remaining) : null;
  const sessionFormatted = formatMMSS(sessionRemaining);
  const sessionLow = sessionRemaining <= 60;

  return (
    <main className="tsp-root">
      <div className="tsp-inner">

        {/* Header */}
        <div className="tsp-header">
          <Link href={`/events/${event.id}`} className="tsp-back">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M9.5 3L5 8l4.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Quay lại sự kiện
          </Link>

          <div className="tsp-header__main">
            <img
              src={event.bannerUrl ? `/img/${event.bannerUrl}` : '/img/placeholder.jpg'}
              alt={event.title}
              className="tsp-header__img"
            />
            <div className="tsp-header__info">
              <h1 className="tsp-title">{event.title}</h1>
              <div className="tsp-header__meta">
                {formattedDate && (
                  <span className="tsp-header__meta-item">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M1 6h14" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M5 1v2M11 1v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    {formattedDate}
                  </span>
                )}
                {event.location && (
                  <span className="tsp-header__meta-item">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1C4.79 1 3 2.79 3 5c0 3.25 4 8 4 8s4-4.75 4-8c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.4"/>
                      <circle cx="7" cy="5" r="1.2" fill="currentColor"/>
                    </svg>
                    {event.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="tsp-stepper">
          <div className={`tsp-step ${step >= 1 ? 'tsp-step--active' : ''}`}>
            <span className="tsp-step__num">1</span>
            <span className="tsp-step__label">Chọn loại vé</span>
          </div>
          <div className={`tsp-step__line ${step >= 2 ? 'tsp-step__line--active' : ''}`} />
          <div className={`tsp-step ${step >= 2 ? 'tsp-step--active' : ''}`}>
            <span className="tsp-step__num">2</span>
            <span className="tsp-step__label">Chọn ghế</span>
          </div>
          <div className={`tsp-step__line ${step >= 3 ? 'tsp-step__line--active' : ''}`} />
          <div className={`tsp-step ${step >= 3 ? 'tsp-step--active' : ''}`}>
            <span className="tsp-step__num">3</span>
            <span className="tsp-step__label">Xác nhận &amp; đặt vé</span>
          </div>
        </div>

        <div className="tsp-layout">

          {/* LEFT */}
          <div className="tsp-left">

            {/* Ticket type selection */}
            <section className="tsp-card">
              <div className="tsp-card__header">
                <h2 className="tsp-card__title">
                  <span className="tsp-card__step">1</span>
                  Chọn loại vé
                </h2>
                {tickets.length > 0 && (
                  <span className="tsp-card__badge">{tickets.length} loại vé</span>
                )}
              </div>
              {tickets.length === 0 ? (
                <p className="tsp-empty-text">Hiện chưa có vé nào được mở bán.</p>
              ) : (
                <div className="tsp-ticket-list">
                  {tickets.map((ticket, i) => (
                    <TicketTypeCard
                      key={ticket.id}
                      ticket={ticket}
                      index={i}
                      selected={selectedTicket?.id === ticket.id}
                      onSelect={handleSelectTicket}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Seat map */}
            <section className="tsp-card">
              <div className="tsp-card__header">
                <h2 className="tsp-card__title">
                  <span className="tsp-card__step">2</span>
                  Chọn ghế
                </h2>
              </div>
              <SeatMap
                tickets={tickets}
                selectedSeat={selectedSeat}
                onSelectSeat={handleSelectSeat}
                busy={holdLoading}
              />
            </section>

          </div>

          {/* RIGHT: summary */}
          <aside className="tsp-aside">
            <div className="tsp-summary">
              <div className="tsp-summary__header">
                <span className="tsp-card__step">3</span>
                <p className="tsp-summary__label">Tóm tắt &amp; đặt vé</p>
              </div>

              {selectedTicket ? (
                <div className="tsp-summary__rows">
                  <div className="tsp-summary__row">
                    <span>Vé đã chọn</span>
                    <strong className="tsp-summary__chip">
                      <span className="tsp-summary__chip-dot" style={{ background: zoneColor }} />
                      {selectedTicket.type}
                    </strong>
                  </div>
                  <div className="tsp-summary__divider" />
                  <div className="tsp-summary__row">
                    <span>Ghế đã chọn</span>
                    <strong className={selectedSeat ? '' : 'tsp-summary__placeholder'}>
                      {selectedSeat ? selectedSeat.label : 'Chưa chọn'}
                    </strong>
                  </div>
                  <div className="tsp-summary__divider" />
                  <div className="tsp-summary__row">
                    <span>Giá vé</span>
                    <strong className="tsp-summary__price">{formatCurrencyVND(selectedTicket.price)}</strong>
                  </div>
                  <div className="tsp-summary__divider" />
                  <div className="tsp-summary__row">
                    <span>Còn lại</span>
                    <strong>{selectedTicket.quantity} vé</strong>
                  </div>
                </div>
              ) : (
                <p className="tsp-empty-text" style={{ padding: '16px 0' }}>Vui lòng chọn một loại vé.</p>
              )}

              {selectedTicket && !selectedSeat && (
                <p className="tsp-summary__hint">👉 Chọn một ghế còn trống trên sơ đồ để tiếp tục.</p>
              )}

              {selectedSeat && formattedRemaining && (
                <p className="tsp-summary__timer">
                  ⏱ Ghế đang được giữ cho bạn — còn <strong>{formattedRemaining}</strong>
                </p>
              )}

              {holdError && (
                <div className="tsp-alert tsp-alert--error">{holdError}</div>
              )}

              <button
                type="button"
                onClick={handleReserve}
                disabled={!hold || holdLoading}
                className="tsp-reserve-btn"
                style={hold ? { background: zoneColor } : undefined}
              >
                {holdLoading ? (
                  <><span className="tsp-btn-spinner" /> Đang giữ ghế...</>
                ) : 'Tiến hành thanh toán'}
              </button>

              <p className="tsp-summary__note">🔒 Thanh toán bảo mật · Hoàn tiền trong 24h</p>
            </div>
          </aside>

        </div>
      </div>

      <div className={`tsp-session-bar ${sessionLow ? 'tsp-session-bar--low' : ''}`}>
        <span className="tsp-session-bar__icon">⏳</span>
        <strong className="tsp-session-bar__time">{sessionFormatted}</strong>
        <span className="tsp-session-bar__label">Thời gian<br />giữ chỗ</span>
      </div>
    </main>
  );
}
