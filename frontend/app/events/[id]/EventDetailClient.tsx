'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

import api from '@/lib/api';
import { useTranslation, translateCategory } from '@/lib/i18n';
import { cdnImage, cdnSrcSet, BLUR_BACKDROP_WIDTH } from '@/lib/image';
import { upcomingLabel, effectiveSaleStatus } from '@/lib/eventStatus';
import { EventDetail } from '@/lib/types';

// ─── helpers ──────────────────────────────────────────────────────────────────

const VN_TZ = 'Asia/Ho_Chi_Minh';

const AVATAR_COLORS = ['#e02020', '#0f35ff', '#007aff', '#34aadc', '#10b981', '#f59e0b', '#8b5cf6'];

function avatarColor(str: string) {
  return AVATAR_COLORS[str.charCodeAt(0) % AVATAR_COLORS.length];
}

function userInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
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

function fmtRelative(dateStr: string, t: any) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t.edp_review_just_now;
  if (mins < 60) return `${mins} ${t.edp_review_mins_ago}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${t.edp_review_hours_ago}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${t.edp_review_days_ago}`;
  return new Date(dateStr).toLocaleDateString('vi-VN', { timeZone: VN_TZ, day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── star SVG ─────────────────────────────────────────────────────────────────

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1.5l1.76 3.57 3.94.57-2.85 2.78.67 3.93L8 10.67l-3.52 1.68.67-3.93L2.3 5.64l3.94-.57L8 1.5z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="edp-review-card__stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} filled={i <= rating} />
      ))}
    </span>
  );
}

// ─── types ────────────────────────────────────────────────────────────────────

