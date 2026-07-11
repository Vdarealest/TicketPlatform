'use client';

import { useMemo, useState } from 'react';
import { Seat, Ticket, SeatLayout, LayoutSection } from '@/lib/types';
import { formatCurrencyVND } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';

interface VenueSeatMapProps {
  layout: SeatLayout;
  tickets: Ticket[];
  selectedSeats: Seat[];
  onSelectSeat: (ticket: Ticket, seat: Seat) => void;
  onZoneFocus?: (ticket: Ticket) => void;
  busy?: boolean;
  maxSeats?: number;
}

const CELL = 28;

function getWH(sec: LayoutSection) {
  return {
    w: sec.w ?? sec.seatsPerRow * CELL,
    h: sec.h ?? sec.rows * CELL,
  };
}

/** Local (cx, cy) of seat r/c inside a section box, same arc formula as the admin designer. */
function seatLocalPos(sec: LayoutSection, r: number, c: number) {
  const { w, h } = getWH(sec);
  const cellW = w / sec.seatsPerRow;
  const cellH = h / sec.rows;
  const dir = sec.curveDir ?? 'down';
  const halfAngle = ((sec.curve || 0) / 100) * (Math.PI * 0.48);

  const baseCy = cellH * r + cellH / 2;
  const baseCx = cellW * c + cellW / 2;
  let cx = baseCx;
  let cy = baseCy;
  if (halfAngle > 0.001) {
    if (dir === 'down' || dir === 'up') {
      if (sec.seatsPerRow > 1) {
        const t = (c / (sec.seatsPerRow - 1)) * 2 - 1;
        const angle = t * halfAngle;
        const arcR = (w / 2) / Math.sin(halfAngle);
        cx = w / 2 + arcR * Math.sin(angle);
        const bow = arcR * (1 - Math.cos(angle));
        cy = dir === 'down' ? baseCy + bow : baseCy - bow;
      }
    } else {
      if (sec.rows > 1) {
        const t = (r / (sec.rows - 1)) * 2 - 1;
        const angle = t * halfAngle;
        const arcR = (h / 2) / Math.sin(halfAngle);
        cy = h / 2 + arcR * Math.sin(angle);
        const bow = arcR * (1 - Math.cos(angle));
        cx = dir === 'right' ? baseCx + bow : baseCx - bow;
      }
    }
  }
  return { cx, cy };
}

