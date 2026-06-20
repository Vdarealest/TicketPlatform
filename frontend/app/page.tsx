'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../lib/api';
import EventCard from '../components/events/EventCard';

export default function Home() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    api.get('/events').then((res) => setEvents(res.data)).catch(console.error);
  }, []);

  const heroEvent = events[0];
  const featuredEvents = events.slice(1, 4);   // 3 card nổi bật
  const moreEvents = events.slice(4, 8);       // 4 card grid 2x2

  const heroDate = heroEvent?.startTime
    ? new Date(heroEvent.startTime).toLocaleDateString('vi-VN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const heroMinPrice = Array.isArray(heroEvent?.tickets) && heroEvent.tickets.length > 0
    ? Math.min(...heroEvent.tickets.map((t: { price: number }) => t.price))
    : null;

  const heroFormattedPrice = heroMinPrice !== null
    ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(heroMinPrice)
    : null;

  return (
    <main className="home-root">

      {/* ── HERO ── */}
      {heroEvent && (
        <section className="home-hero">
          <div className="home-hero__slide">
            <img
              src={heroEvent.bannerUrl ? `/img/${heroEvent.bannerUrl}` : '/img/placeholder.jpg'}
              alt={heroEvent.title}
              className="home-hero__img"
            />
            <div className="home-hero__scrim" />
            <div className="home-hero__content">
              <span className="home-hero__tag">🎟 Đang mở bán</span>
              <h1 className="home-hero__title">{heroEvent.title}</h1>
              <div className="home-hero__info">
                {heroEvent.location && (
                  <span className="home-hero__location">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1C4.79 1 3 2.79 3 5c0 3.25 4 8 4 8s4-4.75 4-8c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.4"/>
                      <circle cx="7" cy="5" r="1.2" fill="currentColor"/>
                    </svg>
                    {heroEvent.location}
                  </span>
                )}
                {heroDate && (
                  <span className="home-hero__date">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M1 6h14" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M5 1v2M11 1v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    {heroDate}
                  </span>
                )}
              </div>
              <div className="home-hero__actions">
                <Link href={`/events/${heroEvent.id}`} className="home-hero__cta">
                  Mua vé ngay
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
                {heroFormattedPrice && (
                  <span className="home-hero__price">Giá từ <strong>{heroFormattedPrice}</strong></span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="home-body">

        {/* Tất cả event (nếu chỉ có ≤4) */}
        {events.length > 0 && events.length <= 4 && (
          <section className="home-section">
            <div className="home-section__header">
              <h2 className="home-section__title">Sự kiện nổi bật</h2>
            </div>
            <div className="home-featured">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}

        {/* Nếu có hơn 4 event */}
        {events.length > 4 && (
          <>
            <section className="home-section">
              <div className="home-section__header">
                <h2 className="home-section__title">Sự kiện nổi bật</h2>
                <Link href="/events" className="home-section__more">Xem tất cả →</Link>
              </div>
              <div className="home-featured">
                {featuredEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>

            <section className="home-section">
              <div className="home-section__header">
                <h2 className="home-section__title">Đang mở bán</h2>
                <Link href="/events" className="home-section__more">Xem tất cả →</Link>
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