'use client';

import Link from 'next/link';
import { useTranslation, translateCategory } from '../../lib/i18n';
import { cdnImage, cdnSrcSet } from '../../lib/image';

interface FeaturedEventCardProps {
  event: any;
  /** Cycles the accent colour so three cards in a row don't read as one
   *  flat block — purely decorative, carries no meaning of its own. */
  index: number;
}

// Warm → cool → warm, so neighbouring cards never land on the same hue.
const ACCENTS = ['#e8732c', '#c23b7a', '#2f6fd6'];

export default function FeaturedEventCard({ event, index }: FeaturedEventCardProps) {
  const { lang } = useTranslation();
  const locale = lang === 'en' ? 'en-US' : 'vi-VN';

  const date = event.startTime
    ? new Date(event.startTime).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const category = translateCategory(event.category || event.type, lang);
  const accent = ACCENTS[index % ACCENTS.length];

  return (
    <Link href={`/events/${event.id}`} className="fec-link">
      <article className="fec-card">
        <div className="fec-img-wrap">
          <img
            src={cdnImage(event.bannerUrl, 640)}
            srcSet={cdnSrcSet(event.bannerUrl, [400, 640, 960])}
            sizes="(max-width: 560px) 100vw, (max-width: 980px) 50vw, 33vw"
            alt={event.title}
            className="fec-img"
            loading="lazy"
            decoding="async"
          />
          {category && (
            <span className="fec-badge" style={{ background: accent }}>{category}</span>
          )}
        </div>
        <div className="fec-body">
          <h3 className="fec-title">{event.title}</h3>
          {date && <p className="fec-date">{date}</p>}
        </div>
      </article>
    </Link>
  );
}
