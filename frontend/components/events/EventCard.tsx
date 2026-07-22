'use client';

import Link from 'next/link';
import { useTranslation, translateCategory } from '../../lib/i18n';
import { resolveImageUrl } from '../../lib/image';
import { effectiveSaleStatus } from '../../lib/eventStatus';

interface EventCardProps {
  event: any;
}

export default function EventCard({ event }: EventCardProps) {
  const { t, lang } = useTranslation();
  const locale = lang === 'en' ? 'en-US' : 'vi-VN';

  const date = event.startTime
    ? new Date(event.startTime).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const category = translateCategory(event.category || event.type, lang) || t.event;

  const minPrice = Array.isArray(event.tickets) && event.tickets.length > 0
    ? Math.min(...event.tickets.map((t: { price: number }) => t.price))
    : null;

  const formattedPrice = minPrice !== null
    ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(minPrice)
    : null;

  return (
    <Link href={`/events/${event.id}`} className="ec2-link">
      <div className="ec2-card">
        <div className="ec2-img-wrap">
          <img
            src={resolveImageUrl(event.bannerUrl)}
            alt={event.title}
            className="ec2-img"
            style={{ objectPosition: `${event.bannerFocusX ?? 50}% ${event.bannerFocusY ?? 50}%` }}
          />
          {formattedPrice && (
            <span className="ec2-price">{t.events_from} {formattedPrice}</span>
          )}
          {effectiveSaleStatus(event) === 'UPCOMING' && (
            <span className="ec2-upcoming">{lang === 'en' ? 'Coming soon' : 'Sắp mở bán'}</span>
          )}
        </div>
        <div className="ec2-body">
          <span className="ec2-badge">{category}</span>
          <h3 className="ec2-title">{event.title}</h3>
          <div className="ec2-meta">
            {date && (
              <div className="ec2-meta-row">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="ec2-meta-icon">
                  <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M1 6h14" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M5 1v2M11 1v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span>{date}</span>
              </div>
            )}
            {event.location && (
              <div className="ec2-meta-row">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="ec2-meta-icon">
                  <path d="M7 1C4.79 1 3 2.79 3 5c0 3.25 4 8 4 8s4-4.75 4-8c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.4"/>
                  <circle cx="7" cy="5" r="1.2" fill="currentColor"/>
                </svg>
                <span>{event.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
