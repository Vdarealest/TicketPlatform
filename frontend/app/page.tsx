'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { resolveImageUrl } from '../lib/image';
import { effectiveSaleStatus } from '../lib/eventStatus';
import EventCard from '../components/events/EventCard';
import FeaturedEventCard from '../components/events/FeaturedEventCard';

const AUTO_MS = 5000;

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const [events, setEvents] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  // Infinite loop: the track holds [clone(last), ...real, clone(first)].
  // `pos` indexes that extended array; real slides live at positions 1..n.
  const [pos, setPos] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);

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

  // Promo sections on the homepage should never surface an event that has
  // already happened — "Đang mở bán" showing a finished concert (with its
  // own "Đã kết thúc" badge right on the card) is a contradiction, not a
  // styling choice. Drop ended events before slicing into sections.
  const visibleEvents = events.filter((e) => effectiveSaleStatus(e) !== 'ENDED');
  const featuredEvents = visibleEvents.slice(1, 4);
  // "On sale" means exactly that — status must actually be ON_SALE, not
  // just "whatever came after the featured slice".
  const onSaleEvents = visibleEvents.slice(4).filter((e) => effectiveSaleStatus(e) === 'ON_SALE').slice(0, 8);

  return (
    <main className="home-root">
      {n > 0 && (
        <section
          className="home-hero"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
              <div className="home-hero__main">
                <div className="home-hero__viewport">
                  <div
                    className="home-hero__track"
                    style={{
                      transform: `translateX(-${trackPos * 100}%)`,
                      transition: animate ? undefined : 'none',
                    }}
                    onTransitionEnd={onTrackTransitionEnd}
                  >
                    {slides.map((ev, i) => (
                      <div
                        className="home-hero__slide"
                        key={`${ev.id}-${i}`}
                        onClick={() => router.push(`/events/${ev.id}`)}
                      >
                        <img
                          src={resolveImageUrl(ev.bannerUrl)}
                          alt={ev.title}
                          className="home-hero__img"
                          style={{ objectPosition: `${ev.bannerFocusX ?? 50}% ${ev.bannerFocusY ?? 50}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {hasCarousel && (
                  <>
                    <button type="button" className="home-hero__arrow home-hero__arrow--prev" aria-label="Previous" onClick={goPrev}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <button type="button" className="home-hero__arrow home-hero__arrow--next" aria-label="Next" onClick={goNext}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
              </div>
        </section>
      )}

      <div className="home-body">
        {visibleEvents.length > 0 && visibleEvents.length <= 4 && (
          <section className="home-section">
            <div className="home-section__header">
              <h2 className="home-section__title">{t.home_featured}</h2>
            </div>
            <div className="home-featured">
              {visibleEvents.map((event, i) => (
                <FeaturedEventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          </section>
        )}

        {visibleEvents.length > 4 && (
          <>
            {featuredEvents.length > 0 && (
              <section className="home-section">
                <div className="home-section__header">
                  <h2 className="home-section__title">{t.home_featured}</h2>
                  <Link href="/events" className="home-section__more">{t.home_view_all}</Link>
                </div>
                <div className="home-featured">
                  {featuredEvents.map((event, i) => (
                    <FeaturedEventCard key={event.id} event={event} index={i} />
                  ))}
                </div>
              </section>
            )}

            {onSaleEvents.length > 0 && (
              <section className="home-section">
                <div className="home-section__header">
                  <h2 className="home-section__title">{t.home_on_sale_section}</h2>
                  <Link href="/events" className="home-section__more">{t.home_view_all}</Link>
                </div>
                <div className="home-grid">
                  {onSaleEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
                <div className="home-section__footer">
                  <Link href="/events" className="home-section__view-all-btn">{t.home_view_all}</Link>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
