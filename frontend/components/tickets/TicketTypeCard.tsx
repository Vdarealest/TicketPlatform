'use client';

import { Ticket } from '@/lib/types';
import { formatCurrencyVND } from '@/lib/format';
import { getZoneColor } from './SeatMap';

interface TicketTypeCardProps {
  ticket: Ticket;
  selected: boolean;
  index: number;
  onSelect: (ticket: Ticket) => void;
}

export default function TicketTypeCard({ ticket, selected, index, onSelect }: TicketTypeCardProps) {
  const soldOut = ticket.quantity <= 0;
  const lowStock = !soldOut && ticket.quantity <= 10;
  const { color, colorBg } = getZoneColor(ticket.type, index);

  return (
    <button
      type="button"
      onClick={() => !soldOut && onSelect(ticket)}
      disabled={soldOut}
      aria-pressed={selected}
      style={{
        // Selected state keeps its light pastel tint in both themes, so text
        // inside must stay dark; unselected follows the theme variables.
        borderColor: selected ? color : 'var(--border-input)',
        background: selected ? colorBg : 'var(--surface-primary)',
        boxShadow: selected ? `0 4px 16px ${color}33` : undefined,
      }}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all duration-200 sm:px-6
        ${selected ? '' : 'hover:shadow-md'}
        ${soldOut ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: color }}
      />

      <div className="flex flex-1 flex-col">
        <span
          className="text-base font-bold sm:text-lg"
          style={{ color: selected ? '#111' : 'var(--text-primary)' }}
        >
          {ticket.type}
        </span>
        <span
          className="text-xs font-medium sm:text-sm"
          style={{
            color: soldOut
              ? 'var(--text-quaternary)'
              : lowStock
                ? '#d97706'
                : selected ? '#6b7280' : 'var(--text-tertiary)',
          }}
        >
          {soldOut ? 'Hết vé' : lowStock ? `Sắp hết · còn ${ticket.quantity} vé` : `Còn ${ticket.quantity} vé`}
        </span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <span className="text-base font-extrabold sm:text-lg" style={{ color }}>
          {formatCurrencyVND(ticket.price)}
        </span>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
          style={{
            borderColor: selected ? color : 'var(--border-input)',
            background: selected ? color : 'var(--input-bg)',
          }}
        >
          {selected && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6l3 3 5-6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </div>
    </button>
  );
}
