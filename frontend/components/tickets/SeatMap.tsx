'use client';

import { Seat, Ticket } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';

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
// Row name for a 0-based index: A…Z, then AA, AB, … A plain 26-letter table
// ran out on big zones and fell back to bare numbers ("26", "27").
function rowName(index: number): string {
  let n = Math.max(0, index);
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export function getZoneColor(type: string, index = 0) {
  return ZONE_COLORS[type.toLowerCase()] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

interface RenderRow {
  ticket: Ticket;
  color: string;
  seats: Seat[];
  isFirstOfZone: boolean;
  zoneName: string;
}

export default function SeatMap({ tickets, selectedSeats, onSelectSeat, busy, maxSeats = 10 }: SeatMapProps) {
  const { lang } = useTranslation();
  const selectedIds = new Set(selectedSeats.map((s) => s.id));
  const atMax = selectedSeats.length >= maxSeats;

  const zones = tickets
    .filter((t) => (t.seats?.length ?? 0) > 0)
    .map((t, i) => ({
      ticket: t,
      ...getZoneColor(t.type, i),
      minRow: Math.min(...t.seats!.map((s) => s.row)),
    }))
    .sort((a, b) => a.minRow - b.minRow);

  const renderRows: RenderRow[] = [];
  let globalMaxCols = 0;

  for (const z of zones) {
    const byRow = new Map<number, Seat[]>();
    for (const seat of z.ticket.seats!) {
      const arr = byRow.get(seat.row) || [];
      arr.push(seat);
      byRow.set(seat.row, arr);
    }
    const sortedRowKeys = [...byRow.keys()].sort((a, b) => a - b);
    let isFirst = true;
    for (const rk of sortedRowKeys) {
      const seats = byRow.get(rk)!.sort((a, b) => a.col - b.col);
      globalMaxCols = Math.max(globalMaxCols, seats.length);
      renderRows.push({
        ticket: z.ticket,
        color: z.color,
        seats,
        isFirstOfZone: isFirst,
        zoneName: z.ticket.type,
      });
      isFirst = false;
    }
  }

  const totalRows = renderRows.length;
  const hasAisle = globalMaxCols >= 8;
  const aisleAfter = hasAisle ? Math.floor(globalMaxCols / 2) : -1;

  return (
    <div className="seatmap-root">
      {/* Stage */}
      <div className="seatmap-stage-wrap">
        <div className="seatmap-stage-curve" />
        <div className="seatmap-stage"><span>STAGE</span></div>
      </div>

      {/* Legend */}
      <div className="seatmap-status-legend">
        <div className="seatmap-status-item">
          <span className="seatmap-status-dot seatmap-status-dot--available" />
          <span>{lang === 'en' ? 'Available' : 'Còn trống'}</span>
        </div>
        <div className="seatmap-status-item">
          <span className="seatmap-status-dot seatmap-status-dot--selected" />
          <span>{lang === 'en' ? 'Selected' : 'Đang chọn'}</span>
        </div>
        <div className="seatmap-status-item">
          <span className="seatmap-status-dot seatmap-status-dot--held" />
          <span>{lang === 'en' ? 'Held' : 'Đang giữ'}</span>
        </div>
        <div className="seatmap-status-item">
          <span className="seatmap-status-dot seatmap-status-dot--booked" />
          <span>{lang === 'en' ? 'Sold' : 'Đã bán'}</span>
        </div>
      </div>

      {/* Seat grid with perspective */}
      <div className="seatmap-grid">
        {renderRows.map((rr, rowIdx) => {
          const rowLetter = rowName(rowIdx);
          const perspectiveScale = 1 - (rowIdx / totalRows) * 0.08;
          const padCols = globalMaxCols - rr.seats.length;
          const padLeft = Math.floor(padCols / 2);

          return (
            <div key={`${rr.ticket.id}-${rowIdx}`}>
              {/* Zone label */}
              {rr.isFirstOfZone && (
                <div className="seatmap-zone-label" style={{ color: rr.color }}>
                  {rr.zoneName}
                </div>
              )}

              <div
                className="seatmap-row"
                style={{ transform: `scaleX(${perspectiveScale})` }}
              >
                <span className="seatmap-row-label" style={{ color: rr.color }}>
                  {rowLetter}
                </span>

                <div className="seatmap-seats">
                  {/* Left pad for centering */}
                  {padLeft > 0 && <div style={{ width: padLeft * 28 }} />}

                  {rr.seats.map((seat, ci) => {
                    const isSelected = selectedIds.has(seat.id);
                    const isOwnHold = isSelected && seat.status === 'HELD';
                    const isLocked = seat.status === 'BOOKED' || (seat.status === 'HELD' && !isOwnHold) || (!!busy && !isSelected);
                    const isDisabledByMax = atMax && !isSelected && seat.status === 'AVAILABLE';

                    let cls = 'seatmap-seat';
                    if (seat.status === 'BOOKED') cls += ' seatmap-seat--booked';
                    else if (seat.status === 'HELD' && !isOwnHold) cls += ' seatmap-seat--held';
                    else if (isSelected) cls += ' seatmap-seat--selected';
                    else if (isDisabledByMax) cls += ' seatmap-seat--disabled';

                    return (
                      <span key={seat.id}>
                        {/* Aisle gap */}
                        {hasAisle && ci === aisleAfter && <span className="seatmap-aisle" />}
                        <button
                          type="button"
                          disabled={isLocked || isDisabledByMax}
                          onClick={() => onSelectSeat(rr.ticket, seat)}
                          title={`${seat.label} — ${rr.ticket.type}`}
                          className={cls}
                          style={{
                            '--seat-color': rr.color,
                            '--seat-bg': isSelected ? rr.color : undefined,
                          } as React.CSSProperties}
                        >
                          {ci + 1}
                        </button>
                      </span>
                    );
                  })}
                </div>

                <span className="seatmap-row-label" style={{ color: rr.color }}>
                  {rowLetter}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selection banner */}
      {selectedSeats.length > 0 && (
        <div className="seatmap-selection-banner">
          {lang === 'en' ? 'Selected' : 'Đã chọn'}: <strong>{selectedSeats.length}/{maxSeats}</strong> — {selectedSeats.map((s) => s.label).join(', ')}
        </div>
      )}

      {/* Zone legend */}
      <div className="seatmap-legend">
        {zones.map((z) => {
          const count = z.ticket.seats!.length;
          const available = z.ticket.seats!.filter((s) => s.status === 'AVAILABLE').length;
          const isActive = selectedSeats.some((s) => z.ticket.seats!.some((zs) => zs.id === s.id));
          return (
            <div
              key={z.ticket.id}
              className={`seatmap-legend-item ${isActive ? 'seatmap-legend-item--active' : ''}`}
              style={isActive ? { background: z.colorBg, borderColor: z.color } : {}}
            >
              <span className="seatmap-legend-dot" style={{ background: z.color }} />
              <span className="seatmap-legend-name">{z.ticket.type}</span>
              <span className="seatmap-legend-qty">{available}/{count}</span>
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
