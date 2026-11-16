'use client';

import { Ticket } from '@/lib/types';
import { formatCurrencyVND } from '@/lib/format';
import { getZoneColor } from './SeatMap';
import { useTranslation, fmt } from '@/lib/i18n';

interface TicketTypeCardProps {
  ticket: Ticket;
  selected: boolean;
  index: number;
  /** Colour of this tier's zone on the seat map, so both agree. Falls back to
   *  the generated palette for events drawn without a layout. */
  color?: string;
  onSelect: (ticket: Ticket) => void;
}

export default function TicketTypeCard({ ticket, selected, index, color: zoneColor, onSelect }: TicketTypeCardProps) {
  const { t } = useTranslation();
  const soldOut = ticket.quantity <= 0;
  const lowStock = !soldOut && ticket.quantity <= 10;
  const color = zoneColor ?? getZoneColor(ticket.type, index).color;

  return (
    <button
      type="button"
      onClick={() => !soldOut && onSelect(ticket)}
      disabled={soldOut}
      aria-pressed={selected}
      className={`ttc ${selected ? 'ttc--selected' : ''} ${soldOut ? 'ttc--disabled' : ''}`}
      style={
        // Only the zone colour is dynamic; the surface stays theme-driven so a
        // selected row reads the same in light and dark mode.
        selected
          ? { borderColor: color, boxShadow: `0 0 0 4px ${color}1f` }
          : undefined
      }
    >
      <span className="ttc__dot" style={{ background: color }} />

      <span className="ttc__text">
        <span className="ttc__name">{ticket.type}</span>
        <span className={`ttc__qty ${lowStock ? 'ttc__qty--low' : ''} ${soldOut ? 'ttc__qty--out' : ''}`}>
          {soldOut ? t.ttc_sold_out : fmt(lowStock ? t.ttc_low_stock : t.ttc_left, { n: ticket.quantity })}
        </span>
      </span>

      <span className="ttc__price" style={selected ? { color } : undefined}>
        {formatCurrencyVND(ticket.price)}
      </span>

      <span
        className="ttc__radio"
        style={selected ? { borderColor: color, background: color } : undefined}
      >
        {selected && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}