interface ReviewUser {
  id: number;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface ReviewItem {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  user: ReviewUser;
}

// ─── review section ───────────────────────────────────────────────────────────

function ReviewSection({ eventId, eventEndTime }: { eventId: number; eventEndTime?: string }) {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Read once per mount; a lazy initializer keeps Date.now() out of render.
  const [now] = useState(() => Date.now());
  const eventEnded = eventEndTime ? new Date(eventEndTime).getTime() < now : false;
  // localStorage only exists in the browser. Reading it during render made
  // the server HTML (logged out) differ from a logged-in browser's first
  // render and broke hydration, so it is read after mount instead.
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await api.get(`/reviews/event/${eventId}`);
      setReviews(res.data.reviews);
      setTotal(res.data.total);
      setAvgRating(res.data.avgRating);
    } catch { /* ignore */ }
  }, [eventId]);

  useEffect(() => {
    fetchReviews();
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
    if (token) {
      const payload = decodeJwt(token);
      if (payload?.sub) setCurrentUserId(payload.sub);
    }
  }, [fetchReviews]);

  const alreadyReviewed = currentUserId
    ? reviews.some((r) => r.user.id === currentUserId)
    : false;

  const handleSubmit = async () => {
    if (rating === 0) { setFormMsg({ type: 'error', text: t.edp_review_select_star }); return; }
    if (!comment.trim()) { setFormMsg({ type: 'error', text: t.edp_review_enter_comment }); return; }

    setSubmitting(true);
    setFormMsg(null);
    try {
      await api.post(`/reviews/event/${eventId}`, { rating, comment });
      setFormMsg({ type: 'success', text: t.edp_review_thanks });
      setRating(0);
      setComment('');
      fetchReviews();
    } catch (err: any) {
      setFormMsg({ type: 'error', text: err?.response?.data?.message || t.edp_review_fail });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: number) => {
    try {
      await api.delete(`/reviews/${reviewId}`);
      fetchReviews();
    } catch { /* ignore */ }
  };

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  return (
    <section className="edp-reviews">
      <div className="edp-reviews__header">
        <h2 className="edp-reviews__title edp-section-title">{t.edp_reviews_title}</h2>
        {total > 0 && (
          <div className="edp-reviews__summary">
            <span className="edp-reviews__avg">{avgRating}</span>
            <StarRating rating={Math.round(avgRating)} />
            <span className="edp-reviews__count">({total} {t.edp_reviews_count})</span>
          </div>
        )}
      </div>

      {/* form */}
      {eventEnded && isLoggedIn && !alreadyReviewed && (
        <div className="edp-review-form">
          <p className="edp-review-form__label">{t.edp_review_share}</p>

          <div className="edp-review-form__stars">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                className={`edp-review-form__star ${i <= (hoverRating || rating) ? 'edp-review-form__star--active' : ''}`}
                onClick={() => setRating(i)}
                onMouseEnter={() => setHoverRating(i)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={`${i} sao`}
              >
                <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 1.5l1.76 3.57 3.94.57-2.85 2.78.67 3.93L8 10.67l-3.52 1.68.67-3.93L2.3 5.64l3.94-.57L8 1.5z"
                    fill={i <= (hoverRating || rating) ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ))}
          </div>

          <textarea
            className="edp-review-form__textarea"
            placeholder={t.edp_review_placeholder}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
          />

          <div className="edp-review-form__actions">
            <button
              className="edp-review-form__submit"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? t.edp_review_submitting : t.edp_review_submit}
            </button>
          </div>

          {formMsg && (
            <p className={`edp-review-form__msg edp-review-form__msg--${formMsg.type}`}>
              {formMsg.text}
            </p>
          )}
        </div>
      )}

      {!eventEnded && (
        <p className="edp-review-form__msg edp-review-form__msg--info" style={{ marginBottom: 16 }}>
          {t.edp_review_after}
        </p>
      )}

      {eventEnded && !isLoggedIn && (
        <p className="edp-review-form__msg edp-review-form__msg--info" style={{ marginBottom: 16 }}>
          <Link href="/login" style={{ color: '#e02020', fontWeight: 600 }}>{t.nav_login}</Link> {t.edp_review_login}
        </p>
      )}

      {eventEnded && isLoggedIn && alreadyReviewed && (
        <p className="edp-review-form__msg edp-review-form__msg--info" style={{ marginBottom: 16 }}>
          {t.edp_review_already}
        </p>
      )}

      {/* review list */}
      {reviews.length > 0 ? (
        <div className="edp-review-list">
          {reviews.map((r) => {
            const avatarSrc = r.user.avatarUrl
              ? (r.user.avatarUrl.startsWith('http') ? r.user.avatarUrl : `${apiBase}${r.user.avatarUrl}`)
              : null;
            const displayName = r.user.name || r.user.email.split('@')[0];

            return (
              <div key={r.id} className="edp-review-card">
                <div className="edp-review-card__top">
                  <div
                    className="edp-review-card__avatar"
                    style={avatarSrc ? undefined : { background: avatarColor(r.user.email) }}
                  >
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" />
                    ) : (
                      userInitials(r.user.name, r.user.email)
                    )}
                  </div>
                  <div className="edp-review-card__info">
                    <span className="edp-review-card__name">{displayName}</span>
                    <span className="edp-review-card__date">{fmtRelative(r.createdAt, t)}</span>
                  </div>
                  <StarRating rating={r.rating} />
                </div>
                <p className="edp-review-card__comment">{r.comment}</p>
                {currentUserId === r.user.id && (
                  <button className="edp-review-card__delete" onClick={() => handleDelete(r.id)}>
                    {t.edp_review_delete}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        eventEnded && (
          <p className="edp-reviews__empty">{t.edp_review_empty}</p>
        )
      )}
    </section>
  );
}

// ─── buy button ───────────────────────────────────────────────────────────────

/**
 * The single buy CTA in the hero card, plus the note under it. Keeps the three
 * sale states (on sale / ended / not open yet) described in one place.
 */
function SaleAction({ event }: { event: EventDetail }) {
  const { t, lang } = useTranslation();
  const status = effectiveSaleStatus(event);

  if (status === 'ON_SALE') {
    return (
      <>
        <Link href={`/events/${event.id}/tickets`} className="edp-stage__cta">
          {t.edp_select_ticket}
        </Link>
        <p className="edp-stage__note">{t.edp_secure_note}</p>
      </>
    );
  }

  if (status === 'ENDED') {
    return (
      <>
        <button className="edp-stage__cta edp-stage__cta--off" disabled>
          {lang === 'en' ? 'Sale ended' : 'Đã kết thúc'}
        </button>
        <p className="edp-stage__note">
          🏁 {lang === 'en' ? 'This event has ended.' : 'Sự kiện này đã kết thúc.'}
        </p>
      </>
    );
  }

  return (
    <>
      <button className="edp-stage__cta edp-stage__cta--off" disabled>
        {lang === 'en' ? 'Not on sale yet' : 'Chưa mở bán'}
      </button>
      <p className="edp-stage__note">
        ⏳ {upcomingLabel(event.saleOpenAt, lang === 'en' ? 'en' : 'vi')}
      </p>
    </>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

// `initialEvent` is fetched on the server (see page.tsx) so the first HTML
// already has the content. It can be null when the backend was too slow to
// answer (Render cold start); the client fetch below then fills it in, and it
// also refreshes data the server may have cached for a minute.
export default function EventDetailClient({ initialEvent }: { initialEvent: EventDetail | null }) {
  const { t, lang } = useTranslation();
  const params = useParams();
  const [event, setEvent] = useState<EventDetail | null>(initialEvent);

  useEffect(() => {
    api.get(`/events/${params.id}`).then((res) => setEvent(res.data));
  }, [params.id]);

  if (!event) {
    return (
      <div className="edp-loading">
        <div className="edp-spinner" />
        <span>{t.loading}</span>
      </div>
    );
  }

  const tickets: EventDetail['tickets'] = event.tickets || [];

  const locale = lang === 'en' ? 'en-US' : 'vi-VN';
  // Always Vietnam time: the event happens there, and the server (UTC on
  // Vercel) renders this page first — formatting in the machine's own zone
  // made server and browser disagree and broke hydration.
  const formattedDate = event.startTime
    ? new Date(event.startTime).toLocaleDateString(locale, {
        timeZone: VN_TZ,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const startClock = event.startTime
    ? new Date(event.startTime).toLocaleTimeString(locale, { timeZone: VN_TZ, hour: '2-digit', minute: '2-digit' })
    : null;

  // Full date + time, for the detail panel (end time isn't shown anywhere else)
  const fmtFull = (value?: string | null) =>
    value
      ? new Date(value).toLocaleString(locale, {
          timeZone: VN_TZ,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

  const minPrice = tickets.length
    ? Math.min(...tickets.map((t) => t.price))
    : null;

  const formattedMinPrice =
    minPrice !== null
      ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(minPrice)
      : null;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);

  return (
    <main className="edp-root">

      {/* Hero stage — poster shown whole over a blurred copy of itself */}
      <section className="edp-stage">
        <div className="edp-stage__bg" aria-hidden="true">
          <img src={cdnImage(event.bannerUrl, BLUR_BACKDROP_WIDTH)} alt="" />
        </div>

        <div className="edp-stage__inner">
          <figure className="edp-stage__poster">
            <img
              src={cdnImage(event.bannerUrl, 1600)}
              srcSet={cdnSrcSet(event.bannerUrl, [640, 1100, 1600, 2200])}
              sizes="(max-width: 1100px) 100vw, 1100px"
              alt={event.title}
            />
          </figure>

          <div className="edp-stage__card">
            {event.category && (
              <span className="edp-stage__badge">{translateCategory(event.category, lang)}</span>
            )}
            <h1 className="edp-stage__title">{event.title}</h1>

            <div className="edp-stage__facts">
              {formattedDate && (
                <div className="edp-stage__fact">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M1 6h14" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M5 1v2M11 1v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  <div>
                    <span className="edp-stage__fact-key">{lang === 'en' ? 'Date' : 'Thời gian'}</span>
                    <span className="edp-stage__fact-val">
                      {formattedDate}{startClock ? ` · ${startClock}` : ''}
                    </span>
                  </div>
                </div>
              )}
              {event.location && (
                <div className="edp-stage__fact">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="8" cy="6" r="1.5" fill="currentColor"/>
                  </svg>
                  <div>
                    <span className="edp-stage__fact-key">{lang === 'en' ? 'Venue' : 'Địa điểm'}</span>
                    <span className="edp-stage__fact-val">{event.location}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="edp-stage__divider" />

            {formattedMinPrice && (
              <div className="edp-stage__price">
                <span className="edp-stage__price-key">{t.edp_price_from}</span>
                <span className="edp-stage__price-val">{formattedMinPrice}</span>
              </div>
            )}

            <SaleAction event={event} />
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="edp-content">

        {/* Left: Info */}
        <div className="edp-info">
          <h2 className="edp-section-title">
            {lang === 'en' ? 'Event details' : 'Thông tin sự kiện'}
          </h2>
          <div className="edp-factlist">
            {fmtFull(event.startTime) && (
              <div className="edp-factlist__row">
                <span className="edp-factlist__key">{lang === 'en' ? 'Starts' : 'Bắt đầu'}</span>
                <span className="edp-factlist__val">{fmtFull(event.startTime)}</span>
              </div>
            )}
            {fmtFull(event.endTime) && (
              <div className="edp-factlist__row">
                <span className="edp-factlist__key">{lang === 'en' ? 'Ends' : 'Kết thúc'}</span>
                <span className="edp-factlist__val">{fmtFull(event.endTime)}</span>
              </div>
            )}
            {event.location && (
              <div className="edp-factlist__row">
                <span className="edp-factlist__key">{lang === 'en' ? 'Venue' : 'Địa điểm'}</span>
                <span className="edp-factlist__val">{event.location}</span>
              </div>
            )}
            {event.category && (
              <div className="edp-factlist__row">
                <span className="edp-factlist__key">{lang === 'en' ? 'Category' : 'Thể loại'}</span>
                <span className="edp-factlist__val">{translateCategory(event.category, lang)}</span>
              </div>
            )}
          </div>

          {event.description && (
            <div className="edp-desc">
              <h2 className="edp-section-title">{t.edp_about}</h2>
              <p className="edp-desc__text">{event.description}</p>
            </div>
          )}
        </div>

        {/* Right: ticket tiers. The buy button and the "from" price live in the
            hero card — this panel only breaks the price down per tier. */}
        <div className="edp-ticket-box">
          <div className="edp-ticket-box__inner">
            <p className="edp-ticket-box__label">{t.edp_ticket_info}</p>

            {tickets.length > 0 ? (
              <ul className="edp-ticket-types">
                {tickets.map((ticket) => (
                  <li key={ticket.id} className="edp-ticket-types__row">
                    <span className="edp-ticket-types__name">{ticket.type}</span>
                    <span className="edp-ticket-types__price">{formatPrice(ticket.price)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="edp-ticket-box__note">{t.edp_coming_soon}</p>
            )}
          </div>
        </div>

      </div>

      {/* Reviews */}
      <ReviewSection eventId={event.id} eventEndTime={event.endTime} />
    </main>
  );
}
