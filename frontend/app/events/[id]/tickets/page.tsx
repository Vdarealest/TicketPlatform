'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AxiosError } from 'axios';

import api from '@/lib/api';
import { socket } from '@/lib/socket';
import { EventDetail, Seat, SeatLayout, Ticket } from '@/lib/types';
import { formatCurrencyVND } from '@/lib/format';
import { resolveImageUrl } from '@/lib/image';
import { isOnSale, upcomingLabel, effectiveSaleStatus } from '@/lib/eventStatus';
import TicketTypeCard from '@/components/tickets/TicketTypeCard';
import SeatMap, { getZoneColor } from '@/components/tickets/SeatMap';
import VenueSeatMap from '@/components/tickets/VenueSeatMap';

interface SeatUpdatePayload { ticketId: number; seatId: number; status: Seat['status']; }
interface TicketUpdatePayload { ticketId: number; availableQuantity: number; }

const MAX_SEATS = 10;
const SESSION_DURATION = 5 * 60;

const formatMMSS = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function TicketSelectionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  // GA tickets have no seats to pick — this quantity counter stands in for
  // selectedSeats.length everywhere a SEATED flow would read it.
  const [gaQuantity, setGaQuantity] = useState(1);
  const [reservationIds, setReservationIds] = useState<number[]>([]);
  const [holdLoading, setHoldLoading] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [sessionDeadline] = useState(() => Date.now() + SESSION_DURATION * 1000);
  const [sessionRemaining, setSessionRemaining] = useState(SESSION_DURATION);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestEmailError, setGuestEmailError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('access_token'));
  }, []);

  const reservationIdsRef = useRef<number[]>([]);
  const guestTokenRef = useRef<string | undefined>(undefined);
  const skipCancelRef = useRef(false);

  useEffect(() => { reservationIdsRef.current = reservationIds; }, [reservationIds]);

  // Load event
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get<EventDetail>(`/events/${params.id}`)
      .then((res) => { if (!active) return; setEvent(res.data); if (res.data.tickets?.length) setSelectedTicket(res.data.tickets[0]); })
      .catch(() => { if (active) setLoadError('Không thể tải thông tin sự kiện.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.id]);

  // WebSocket
  useEffect(() => {
    const eventId = params.id;
    socket.emit('join-event', { eventId });

    const handleSeatUpdate = (payload: SeatUpdatePayload) => {
      setEvent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tickets: prev.tickets.map((ticket) =>
            ticket.id !== payload.ticketId || !ticket.seats ? ticket : {
              ...ticket,
              seats: ticket.seats.map((seat) => seat.id === payload.seatId ? { ...seat, status: payload.status } : seat),
            }
          ),
        };
      });

      if (payload.status === 'AVAILABLE') {
        setSelectedSeats((prev) => prev.filter((s) => s.id !== payload.seatId));
      }
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

  // Session countdown
  useEffect(() => {
    const tick = () => {
      const secs = Math.max(0, Math.round((sessionDeadline - Date.now()) / 1000));
      setSessionRemaining(secs);
      if (secs <= 0) {
        if (reservationIdsRef.current.length) cancelAllHolds();
        skipCancelRef.current = true;
        router.replace(`/events/${params.id}`);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sessionDeadline, params.id, router]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!skipCancelRef.current && reservationIdsRef.current.length) {
        api.post('/reservations/bulk/cancel', { ids: reservationIdsRef.current, guestToken: guestTokenRef.current }).catch(() => {});
      }
    };
  }, []);

  const cancelAllHolds = async () => {
    if (!reservationIdsRef.current.length) return;
    try { await api.post('/reservations/bulk/cancel', { ids: reservationIdsRef.current, guestToken: guestTokenRef.current }); } catch {}
  };

  const handleSelectSeat = (ticket: Ticket, seat: Seat) => {
    setHoldError(null);

    // Already selected -> deselect (just remove from local list, bulk cancel happens on reserve/leave)
    if (selectedSeats.some((s) => s.id === seat.id)) {
      setSelectedSeats((prev) => prev.filter((s) => s.id !== seat.id));
      return;
    }

    if (seat.status !== 'AVAILABLE') return;
    if (selectedSeats.length >= MAX_SEATS) {
      setHoldError(`Tối đa ${MAX_SEATS} ghế cho mỗi lần đặt.`);
      return;
    }

    // Must be same ticket type
    if (selectedTicket && selectedTicket.id !== ticket.id && selectedSeats.length > 0) {
      setHoldError('Chỉ có thể chọn ghế cùng một loại vé.');
      return;
    }

    setSelectedTicket(ticket);
    setSelectedSeats((prev) => [...prev, seat]);
  };

  const handleSelectTicket = (ticket: Ticket) => {
    if (selectedSeats.length > 0 && selectedTicket?.id !== ticket.id) {
      setSelectedSeats([]);
      setReservationIds([]);
    }
    if (selectedTicket?.id !== ticket.id) {
      setGaQuantity(1);
    }
    setSelectedTicket(ticket);
  };

  const maxGaQuantity = (ticket: Ticket) => Math.max(0, Math.min(MAX_SEATS, ticket.quantity));
  const adjustGaQuantity = (ticket: Ticket, delta: number) => {
    setGaQuantity((q) => Math.min(maxGaQuantity(ticket), Math.max(1, q + delta)));
  };

  const handleProceedCheckout = async () => {
    if (!selectedTicket) return;
    const isGA = selectedTicket.seating === 'GENERAL';
    if (!isGA && selectedSeats.length === 0) return;

    if (!isLoggedIn) {
      const email = guestEmail.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setGuestEmailError('Vui lòng nhập email hợp lệ để nhận vé.');
        return;
      }
      setGuestEmailError(null);
    }

    setHoldLoading(true);
    setHoldError(null);

    try {
      let res;
      if (isGA) {
        const body: { quantity: number; guestEmail?: string } = { quantity: gaQuantity };
        if (!isLoggedIn) body.guestEmail = guestEmail.trim();
        res = await api.post(`/reservations/${selectedTicket.id}/general`, body);
      } else {
        const seatIds = selectedSeats.map((s) => s.id);
        const body: { seatIds: number[]; guestEmail?: string } = { seatIds };
        if (!isLoggedIn) body.guestEmail = guestEmail.trim();
        res = await api.post(`/reservations/${selectedTicket.id}/bulk`, body);
      }
      const ids: number[] = res.data.reservationIds;
      const guestToken: string | undefined = res.data.guestToken;
      setReservationIds(ids);
      guestTokenRef.current = guestToken;
      skipCancelRef.current = true;
      const guestParam = guestToken ? `&guestToken=${encodeURIComponent(guestToken)}` : '';
      router.push(`/checkout/bulk?ids=${ids.join(',')}&deadline=${sessionDeadline}${guestParam}`);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setHoldError(axiosErr.response?.data?.message || 'Không thể giữ ghế, vui lòng thử lại.');
    } finally {
      setHoldLoading(false);
    }
  };

  if (loading) return <div className="tsp-loading"><div className="edp-spinner" /><span>Đang tải...</span></div>;
  if (loadError || !event) return <div className="tsp-error"><p>{loadError || 'Không tìm thấy sự kiện.'}</p><Link href={`/events/${params.id}`} className="tsp-error__link">Quay lại trang sự kiện</Link></div>;
  // Block direct-URL access to seat selection before sales open or after the
  // event has ended (backend also enforces this).
  if (!isOnSale(event)) return (
    <div className="tsp-error">
      <p>{effectiveSaleStatus(event) === 'ENDED' ? '🏁 Sự kiện này đã kết thúc.' : `⏳ ${upcomingLabel(event.saleOpenAt, 'vi')}`}</p>
      <Link href={`/events/${params.id}`} className="tsp-error__link">Quay lại trang sự kiện</Link>
    </div>
  );

  const tickets = event.tickets ?? [];
  const rawLayout: SeatLayout | null =
    event.seatLayout?.sections?.length ? event.seatLayout
    : event.venue?.layout?.sections?.length ? (event.venue.layout as SeatLayout)
    : null;
  // Only use the venue map when DB seats actually line up with the drawing;
  // otherwise (stale seats from before a redesign) fall back to the plain grid.
  const layout: SeatLayout | null = (() => {
    if (!rawLayout) return null;

    // Walk the sections exactly the way VenueSeatMap does — same seat order,
    // same slice per section — and check each seat's stored label agrees with
    // the slot the map will draw it in. Comparing totals alone isn't enough:
    // 25 rows of 16 and 20 rows of 20 are both 400 seats, yet the second draws
    // "B1" in the middle of row A, which is what made the map look scrambled.
    const pools = new Map<number, typeof tickets[number]['seats']>();
    for (const t of tickets) {
      pools.set(t.id, [...(t.seats ?? [])].sort((a, b) => a.id - b.id));
    }
    const cursor = new Map<number, number>();

    for (const sec of rawLayout.sections) {
      if (!sec.ticketId) continue;
      const pool = pools.get(sec.ticketId) ?? [];
      if (pool.length === 0) continue; // tier has no seats yet — nothing to check

      const start = cursor.get(sec.ticketId) ?? 0;
      const count = sec.rows * sec.seatsPerRow;
      const slice = pool.slice(start, start + count);
      cursor.set(sec.ticketId, start + slice.length);
      if (slice.length !== count) return null;

      // A section drawn sideways has its lettered rows running down the
      // columns, so the seat number comes from the row instead.
      const transposed = ((Math.round((sec.rotation || 0) / 90) % 4) + 4) % 4 % 2 === 1;

      for (let i = 0; i < slice.length; i++) {
        const expected = transposed
          ? Math.floor(i / sec.seatsPerRow) + 1
          : (i % sec.seatsPerRow) + 1;
        const actual = Number(slice[i].label.match(/\d+/)?.[0]);
        if (actual !== expected) return null;
      }
    }
    return rawLayout;
  })();
  const isGA = selectedTicket?.seating === 'GENERAL';
  const gaSoldOut = isGA && (selectedTicket?.quantity ?? 0) <= 0;
  // Stands in for "seats picked" everywhere a GA ticket has no seats at all.
  const chosenCount = gaSoldOut ? 0 : isGA ? gaQuantity : selectedSeats.length;
  const formattedDate = event.startTime ? new Date(event.startTime).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const step = !selectedTicket ? 1 : chosenCount === 0 ? 2 : 3;
  const layoutZoneColor = selectedTicket && layout ? layout.sections.find((s) => s.ticketId === selectedTicket.id)?.color : undefined;
  const zoneColor = layoutZoneColor ?? (selectedTicket ? getZoneColor(selectedTicket.type, tickets.findIndex((t) => t.id === selectedTicket.id)).color : '#e02020');
  const totalPrice = selectedTicket ? selectedTicket.price * chosenCount : 0;

  const sessionFormatted = formatMMSS(sessionRemaining);
  const sessionLow = sessionRemaining <= 60;

  return (
    <main className="tsp-root">
      <div className="tsp-inner">
        {/* Header */}
        <div className="tsp-header">
          <Link href={`/events/${event.id}`} className="tsp-back">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M9.5 3L5 8l4.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Quay lại sự kiện
          </Link>
          <div className="tsp-header__main">
            <img
              src={resolveImageUrl(event.bannerUrl)}
              alt={event.title} className="tsp-header__img"
              style={{ objectPosition: `${event.bannerFocusX ?? 50}% ${event.bannerFocusY ?? 50}%` }}
            />
            <div className="tsp-header__info">
              <h1 className="tsp-title">{event.title}</h1>
              <div className="tsp-header__meta">
                {formattedDate && <span className="tsp-header__meta-item"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M1 6h14" stroke="currentColor" strokeWidth="1.4"/><path d="M5 1v2M11 1v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>{formattedDate}</span>}
                {event.location && <span className="tsp-header__meta-item"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1C4.79 1 3 2.79 3 5c0 3.25 4 8 4 8s4-4.75 4-8c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.4"/><circle cx="7" cy="5" r="1.2" fill="currentColor"/></svg>{event.location}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="tsp-stepper">
          <div className={`tsp-step ${step >= 1 ? 'tsp-step--active' : ''}`}><span className="tsp-step__num">1</span><span className="tsp-step__label">Chọn loại vé</span></div>
          <div className={`tsp-step__line ${step >= 2 ? 'tsp-step__line--active' : ''}`} />
          <div className={`tsp-step ${step >= 2 ? 'tsp-step--active' : ''}`}><span className="tsp-step__num">2</span><span className="tsp-step__label">{isGA ? 'Số lượng' : 'Chọn ghế'} (tối đa {MAX_SEATS})</span></div>
          <div className={`tsp-step__line ${step >= 3 ? 'tsp-step__line--active' : ''}`} />
          <div className={`tsp-step ${step >= 3 ? 'tsp-step--active' : ''}`}><span className="tsp-step__num">3</span><span className="tsp-step__label">Xác nhận &amp; đặt vé</span></div>
        </div>

        <div className="tsp-layout">
          {/* LEFT */}
          <div className="tsp-left">
            <section className="tsp-card">
              <div className="tsp-card__header">
                <h2 className="tsp-card__title"><span className="tsp-card__step">1</span>Chọn loại vé</h2>
                {tickets.length > 0 && <span className="tsp-card__badge">{tickets.length} loại vé</span>}
              </div>
              {tickets.length === 0 ? <p className="tsp-empty-text">Hiện chưa có vé nào được mở bán.</p> : (
                <div className="tsp-ticket-list">
                  {tickets.map((ticket, i) => (
                    <TicketTypeCard
                      key={ticket.id}
                      ticket={ticket}
                      index={i}
                      color={layout?.sections.find((s) => s.ticketId === ticket.id)?.color}
                      selected={selectedTicket?.id === ticket.id}
                      onSelect={handleSelectTicket}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="tsp-card">
              <div className="tsp-card__header">
                <h2 className="tsp-card__title"><span className="tsp-card__step">2</span>{isGA ? 'Số lượng vé' : 'Chọn ghế'}</h2>
                <span className="tsp-card__badge">
                  {isGA ? `${gaQuantity}/${selectedTicket ? maxGaQuantity(selectedTicket) : MAX_SEATS}` : `${selectedSeats.length}/${MAX_SEATS}`} đã chọn
                </span>
              </div>
              {isGA && selectedTicket ? (
                <div className="tsp-ga-picker">
                  <p className="tsp-empty-text" style={{ marginBottom: 16 }}>
                    Vé đứng — không có sơ đồ ghế. Vào trước, đứng trước.
                  </p>
                  {gaSoldOut ? (
                    <p className="tsp-empty-text" style={{ fontWeight: 600 }}>Loại vé này đã hết.</p>
                  ) : (
                    <>
                      <div className="tsp-ga-stepper">
                        <button
                          type="button"
                          className="tsp-ga-stepper__btn"
                          onClick={() => adjustGaQuantity(selectedTicket, -1)}
                          disabled={gaQuantity <= 1}
                          aria-label="Giảm số lượng"
                        >−</button>
                        <span className="tsp-ga-stepper__value">{gaQuantity}</span>
                        <button
                          type="button"
                          className="tsp-ga-stepper__btn"
                          onClick={() => adjustGaQuantity(selectedTicket, 1)}
                          disabled={gaQuantity >= maxGaQuantity(selectedTicket)}
                          aria-label="Tăng số lượng"
                        >+</button>
                      </div>
                      <p className="tsp-empty-text" style={{ marginTop: 12 }}>
                        Tối đa {maxGaQuantity(selectedTicket)} vé mỗi lượt đặt — còn {selectedTicket.quantity} vé.
                      </p>
                    </>
                  )}
                </div>
              ) : layout ? (
                <VenueSeatMap
                  layout={layout}
                  tickets={tickets}
                  selectedSeats={selectedSeats}
                  onSelectSeat={handleSelectSeat}
                  onZoneFocus={(ticket) => { if (selectedSeats.length === 0) setSelectedTicket(ticket); }}
                  busy={holdLoading}
                  maxSeats={MAX_SEATS}
                />
              ) : (
                <SeatMap tickets={tickets} selectedSeats={selectedSeats} onSelectSeat={handleSelectSeat} busy={holdLoading} maxSeats={MAX_SEATS} />
              )}
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
                    <span>Loại vé</span>
                    <strong className="tsp-summary__chip">
                      <span className="tsp-summary__chip-dot" style={{ background: zoneColor }} />
                      {selectedTicket.type}
                    </strong>
                  </div>
                  <div className="tsp-summary__divider" />
                  {!isGA && (
                    <div className="tsp-summary__row">
                      <span>Ghế đã chọn ({selectedSeats.length})</span>
                      <strong className={selectedSeats.length > 0 ? '' : 'tsp-summary__placeholder'}>
                        {selectedSeats.length > 0 ? selectedSeats.map((s) => s.label).join(', ') : 'Chưa chọn'}
                      </strong>
                    </div>
                  )}
                  <div className="tsp-summary__row">
                    <span>Đơn giá</span>
                    <strong>{formatCurrencyVND(selectedTicket.price)}</strong>
                  </div>
                  <div className="tsp-summary__row">
                    <span>Số lượng</span>
                    <strong>{chosenCount} vé</strong>
                  </div>
                  <div className="tsp-summary__row">
                    <span>Còn lại</span>
                    <strong>{selectedTicket.quantity} vé</strong>
                  </div>

                  {/* One rule, right before the number that matters */}
                  <div className="tsp-summary__divider" />
                  <div className="tsp-summary__row tsp-summary__row--total">
                    <span>Tổng tiền</span>
                    <strong className="tsp-summary__price">{formatCurrencyVND(totalPrice)}</strong>
                  </div>
                </div>
              ) : (
                <p className="tsp-empty-text" style={{ padding: '16px 0' }}>Vui lòng chọn một loại vé.</p>
              )}

              {selectedTicket && !isGA && selectedSeats.length === 0 && (
                <p className="tsp-summary__hint">Chọn ghế còn trống trên sơ đồ để tiếp tục (tối đa {MAX_SEATS} ghế).</p>
              )}

              {!isLoggedIn && chosenCount > 0 && (
                <div className="tsp-guest-box">
                  <p className="tsp-guest-box__title">Mua vé không cần đăng nhập</p>
                  <p className="tsp-guest-box__note">Vé và mã xác nhận sẽ được gửi đến email này.</p>
                  <input
                    type="email"
                    className="tsp-guest-box__input"
                    placeholder="email@example.com"
                    value={guestEmail}
                    onChange={(e) => { setGuestEmail(e.target.value); setGuestEmailError(null); }}
                  />
                  {guestEmailError && <p className="tsp-guest-box__error">{guestEmailError}</p>}
                  <Link href="/login" className="tsp-guest-box__login-link">
                    Hoặc đăng nhập để lưu lịch sử mua vé
                  </Link>
                </div>
              )}

              {holdError && <div className="tsp-alert tsp-alert--error">{holdError}</div>}

              <button
                type="button"
                onClick={handleProceedCheckout}
                disabled={chosenCount === 0 || holdLoading}
                className="tsp-reserve-btn"
                style={chosenCount > 0 ? { background: zoneColor } : undefined}
              >
                {holdLoading ? <><span className="tsp-btn-spinner" /> Đang xử lý...</> : `Tiến hành thanh toán (${chosenCount} vé)`}
              </button>

              <p className="tsp-summary__note">Thanh toán bảo mật - Hoàn tiền trong 24h</p>
            </div>
          </aside>
        </div>
      </div>

      <div className={`tsp-session-bar ${sessionLow ? 'tsp-session-bar--low' : ''}`}>
        <span className="tsp-session-bar__icon" style={{ display: 'inline-flex', animation: 'edp-spin 2s linear infinite' }}>⏳</span>
        <strong className="tsp-session-bar__time">{sessionFormatted}</strong>
        <span className="tsp-session-bar__label">Thời gian<br />giữ chỗ</span>
      </div>
    </main>
  );
}
