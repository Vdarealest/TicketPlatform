'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { resolveImageUrl } from '../lib/image';
import { effectiveSaleStatus, upcomingLabel } from '../lib/eventStatus';
import EventCard from '../components/events/EventCard';

const AUTO_MS = 5000;

export default function Home() {
  const { t, lang } = useTranslation();
  const [events, setEvents] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  // Infinite loop: the track holds [clone(last), ...real, clone(first)].
  // `pos` indexes that extended array; real slides live at positions 1..n.
  const [pos, setPos] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);

  const locale = lang === 'en' ? 'en-US' : 'vi-VN';
  const n = featured.length;
  const hasCarousel = n > 1;

  useEffect(() => {
    api.get('/events').then((res) => setEvents(res.data)).catch(console.error);
    api.get('/events/featured').then((res) => setFeatured(res.data)).catch(console.error);
  }, []);

  // Reset to the first real slide whenever the list changes.
  useEffect(() => { setPos(1); }, [n]);

  const goNext = () => { if (hasCarousel) { setAnimate(true); setPos((p) => (p <= n ? p + 1 : p)); } };
  const goPrev = () => { if (hasCarousel) { setAnimate(true); setPos((p) => (p >= 1 ? p - 1 : p)); } };
  const goTo = (realIdx: number) => { setAnimate(true); setPos(realIdx + 1); };

  // Auto-advance; pause on hover.
  useEffect(() => {
    if (!hasCarousel || paused) return;
    const id = setInterval(goNext, AUTO_MS);
    return () => clearInterval(id);
  }, [hasCarousel, paused, n]);

  // When we land on a clone, snap instantly (no transition) to the real slide.
  const onTrackTransitionEnd = (e: React.TransitionEvent) => {
    if (!hasCarousel || e.target !== e.currentTarget) return;
    if (pos === n + 1) { setAnimate(false); setPos(1); }
    else if (pos === 0) { setAnimate(false); setPos(n); }
  };

  const slides = hasCarousel ? [featured[n - 1], ...featured, featured[0]] : featured;
  const trackPos = hasCarousel ? pos : 0;
  const realIndex = n > 0 ? (((pos - 1) % n) + n) % n : 0;

  const featuredEvents = events.slice(1, 4);
  const moreEvents = events.slice(4, 8);

  const slideDate = (ev: any) =>
    ev?.startTime
      ? new Date(ev.startTime).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

  const slidePrice = (ev: any) => {
    const min = Array.isArray(ev?.tickets) && ev.tickets.length > 0
      ? Math.min(...ev.tickets.map((tk: { price: number }) => tk.price))
      : null;
    return min !== null
      ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(min)
      : null;
  };

  return (
    <main className="home-root">
      {n > 0 && (
        <section
          className="home-hero"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="home-hero__viewport">
            <div
              className="home-hero__track"
              style={{
                transform: `translateX(-${trackPos * 100}%)`,
                transition: animate ? undefined : 'none',
              }}
              onTransitionEnd={onTrackTransitionEnd}
            >
              {slides.map((ev, i) => {
                const date = slideDate(ev);
                const price = slidePrice(ev);
                const upcoming = effectiveSaleStatus(ev) === 'UPCOMING';
                return (
                  <div className="home-hero__slide" key={`${ev.id}-${i}`}>
                    <img
                      src={resolveImageUrl(ev.bannerUrl)}
                      alt={ev.title}
                      className="home-hero__img"
                      style={{ objectPosition: `${ev.bannerFocusX ?? 50}% ${ev.bannerFocusY ?? 50}%` }}
                    />
                    <div className="home-hero__scrim" />
                    <div className="home-hero__content">
                      <span className={`home-hero__tag ${upcoming ? 'home-hero__tag--upcoming' : ''}`}>
                        {upcoming ? `⏳ ${upcomingLabel(ev.saleOpenAt, lang === 'en' ? 'en' : 'vi')}` : `🎟 ${t.home_on_sale}`}
                      </span>
                      <h1 className="home-hero__title">{ev.title}</h1>
                      <div className="home-hero__info">
                        {ev.location && (
                          <span className="home-hero__location">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M7 1C4.79 1 3 2.79 3 5c0 3.25 4 8 4 8s4-4.75 4-8c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.4"/>
                              <circle cx="7" cy="5" r="1.2" fill="currentColor"/>
                            </svg>
                            {ev.location}
                          </span>
                        )}
                        {date && (
                          <span className="home-hero__date">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                              <path d="M1 6h14" stroke="currentColor" strokeWidth="1.4"/>
                              <path d="M5 1v2M11 1v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                            </svg>
                            {date}
                          </span>
                        )}
                      </div>
                      <div className="home-hero__actions">
                        <Link href={`/events/${ev.id}`} className="home-hero__cta">
                          {upcoming ? (lang === 'en' ? 'View details' : 'Xem chi tiết') : t.home_buy_now}
                          <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </Link>
                        {price && (
                          <span className="home-hero__price">{t.home_price_from} <strong>{price}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {hasCarousel && (
            <>
              <button type="button" className="home-hero__arrow home-hero__arrow--prev" aria-label="Previous" onClick={goPrev}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button type="button" className="home-hero__arrow home-hero__arrow--next" aria-label="Next" onClick={goNext}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div className="home-hero__dots">
                {featured.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Slide ${i + 1}`}
                    className={`home-hero__dot ${i === realIndex ? 'home-hero__dot--active' : ''}`}
                    onClick={() => goTo(i)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <div className="home-body">
        {events.length > 0 && events.length <= 4 && (
          <section className="home-section">
            <div className="home-section__header">
              <h2 className="home-section__title">{t.home_featured}</h2>
            </div>
            <div className="home-featured">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}

        {events.length > 4 && (
          <>
            <section className="home-section">
              <div className="home-section__header">
                <h2 className="home-section__title">{t.home_featured}</h2>
                <Link href="/events" className="home-section__more">{t.home_view_all}</Link>
              </div>
              <div className="home-featured">
                {featuredEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>

            <section className="home-section">
              <div className="home-section__header">
                <h2 className="home-section__title">{t.home_on_sale_section}</h2>
                <Link href="/events" className="home-section__more">{t.home_view_all}</Link>
              </div>
              <div className="home-grid">
                {moreEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
