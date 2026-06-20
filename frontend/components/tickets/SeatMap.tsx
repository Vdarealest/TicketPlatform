'use client';

import { Seat, Ticket } from '@/lib/types';

interface SeatMapProps {
  tickets: Ticket[];
  selectedSeat: Seat | null;
  onSelectSeat: (ticket: Ticket, seat: Seat) => void;
  busy?: boolean;
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

export default function SeatMap({ tickets, selectedSeat, onSelectSeat, busy }: SeatMapProps) {
  const zones = tickets
    .filter((ticket) => (ticket.seats?.length ?? 0) > 0)
    .map((ticket, i) => {
      const palette = getZoneColor(ticket.type, i);
      const seats = ticket.seats as Seat[];
      const cols = Math.max(...seats.map((s) => s.col)) + 1;
      const rows = Math.max(...seats.map((s) => s.row)) + 1;

      return { ticket, ...palette, seats, cols, rows };
    });

  const selectedTicketId = selectedSeat
    ? zones.find((z) => z.seats.some((s) => s.id === selectedSeat.id))?.ticket.id
    : null;

  return (
    <div className="seatmap-root">
      {/* Stage */}
      <div className="seatmap-stage">
        <span>SÂN KHẤU</span>
      </div>

      {/* Status legend */}
      <div className="seatmap-status-legend">
        <div className="seatmap-status-item">
          <span className="seatmap-status-dot seatmap-status-dot--available" />
          <span>Còn trống</span>
        </div>
        <div className="seatmap-status-item">
          <span className="seatmap-status-dot seatmap-status-dot--selected" />
          <span>Đang chọn</span>
        </div>
        <div className="seatmap-status-item">
          <span className="seatmap-status-dot seatmap-status-dot--held" />
          <span>Đang giữ</span>
        </div>
        <div className="seatmap-status-item">
          <span className="seatmap-status-dot seatmap-status-dot--booked" />
          <span>Đã bán</span>
        </div>
      </div>

      {/* Zones */}
      <div className="seatmap-zones">
        {zones.length === 0 ? (
          <p className="seatmap-empty">Chưa có dữ liệu ghế cho sự kiện này.</p>
        ) : (
          zones.map((zone) => {
            const isDimmed = selectedTicketId !== null && selectedTicketId !== undefined && selectedTicketId !== zone.ticket.id;

            return (
              <div
                key={zone.ticket.id}
                className={`seatmap-zone-wrap ${isDimmed ? 'seatmap-zone-wrap--dimmed' : ''}`}
                style={isDimmed ? undefined : { borderColor: zone.color + '40', background: zone.color + '14' }}
              >
                {/* Zone label */}
                <div className="seatmap-zone-label" style={{ color: zone.color }}>
                  <span className="seatmap-zone-dot" style={{ background: zone.color }} />
                  {zone.ticket.type}
                  <span className="seatmap-zone-qty">{zone.ticket.quantity} vé còn lại</span>
                </div>

                {/* Seats grid with row labels */}
                <div className="seatmap-grid-wrap">
                  <div className="seatmap-row-labels">
                    {Array.from({ length: zone.rows }).map((_, r) => (
                      <span key={r} className="seatmap-row-label">{ROW_LETTERS[r] ?? r + 1}</span>
                    ))}
                  </div>

                  <div
                    className="seatmap-grid"
                    style={{ gridTemplateColumns: `repeat(${zone.cols}, 1fr)` }}
                  >
                    {zone.seats.map((seat) => {
                      const isSelected = selectedSeat?.id === seat.id;
                      const isOwnHold = isSelected && seat.status === 'HELD';
                      const isLocked = seat.status === 'BOOKED' || (seat.status === 'HELD' && !isOwnHold) || !!busy;

                      let statusClass = 'seatmap-seat--available';
                      if (seat.status === 'BOOKED') statusClass = 'seatmap-seat--booked';
                      else if (seat.status === 'HELD' && !isOwnHold) statusClass = 'seatmap-seat--held';
                      else if (isSelected) statusClass = 'seatmap-seat--selected';

                      return (
                        <button
                          key={seat.id}
                          type="button"
                          disabled={isLocked}
                          onClick={() => onSelectSeat(zone.ticket, seat)}
                          title={`Ghế ${seat.label}${isLocked ? ' (không khả dụng)' : isSelected ? ' (đang giữ cho bạn — bấm để bỏ chọn)' : ''}`}
                          aria-label={`Ghế ${seat.label}`}
                          className={`seatmap-seat ${statusClass}`}
                          style={{
                            '--zone-color': zone.color,
                          } as React.CSSProperties}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedSeat && (
        <div className="seatmap-selection-banner">
          Ghế đã chọn: <strong>{selectedSeat.label}</strong>
        </div>
      )}

      {/* Zone / price legend */}
      <div className="seatmap-legend">
        {zones.map((zone) => {
          const isActiveZone = !!selectedSeat && zone.seats.some((s) => s.id === selectedSeat.id);

          return (
            <div
              key={zone.ticket.id}
              className={`seatmap-legend-item ${isActiveZone ? 'seatmap-legend-item--active' : ''}`}
              style={isActiveZone ? { background: zone.colorBg, borderColor: zone.color } : {}}
            >
              <span className="seatmap-legend-dot" style={{ background: zone.color }} />
              <span className="seatmap-legend-name">{zone.ticket.type}</span>
              <span className="seatmap-legend-price" style={{ color: zone.color }}>
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(zone.ticket.price)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
