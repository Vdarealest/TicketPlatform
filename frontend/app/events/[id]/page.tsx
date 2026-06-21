'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

import api from '@/lib/api';
import { EventDetail } from '@/lib/types';

export default function EventDetailPage() {
  const params = useParams();
  const [event, setEvent] = useState<EventDetail | null>(null);

  useEffect(() => {
    api.get(`/events/${params.id}`).then((res) => setEvent(res.data));
  }, [params.id]);

  if (!event) {
    return (
      <div className="edp-loading">
        <div className="edp-spinner" />
        <span>Đang tải...</span>
      </div>
    );
  }

  const tickets: EventDetail['tickets'] = event.tickets || [];

  const formattedDate = event.startTime
    ? new Date(event.startTime).toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
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

      {/* Hero */}
      <div className="edp-hero">
        <img
          src={event.bannerUrl ? (event.bannerUrl.startsWith('http') ? event.bannerUrl : `/img/${event.bannerUrl}`) : '/img/placeholder.jpg'}
          alt={event.title}
          className="edp-hero__img"
          style={{ objectPosition: `${event.bannerFocusX ?? 50}% ${event.bannerFocusY ?? 50}%` }}
        />
        <div className="edp-hero__scrim" />
        <div className="edp-hero__title-wrap">
          {event.category && (
            <span className="edp-hero__badge">{event.category}</span>
          )}
          <h1 className="edp-hero__title">{event.title}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="edp-content">

        {/* Left: Info */}
        <div className="edp-info">
          <div className="edp-meta">
            {formattedDate && (
              <div className="edp-meta__item">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M1 6h14" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M5 1v2M11 1v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span>{formattedDate}</span>
              </div>
            )}
            {event.location && (
              <div className="edp-meta__item">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.4"/>
                  <circle cx="8" cy="6" r="1.5" fill="currentColor"/>
                </svg>
                <span>{event.location}</span>
              </div>
            )}
          </div>

          {event.description && (
            <div className="edp-desc">
              <h2 className="edp-desc__title">Giới thiệu sự kiện</h2>
              <p className="edp-desc__text">{event.description}</p>
            </div>
          )}
        </div>

        {/* Right: Ticket Box — luôn hiển thị mở bán */}
        <div className="edp-ticket-box">
          <div className="edp-ticket-box__inner">
            <p className="edp-ticket-box__label">Thông tin vé</p>

            {tickets.length > 0 ? (
              <>
                <div className="edp-ticket-row">
                  <span className="edp-ticket-row__key">Giá từ</span>
                  <span className="edp-ticket-row__price">{formattedMinPrice}</span>
                </div>

                <div className="edp-ticket-divider" />

                <ul className="edp-ticket-types">
                  {tickets.map((ticket) => (
                    <li key={ticket.id} className="edp-ticket-types__row">
                      <span className="edp-ticket-types__name">{ticket.type}</span>
                      <span className="edp-ticket-types__price">{formatPrice(ticket.price)}</span>
                    </li>
                  ))}
                </ul>

                <div className="edp-ticket-divider" />
              </>
            ) : (
              <p className="edp-ticket-box__note">Vé sẽ được mở bán sớm.</p>
            )}

            <Link href={`/events/${event.id}/tickets`} className="edp-cta-button">
              Chọn vé
            </Link>

            <p className="edp-ticket-box__note">
              🔒 Thanh toán bảo mật · Hoàn tiền trong 24h
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}