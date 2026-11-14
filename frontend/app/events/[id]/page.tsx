import type { Metadata } from 'next';
import EventDetailClient from './EventDetailClient';
import { getEvent } from '@/lib/server-api';
import { ogImage } from '@/lib/image';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import type { EventDetail } from '@/lib/types';

// Server wrapper around the (client) event page. It exists so the HTML that
// Google, Facebook and Zalo receive already carries the event's title,
// description and poster instead of a "Loading..." shell.

type Props = { params: Promise<{ id: string }> };

const VN_TZ = 'Asia/Ho_Chi_Minh';

function formatWhen(iso?: string) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TZ, weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function lowestPrice(event: EventDetail) {
  const prices = (event.tickets || []).map((t) => Number(t.price)).filter((p) => Number.isFinite(p));
  return prices.length ? Math.min(...prices) : null;
}

function describe(event: EventDetail) {
  const own = (event.description || '').replace(/\s+/g, ' ').trim();
  if (own) return own.length > 160 ? `${own.slice(0, 157)}…` : own;
  const parts = [formatWhen(event.startTime), event.venue?.name || event.location].filter(Boolean);
  const from = lowestPrice(event);
  if (from !== null) parts.push(`Vé từ ${from.toLocaleString('vi-VN')}đ`);
  return `${parts.join(' · ')}. Đặt vé ${event.title} trên ${SITE_NAME}.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: 'Sự kiện' };

  const description = describe(event);
  const image = event.bannerUrl ? ogImage(event.bannerUrl) : undefined;
  const path = `/events/${event.id}`;

  return {
    title: event.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title: event.title,
      description,
      siteName: SITE_NAME,
      locale: 'vi_VN',
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: event.title }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: event.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

// schema.org Event, so search engines can show date, place and price.
function eventJsonLd(event: EventDetail) {
  const from = lowestPrice(event);
  const prices = (event.tickets || []).map((t) => Number(t.price));
  const soldOut = (event.tickets || []).every((t) => Number(t.quantity) <= 0);
  const place = event.venue?.name || event.location;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: describe(event),
    startDate: event.startTime,
    endDate: event.endTime,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(event.bannerUrl ? { image: [ogImage(event.bannerUrl)] } : {}),
    location: {
      '@type': 'Place',
      name: place,
      address: event.venue?.address || event.location,
    },
    organizer: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    ...(from !== null
      ? {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'VND',
            lowPrice: from,
            highPrice: Math.max(...prices),
            availability: soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
            url: `${SITE_URL}/events/${event.id}`,
          },
        }
      : {}),
  };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const event = await getEvent(id);

  return (
    <>
      {event && (
        <script
          type="application/ld+json"
          // JSON.stringify output is data, not markup; "<" is escaped so a
          // title like "</script>" can't close the tag early.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd(event)).replace(/</g, '\\u003c') }}
        />
      )}
      <EventDetailClient initialEvent={event} />
    </>
  );
}