/** Axis-aligned bounding box of a section after rotation. */
function sectionBBox(sec: LayoutSection) {
  const { w, h } = getWH(sec);
  const cx = sec.x + w / 2;
  const cy = sec.y + h / 2;
  const rad = ((sec.rotation || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const bw = w * cos + h * sin;
  const bh = w * sin + h * cos;
  return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, cx, cy };
}

interface PlacedSeat {
  seat: Seat;
  cx: number;
  cy: number;
  r: number;
  c: number;
}

interface PlacedSection {
  sec: LayoutSection;
  ticket: Ticket | null;
  seats: PlacedSeat[];
  available: number;
}

export default function VenueSeatMap({ layout, tickets, selectedSeats, onSelectSeat, onZoneFocus, busy, maxSeats = 10 }: VenueSeatMapProps) {
  const { lang } = useTranslation();
  const [zoomId, setZoomId] = useState<string | null>(null);

  const selectedIds = new Set(selectedSeats.map((s) => s.id));
  const atMax = selectedSeats.length >= maxSeats;

  // Assign DB seats to layout sections. Seats were generated section-by-section
  // in layout order (row-major), so per ticket we hand out sorted seats in slices.
  const placed: PlacedSection[] = useMemo(() => {
    const cursor = new Map<number, number>();
    const sortedByTicket = new Map<number, Seat[]>();
    for (const t of tickets) {
      sortedByTicket.set(t.id, [...(t.seats ?? [])].sort((a, b) => a.id - b.id));
    }
    return (layout.sections ?? []).map((sec) => {
      const ticket = tickets.find((t) => t.id === sec.ticketId) ?? null;
      const seats: PlacedSeat[] = [];
      if (ticket) {
        const pool = sortedByTicket.get(ticket.id) ?? [];
        const start = cursor.get(ticket.id) ?? 0;
        const count = sec.rows * sec.seatsPerRow;
        const slice = pool.slice(start, start + count);
        cursor.set(ticket.id, start + slice.length);
        slice.forEach((seat, i) => {
          const r = Math.floor(i / sec.seatsPerRow);
          const c = i % sec.seatsPerRow;
          const { cx, cy } = seatLocalPos(sec, r, c);
          seats.push({ seat, cx, cy, r, c });
        });
      }
      return {
        sec,
        ticket,
        seats,
        available: seats.filter((p) => p.seat.status === 'AVAILABLE').length,
      };
    });
  }, [layout, tickets]);

  const stage = layout.stage ?? null;

  // Auto-fit viewBox around actual content (sections + stage) so off-center
  // drawings are always framed nicely.
  const view = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = (x: number, y: number, w: number, h: number) => {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
    };
    for (const sec of layout.sections ?? []) {
      const bb = sectionBBox(sec);
      grow(bb.x, bb.y, bb.w, bb.h);
    }
    if (stage) grow(stage.x, stage.y, stage.w, stage.h);
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 900; maxY = 620; }
    const PAD = 32;
    const x = minX - PAD, y = minY - PAD;
    const w = Math.max(maxX - minX + PAD * 2, 320);
    const h = Math.max(maxY - minY + PAD * 2, 240);
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  }, [layout, stage]);

  const zoomed = placed.find((p) => p.sec.id === zoomId) ?? null;

  // Zoom transform: frame the (rotated) section bbox at the viewBox centre.
  let transform = 'translate(0px, 0px) scale(1)';
  if (zoomed) {
    const bb = sectionBBox(zoomed.sec);
    const PAD = 40;
    const s = Math.min(view.w / (bb.w + PAD * 2), view.h / (bb.h + PAD * 2), 8);
    const tx = view.cx - s * bb.cx;
    const ty = view.cy - s * bb.cy;
    transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  }

  const totalSeats = placed.reduce((a, p) => a + p.seats.length, 0);

  const focusZone = (secId: string, ticket: Ticket | null) => {
    setZoomId(secId);
    if (ticket && onZoneFocus) onZoneFocus(ticket);
  };

  return (
    <div className="vsm-root">
      {/* Warning: layout exists but no seats generated yet */}
      {totalSeats === 0 && (
        <div className="vsm-banner">
          {lang === 'en' ? 'Seats for this event are not open yet. Please check back later.' : 'Sơ đồ ghế của sự kiện chưa được mở bán. Vui lòng quay lại sau.'}
        </div>
      )}

      {/* Top bar: back-to-overview + section info */}
      <div className="vsm-topbar">
        {zoomed ? (
          <>
            <button type="button" className="vsm-back-btn" onClick={() => setZoomId(null)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {lang === 'en' ? 'Overview' : 'Toàn cảnh'}
            </button>
            <span className="vsm-topbar__info">
              <span className="vsm-topbar__dot" style={{ background: zoomed.sec.color }} />
              <strong>{zoomed.sec.label}</strong>
              {zoomed.ticket && <span className="vsm-topbar__price">{formatCurrencyVND(zoomed.ticket.price)}</span>}
              {zoomed.seats.length > 0
                ? <span className="vsm-topbar__avail">{zoomed.available} {lang === 'en' ? 'available' : 'ghế trống'}</span>
                : <span className="vsm-topbar__avail">{lang === 'en' ? 'No seats yet' : 'Chưa có ghế mở bán'}</span>}
            </span>
          </>
        ) : (
          <span className="vsm-topbar__hint">{lang === 'en' ? 'Click a zone to zoom in and pick seats' : 'Nhấn vào một khu để phóng to và chọn ghế'}</span>
        )}
      </div>

      <div className="vsm-canvas-wrap">
        <svg className="vsm-canvas" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} role="img">
          {/* Backdrop — click to zoom out */}
          <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="transparent" onClick={() => setZoomId(null)} />

          <g className="vsm-world" style={{ transform, transition: 'transform 0.45s cubic-bezier(0.25, 0.8, 0.35, 1)' }}>
            {/* Stage */}
            {stage && (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={stage.x} y={stage.y} width={stage.w} height={stage.h} rx={6} fill="#555" opacity={0.65} />
                <text x={stage.x + stage.w / 2} y={stage.y + stage.h * 0.67} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600} style={{ userSelect: 'none' }}>
                  {lang === 'en' ? 'STAGE' : 'SÂN KHẤU'}
                </text>
              </g>
            )}

            {placed.map(({ sec, ticket, seats, available }) => {
              const { w, h } = getWH(sec);
              const cx = sec.x + w / 2;
              const cy = sec.y + h / 2;
              const isZoomedHere = zoomId === sec.id;
              const soldOut = ticket !== null && seats.length > 0 && available === 0;
              const noTicket = !ticket;
              const cellW = w / sec.seatsPerRow;
              const cellH = h / sec.rows;
              const dotR = Math.min(cellW, cellH) * 0.38;
              const rot = sec.rotation || 0;
              // Counter-rotate text so it stays upright inside rotated sections
              const upright = (x: number, y: number) => (rot ? `rotate(${-rot} ${x} ${y})` : undefined);
              // Does the row axis run horizontally on screen (rotation near 0/180)
              // or vertically (near 90/270)? Decides where side markers go.
              const quarter = ((Math.round(rot / 90) % 4) + 4) % 4;
              const rowsAreHorizontal = quarter === 0 || quarter === 2;
              const rowChar = (r: number) => String.fromCharCode((sec.startLabel || 'A').charCodeAt(0) + r);
              // Read letter/number straight from the real seat labels so the
              // display always matches what checkout will show.
              const seatAt = (rr: number, cc: number) => seats.find(s => s.r === rr && s.c === cc);
              const letterOf = (p?: PlacedSeat) => p?.seat.label.match(/^[A-Za-z]+/)?.[0];
              const numberOf = (seat: Seat, fallback: number) => seat.label.match(/\d+/)?.[0] ?? String(fallback);

              // Ghost dots: layout preview when DB seats don't exist yet
              const ghostDots: { cx: number; cy: number }[] = [];
              if (seats.length === 0) {
                for (let r = 0; r < sec.rows; r++) {
                  for (let c = 0; c < sec.seatsPerRow; c++) {
                    ghostDots.push(seatLocalPos(sec, r, c));
                  }
                }
              }

              return (
                <g key={sec.id} transform={`rotate(${rot},${cx},${cy})`}>
                  {/* Zone box: always zoomable */}
                  <rect
                    x={sec.x} y={sec.y} width={w} height={h} rx={4}
                    fill={sec.color}
                    fillOpacity={noTicket ? 0.06 : isZoomedHere ? 0.1 : 0.15}
                    stroke={sec.color}
                    strokeWidth={1.4}
                    strokeOpacity={noTicket ? 0.35 : 0.75}
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); focusZone(sec.id, ticket); }}
                  >
                    <title>{sec.label}{ticket ? ` — ${formatCurrencyVND(ticket.price)} · ${available}/${seats.length} ${lang === 'en' ? 'available' : 'trống'}` : (lang === 'en' ? ' — not on sale' : ' — chưa mở bán')}</title>
                  </rect>

                  <g transform={`translate(${sec.x}, ${sec.y})`}>
                    {/* Ghost preview dots (no DB seats yet) */}
                    {ghostDots.map((g, i) => (
                      <circle key={i} cx={g.cx} cy={g.cy} r={dotR} fill={sec.color} opacity={0.25} style={{ pointerEvents: 'none' }} />
                    ))}

                    {/* Side markers (zoomed only). Rows horizontal on screen →
                        letters at the row ends; rows vertical (rotated ~90/270°)
                        → seat numbers at the column ends, which land on the
                        screen's left/right after rotation. */}
                    {isZoomedHere && seats.length > 0 && (rowsAreHorizontal
                      ? Array.from({ length: sec.rows }, (_, r) => {
                          const left = seatLocalPos(sec, r, 0);
                          const right = seatLocalPos(sec, r, sec.seatsPerRow - 1);
                          const lx = left.cx - cellW * 0.95;
                          const rx = right.cx + cellW * 0.95;
                          const mark = letterOf(seatAt(r, 0)) ?? rowChar(r);
                          return (
                            <g key={`rl-${r}`} style={{ pointerEvents: 'none' }}>
                              <text x={lx} y={left.cy} transform={upright(lx, left.cy)} textAnchor="middle" dominantBaseline="central"
                                fontSize={dotR * 0.95} fontWeight={700} fill="rgba(255,255,255,0.45)" style={{ userSelect: 'none' }}>
                                {mark}
                              </text>
                              <text x={rx} y={right.cy} transform={upright(rx, right.cy)} textAnchor="middle" dominantBaseline="central"
                                fontSize={dotR * 0.95} fontWeight={700} fill="rgba(255,255,255,0.45)" style={{ userSelect: 'none' }}>
                                {mark}
                              </text>
                            </g>
                          );
                        })
                      : Array.from({ length: sec.seatsPerRow }, (_, c) => {
                          const top = seatLocalPos(sec, 0, c);
                          const bot = seatLocalPos(sec, sec.rows - 1, c);
                          const ty = top.cy - cellH * 0.95;
                          const by = bot.cy + cellH * 0.95;
                          const mark = letterOf(seatAt(0, c)) ?? rowChar(c);
                          return (
                            <g key={`cl-${c}`} style={{ pointerEvents: 'none' }}>
                              <text x={top.cx} y={ty} transform={upright(top.cx, ty)} textAnchor="middle" dominantBaseline="central"
                                fontSize={dotR * 0.95} fontWeight={700} fill="rgba(255,255,255,0.45)" style={{ userSelect: 'none' }}>
                                {mark}
                              </text>
                              <text x={bot.cx} y={by} transform={upright(bot.cx, by)} textAnchor="middle" dominantBaseline="central"
                                fontSize={dotR * 0.95} fontWeight={700} fill="rgba(255,255,255,0.45)" style={{ userSelect: 'none' }}>
                                {mark}
                              </text>
                            </g>
                          );
                        })
                    )}

                    {/* Real seats */}
                    {seats.map(({ seat, cx: sx, cy: sy, r, c }) => {
                      const isSelected = selectedIds.has(seat.id);
                      const isBooked = seat.status === 'BOOKED';
                      const isHeld = seat.status === 'HELD' && !isSelected;
                      const clickable = isZoomedHere && !isBooked && !isHeld && !busy && (!atMax || isSelected);
                      const dimmedByMax = atMax && !isSelected && !isBooked && !isHeld && isZoomedHere;

                      // Zoomed: outlined circle with seat number (classic style).
                      // Overview: small solid dot.
                      let fill: string, fillOp: number, stroke: string, strokeOp: number, textFill: string;
                      if (isBooked) {
                        fill = '#26262f'; fillOp = 1; stroke = '#3c3c48'; strokeOp = 1; textFill = 'rgba(255,255,255,0.22)';
                      } else if (isHeld) {
                        fill = '#52525b'; fillOp = 0.3; stroke = '#71717a'; strokeOp = 0.8; textFill = 'rgba(255,255,255,0.35)';
                      } else if (isSelected) {
                        fill = sec.color; fillOp = 1; stroke = '#fff'; strokeOp = 1; textFill = '#fff';
                      } else {
                        fill = sec.color; fillOp = isZoomedHere ? 0.16 : 0.9; stroke = sec.color; strokeOp = 1; textFill = 'rgba(255,255,255,0.95)';
                      }

                      return (
                        <g key={seat.id} opacity={dimmedByMax ? 0.35 : 1}>
                          <circle
                            cx={sx} cy={sy} r={isSelected ? dotR * 1.06 : dotR}
                            fill={fill}
                            fillOpacity={fillOp}
                            stroke={isZoomedHere ? stroke : 'none'}
                            strokeOpacity={strokeOp}
                            strokeWidth={isZoomedHere ? dotR * (isSelected ? 0.2 : 0.15) : 0}
                            style={{
                              cursor: clickable ? 'pointer' : isZoomedHere ? 'not-allowed' : 'default',
                              pointerEvents: isZoomedHere ? 'auto' : 'none',
                              transition: 'fill 0.15s, fill-opacity 0.15s, stroke 0.15s',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (clickable && ticket) onSelectSeat(ticket, seat);
                            }}
                          >
                            <title>{seat.label}{ticket ? ` — ${ticket.type}` : ''}{isBooked ? (lang === 'en' ? ' (sold)' : ' (đã bán)') : isHeld ? (lang === 'en' ? ' (held)' : ' (đang giữ)') : ''}</title>
                          </circle>
                          {isZoomedHere && (
                            <text
                              x={sx} y={sy}
                              transform={upright(sx, sy)}
                              textAnchor="middle" dominantBaseline="central"
                              fontSize={dotR * 0.9}
                              fontWeight={700}
                              fill={textFill}
                              style={{ pointerEvents: 'none', userSelect: 'none' }}
                            >
                              {numberOf(seat, rowsAreHorizontal ? c + 1 : r + 1)}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>

                  {/* Zone label — hidden when zoomed into this zone */}
                  {!isZoomedHere && (
                    <text
                      x={cx} y={cy}
                      transform={upright(cx, cy)}
                      textAnchor="middle" dominantBaseline="central"
                      fill="#fff" fontSize={12} fontWeight={700}
                      style={{ pointerEvents: 'none', userSelect: 'none', paintOrder: 'stroke' }}
                      stroke="rgba(0,0,0,0.55)" strokeWidth={3}
                    >
                      {sec.label}{soldOut ? (lang === 'en' ? ' · SOLD OUT' : ' · HẾT VÉ') : ''}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Status legend — inside the dark area so it stays readable */}
        <div className="vsm-status-legend">
          <span className="vsm-status-item"><span className="vsm-status-dot" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }} />{lang === 'en' ? 'Available' : 'Còn trống'}</span>
          <span className="vsm-status-item"><span className="vsm-status-dot" style={{ background: '#fff' }} />{lang === 'en' ? 'Selected' : 'Đang chọn'}</span>
          <span className="vsm-status-item"><span className="vsm-status-dot" style={{ background: '#a1a1aa' }} />{lang === 'en' ? 'Held' : 'Đang giữ'}</span>
          <span className="vsm-status-item"><span className="vsm-status-dot" style={{ background: '#3f3f46' }} />{lang === 'en' ? 'Sold' : 'Đã bán'}</span>
        </div>
      </div>

      {/* Zone legend: click to zoom */}
      <div className="vsm-legend">
        {placed.filter((p) => p.ticket).map(({ sec, ticket, seats, available }) => (
          <button
            key={sec.id}
            type="button"
            className={`vsm-legend-item ${zoomId === sec.id ? 'vsm-legend-item--active' : ''}`}
            onClick={() => (zoomId === sec.id ? setZoomId(null) : focusZone(sec.id, ticket))}
          >
            <span className="vsm-legend-dot" style={{ background: sec.color }} />
            <span className="vsm-legend-name">{sec.label}</span>
            <span className="vsm-legend-qty">{available}/{seats.length}</span>
            <span className="vsm-legend-price" style={{ color: sec.color }}>{formatCurrencyVND(ticket!.price)}</span>
          </button>
        ))}
      </div>

      {/* Selection banner */}
      {selectedSeats.length > 0 && (
        <div className="vsm-selection-banner">
          {lang === 'en' ? 'Selected' : 'Đã chọn'}: <strong>{selectedSeats.length}/{maxSeats}</strong> — {selectedSeats.map((s) => s.label).join(', ')}
        </div>
      )}
    </div>
  );
}
