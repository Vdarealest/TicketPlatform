'use client';

import { Seat, Ticket } from '@/lib/types';

interface SeatMapProps {
  tickets: Ticket[];
  selectedSeats: Seat[];
  onSelectSeat: (ticket: Ticket, seat: Seat) => void;
  busy?: boolean;
  maxSeats?: number;
}

export const ZONE_COLORS: Record<string, { color: string; colorBg: string }> = {
  svip: { color: '#f59e0b', colorBg: '#fef3c7' },
  vip: { color: '#f43f5e', colorBg: '#ffe4e6' },
  premium: { color: '#a855f7', colorBg: '#f3e8ff' },
  standard: { color: '#3b82f6', colorBg: '#dbeafe' },
  economy: { color: '#10b981', colorBg: '#d1fae5' },
  elite: { color: '#f97316', colorBg: '#ffedd5' },
};

const FALLBACK_COLORS = Object.values(ZONE_COLORS);
const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function getZoneColor(type: string, index = 0) {
  return ZONE_COLORS[type.toLowerCase()] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

interface RenderRow {
  ticket: Ticket;
  color: string;
  seats: Seat[]; // sorted by col
}

export default function SeatMap({ tickets, selectedSeats, onSelectSeat, busy, maxSeats = 10 }: SeatMapProps) {
  const selectedIds = new Set(selectedSeats.map((s) => s.id));
  const atMax = selectedSeats.length >= maxSeats;

  const zones = tickets
    .filter((t) => (t.seats?.length ?? 0) > 0)
    .map((t, i) => ({
      ticket: t,
      ...getZoneColor(t.type, i),
      minRow: Math.min(...t.seats!.map((s) => s.row)),
    }))
    // Xếp zone theo hàng nhỏ nhất → liên tục A→Z, gần sân khấu trước
    .sort((a, b) => a.minRow - b.minRow);

  // Build render rows: group by zone, then by stored row within zone.
  // This guarantees no zone disappears even if row numbers collide across zones.
  const renderRows: RenderRow[] = [];
  let maxColCount = 0;
  for (const z of zones) {
    const byRow = new Map<number, Seat[]>();
    for (const seat of z.ticket.seats!) {
      const arr = byRow.get(seat.row) || [];
      arr.push(seat);
      byRow.set(seat.row, arr);
    }
    const sortedRowKeys = [...byRow.keys()].sort((a, b) => a - b);
    for (const rk of sortedRowKeys) {
      const seats = byRow.get(rk)!.sort((a, b) => a.col - b.col);
      maxColCount = Math.max(maxColCount, seats.length);
      renderRows.push({ ticket: z.ticket, color: z.color, seats });
    }
  }

  return (
    <div className="seatmap-root">
      <div className="seatmap-stage"><span>SÂN KHẤU</span></div>

      <div className="seatmap-status-legend">
        <div className="seatmap-status-item"><span className="seatmap-status-dot seatmap-status-dot--available" /><span>Còn trống</span></div>
        <div className="seatmap-status-item"><span className="seatmap-status-dot seatmap-status-dot--selected" /><span>Đang chọn</span></div>
        <div className="seatmap-status-item"><span className="seatmap-status-dot seatmap-status-dot--held" /><span>Đang giữ</span></div>
        <div className="seatmap-status-item"><span className="seatmap-status-dot seatmap-status-dot--booked" /><span>Đã bán</span></div>
      </div>

      {/* Unified seat grid */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 0', overflowX: 'auto' }}>
        {renderRows.map((rr, rowIdx) => {
          const rowLetter = ROW_LETTERS[rowIdx] ?? String(rowIdx + 1);
          const isNewZone = rowIdx > 0 && renderRows[rowIdx - 1].ticket.id !== rr.ticket.id;

          return (
            <div key={`${rr.ticket.id}-${rowIdx}`} style={{ marginTop: isNewZone ? 8 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {/* Row label left */}
                <span style={{ width: 18, textAlign: 'center', fontSize: 10, fontWeight: 700, color: rr.color, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                  {rowLetter}
                </span>

                {/* Seats */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {rr.seats.map((seat, ci) => {
                    const isSelected = selectedIds.has(seat.id);
                    const isOwnHold = isSelected && seat.status === 'HELD';
                    const isLocked = seat.status === 'BOOKED' || (seat.status === 'HELD' && !isOwnHold) || (!!busy && !isSelected);
                    const isDisabledByMax = atMax && !isSelected && seat.status === 'AVAILABLE';

                    let bg = rr.color;
                    let opacity = 1;
                    let border = '1.5px solid transparent';
                    let boxShadow = 'none';
                    let textColor = '#fff';

                    if (seat.status === 'BOOKED') {
                      bg = '#3a3a4a'; opacity = 0.45; textColor = '#777';
                    } else if (seat.status === 'HELD' && !isOwnHold) {
                      bg = '#555'; opacity = 0.55; textColor = '#999';
                    } else if (isSelected) {
                      border = '2px solid #fff';
                      boxShadow = `0 0 0 2px ${rr.color}`;
                    } else if (isDisabledByMax) {
                      opacity = 0.3;
                    }

                    return (
                      <button
                        key={seat.id}
                        type="button"
                        disabled={isLocked || isDisabledByMax}
                        onClick={() => onSelectSeat(rr.ticket, seat)}
                        title={`${seat.label} — ${rr.ticket.type}`}
                        style={{
                          width: 22, height: 22, borderRadius: 11, border, boxShadow,
                          background: bg, opacity, color: textColor,
                          fontSize: 8.5, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: isLocked || isDisabledByMax ? 'not-allowed' : 'pointer',
                          padding: 0, lineHeight: 1, flexShrink: 0,
                          transition: 'transform 0.1s, box-shadow 0.1s',
                        }}
                      >
                        {ci + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selection banner */}
      {selectedSeats.length > 0 && (
        <div className="seatmap-selection-banner">
          Đã chọn: <strong>{selectedSeats.length}/{maxSeats}</strong> — {selectedSeats.map((s) => s.label).join(', ')}
        </div>
      )}

      {/* Zone legend */}
      <div className="seatmap-legend">
        {zones.map((z) => {
          const isActive = selectedSeats.some((s) => z.ticket.seats!.some((zs) => zs.id === s.id));
          return (
            <div
              key={z.ticket.id}
              className={`seatmap-legend-item ${isActive ? 'seatmap-legend-item--active' : ''}`}
              style={isActive ? { background: z.colorBg, borderColor: z.color } : {}}
            >
              <span className="seatmap-legend-dot" style={{ background: z.color }} />
              <span className="seatmap-legend-name">{z.ticket.type}</span>
              <span className="seatmap-legend-price" style={{ color: z.color }}>
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(z.ticket.price)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
