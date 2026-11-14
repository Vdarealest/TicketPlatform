'use client';

import { useMemo, useState } from 'react';
import { Seat, Ticket, SeatLayout, LayoutSection } from '@/lib/types';
import { formatCurrencyVND } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import {
  getSectionWH as getWH,
  seatLocalPos,
  seatDotRadius,
  readableGrid,
  arcWedgePath,
  sectionBBox,
  isArcSection,
  ARC_SECTION_DEFAULTS,
} from '@/lib/seatGeometry';

interface VenueSeatMapProps {
  layout: SeatLayout;
  tickets: Ticket[];
  selectedSeats: Seat[];
  onSelectSeat: (ticket: Ticket, seat: Seat) => void;
  onZoneFocus?: (ticket: Ticket) => void;
  busy?: boolean;
  maxSeats?: number;
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
  // Hover glow only tracked while zoomed — overview can have thousands of
  // dots, so per-seat interactivity stays scoped to the one zone in view.
  const [hoveredSeatId, setHoveredSeatId] = useState<number | null>(null);

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

  // Zooming drives the SVG viewBox itself rather than CSS-transforming the
  // world. The canvas is `height: auto`, so its rendered height follows the
  // viewBox aspect: scaling the world kept the *whole venue's* aspect, which
  // squashed a single zone into a short wide strip with unclickably small
  // seats. Framing the viewBox on the zone makes the canvas take the zone's
  // own proportions instead.
  const activeView = useMemo(() => {
    if (!zoomed) return view;
    const bb = sectionBBox(readableGrid(zoomed.sec));
    const pad = Math.max(24, Math.min(bb.w, bb.h) * 0.08);
    let x = bb.x - pad;
    let y = bb.y - pad;
    let w = bb.w + pad * 2;
    let h = bb.h + pad * 2;
    // Keep the frame roughly landscape so a long thin zone (e.g. a shallow
    // arc band) still gets a usable amount of vertical room.
    const MIN_AR = 1.1;
    const MAX_AR = 1.9;
    const ar = w / h;
    if (ar > MAX_AR) {
      const nh = w / MAX_AR;
      y -= (nh - h) / 2;
      h = nh;
    } else if (ar < MIN_AR) {
      const nw = h * MIN_AR;
      x -= (nw - w) / 2;
      w = nw;
    }
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  }, [zoomed, view]);

  const totalSeats = placed.reduce((a, p) => a + p.seats.length, 0);

  const focusZone = (secId: string, ticket: Ticket | null) => {
    setZoomId(secId);
    setHoveredSeatId(null);
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
        {/* Remount on zoom change so the fade-in animation replays, standing in
            for the transform transition the viewBox approach can't tween. */}
        <svg
          key={zoomId ?? '__overview__'}
          className="vsm-canvas vsm-canvas--fade"
          viewBox={`${activeView.x} ${activeView.y} ${activeView.w} ${activeView.h}`}
          role="img"
        >
          <defs>
            {/* Stage: brushed-metal gradient instead of a flat grey slab */}
            <linearGradient id="vsm-stage-metal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6b6b78" />
              <stop offset="45%" stopColor="#47474f" />
              <stop offset="100%" stopColor="#2b2b31" />
            </linearGradient>
            {/* Light spilling from the stage down over the seating area */}
            <radialGradient id="vsm-spotlight" cx="50%" cy="0%" r="75%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
              <stop offset="55%" stopColor="#fff" stopOpacity="0.045" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            {/* Soft halo for hovered/selected seats — cheap because only a
                handful of seats ever use it at once (zoomed view, max ~10
                selected + 1 hovered). */}
            <filter id="vsm-seat-glow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Diagonal hatch for HELD seats — reads as "temporarily taken by
                someone else" at a glance, rather than the same flat grey as a
                zone with no ticket assigned. */}
            <pattern id="vsm-held-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="#52525b" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#a1a1aa" strokeWidth="2" />
            </pattern>
            {/* Per-zone fill: a vertical gradient of the zone's own colour
                reads as a lit panel instead of a flat colour wash. */}
            {placed.map(({ sec }) => (
              <linearGradient key={sec.id} id={`vsm-zone-${sec.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sec.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={sec.color} stopOpacity="0.07" />
              </linearGradient>
            ))}
          </defs>

          {/* Backdrop — click to zoom out */}
          <rect x={activeView.x} y={activeView.y} width={activeView.w} height={activeView.h} fill="transparent" onClick={() => setZoomId(null)} />

          <g className="vsm-world">
            {/* Stage — hidden while zoomed: the zoomed zone is re-laid on a
                regular grid, so everything else is in a different coordinate
                space and would just overlap it. */}
            {stage && !zoomId && (
              <g style={{ pointerEvents: 'none' }}>
                {/* Spotlight wash, wide enough to spill past the stage edges
                    and over the first few rows of seating. */}
                <ellipse
                  cx={stage.x + stage.w / 2} cy={stage.y + stage.h}
                  rx={stage.w * 1.15} ry={stage.h * 7}
                  fill="url(#vsm-spotlight)"
                />
                <rect x={stage.x} y={stage.y} width={stage.w} height={stage.h} rx={6} fill="url(#vsm-stage-metal)" />
                {/* Thin bright edge along the top — the "lit lip" of the stage */}
                <rect x={stage.x + 2} y={stage.y + 1} width={stage.w - 4} height={1.4} fill="#fff" opacity={0.35} />
                <text x={stage.x + stage.w / 2} y={stage.y + stage.h * 0.67} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600} letterSpacing={1.5} style={{ userSelect: 'none' }}>
                  {lang === 'en' ? 'STAGE' : 'SÂN KHẤU'}
                </text>
              </g>
            )}

            {placed.map(({ sec, ticket, seats, available }) => {
              // Only the focused zone is drawn while zoomed — see the stage note.
              if (zoomId && sec.id !== zoomId) return null;

              if (isArcSection(sec)) {
                const isZoomedHere = zoomId === sec.id;
                // Same regular-grid treatment as rect zones: while zoomed the
                // band is widened so each row gets readable spacing. Must be
                // used for the wedge path too, or the drawn arc no longer
                // matches the frame computed from it.
                const dsec = isZoomedHere ? readableGrid(sec) : sec;
                const soldOut = ticket !== null && seats.length > 0 && available === 0;
                const noTicket = !ticket;
                const dotR = seatDotRadius(dsec);
                const ccx = dsec.centerX ?? ARC_SECTION_DEFAULTS.centerX;
                const ccy = dsec.centerY ?? ARC_SECTION_DEFAULTS.centerY;
                const inner = dsec.innerRadius ?? ARC_SECTION_DEFAULTS.innerRadius;
                const outer = dsec.outerRadius ?? ARC_SECTION_DEFAULTS.outerRadius;
                const startA = dsec.startAngle ?? ARC_SECTION_DEFAULTS.startAngle;
                const endA = dsec.endAngle ?? ARC_SECTION_DEFAULTS.endAngle;
                const midA = ((startA + endA) / 2) * (Math.PI / 180);
                const midR = (inner + outer) / 2;
                const rowChar = (r: number) => String.fromCharCode((sec.startLabel || 'A').charCodeAt(0) + r);
                const seatAt = (rr: number, cc: number) => seats.find(s => s.r === rr && s.c === cc);
                const letterOf = (p?: PlacedSeat) => p?.seat.label.match(/^[A-Za-z]+/)?.[0];
                const numberOf = (seat: Seat, fallback: number) => seat.label.match(/\d+/)?.[0] ?? String(fallback);

                const ghostDots: { cx: number; cy: number }[] = [];
                if (seats.length === 0) {
                  for (let r = 0; r < dsec.rows; r++) {
                    for (let c = 0; c < dsec.seatsPerRow; c++) {
                      ghostDots.push(seatLocalPos(dsec, r, c));
                    }
                  }
                }

                // Radial offset direction at a given angle (points away from center)
                const radialOffset = (angleDeg: number, r: number) => {
                  const a = (angleDeg * Math.PI) / 180;
                  return { dx: Math.cos(a) * r, dy: Math.sin(a) * r };
                };

                return (
                  <g key={sec.id}>
                    <path
                      d={arcWedgePath(dsec)}
                      fill={noTicket ? sec.color : `url(#vsm-zone-${sec.id})`}
                      fillOpacity={noTicket ? 0.06 : isZoomedHere ? 0.55 : 1}
                      stroke={sec.color}
                      strokeWidth={1.4}
                      strokeOpacity={noTicket ? 0.35 : 0.75}
                      vectorEffect="non-scaling-stroke"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); focusZone(sec.id, ticket); }}
                    >
                      <title>{sec.label}{ticket ? ` — ${formatCurrencyVND(ticket.price)} · ${available}/${seats.length} ${lang === 'en' ? 'available' : 'trống'}` : (lang === 'en' ? ' — not on sale' : ' — chưa mở bán')}</title>
                    </path>

                    {/* Ghost preview dots (no DB seats yet) */}
                    {ghostDots.map((g, i) => (
                      <circle key={i} cx={g.cx} cy={g.cy} r={dotR} fill={sec.color} opacity={0.25} style={{ pointerEvents: 'none' }} />
                    ))}

                    {/* Side markers (zoomed only): band letters at the two angular
                        ends of each row; seat numbers at the inner/outer radial
                        ends of each column. */}
                    {isZoomedHere && seats.length > 0 && Array.from({ length: sec.rows }, (_, r) => {
                      const startPt = seatLocalPos(dsec, r, 0);
                      const endPt = seatLocalPos(dsec, r, dsec.seatsPerRow - 1);
                      const off1 = radialOffset(startA, dotR * 0.15);
                      const off2 = radialOffset(endA, dotR * 0.15);
                      const mark = letterOf(seatAt(r, 0)) ?? rowChar(r);
                      return (
                        <g key={`rl-${r}`} style={{ pointerEvents: 'none' }}>
                          <text x={startPt.cx - off1.dx} y={startPt.cy - off1.dy} textAnchor="middle" dominantBaseline="central"
                            fontSize={dotR * 0.95} fontWeight={700} fill="rgba(255,255,255,0.45)" style={{ userSelect: 'none' }}>
                            {mark}
                          </text>
                          <text x={endPt.cx + off2.dx} y={endPt.cy + off2.dy} textAnchor="middle" dominantBaseline="central"
                            fontSize={dotR * 0.95} fontWeight={700} fill="rgba(255,255,255,0.45)" style={{ userSelect: 'none' }}>
                            {mark}
                          </text>
                        </g>
                      );
                    })}

                    {/* Real seats */}
                    {seats.map(({ seat, r, c }) => {
                      // Recomputed from dsec so dots sit on the widened band.
                      const { cx: sx, cy: sy } = seatLocalPos(dsec, r, c);
                      const isSelected = selectedIds.has(seat.id);
                      const isBooked = seat.status === 'BOOKED';
                      const isHeld = seat.status === 'HELD' && !isSelected;
                      const clickable = isZoomedHere && !isBooked && !isHeld && !busy && (!atMax || isSelected);
                      const dimmedByMax = atMax && !isSelected && !isBooked && !isHeld && isZoomedHere;
                      const isHovered = isZoomedHere && clickable && hoveredSeatId === seat.id;

                      let fill: string, fillOp: number, stroke: string, strokeOp: number, textFill: string;
                      if (isBooked) {
                        fill = '#26262f'; fillOp = 1; stroke = '#3c3c48'; strokeOp = 1; textFill = 'rgba(255,255,255,0.22)';
                      } else if (isHeld) {
                        fill = 'url(#vsm-held-hatch)'; fillOp = 1; stroke = '#a1a1aa'; strokeOp = 0.8; textFill = 'rgba(255,255,255,0.45)';
                      } else if (isSelected) {
                        fill = sec.color; fillOp = 1; stroke = '#fff'; strokeOp = 1; textFill = '#fff';
                      } else if (isHovered) {
                        fill = sec.color; fillOp = 0.32; stroke = '#fff'; strokeOp = 0.9; textFill = '#fff';
                      } else {
                        fill = sec.color; fillOp = isZoomedHere ? 0.16 : 0.9; stroke = sec.color; strokeOp = 1; textFill = 'rgba(255,255,255,0.95)';
                      }
                      const seatR = isSelected ? dotR * 1.1 : isHovered ? dotR * 1.18 : dotR;

                      return (
                        <g key={seat.id} opacity={dimmedByMax ? 0.35 : 1}>
                          {/* Expanding ping ring behind a selected seat — the
                              one flourish that draws the eye to "you picked
                              this", cheap because at most maxSeats run at once. */}
                          {isSelected && isZoomedHere && (
                            <circle
                              className="vsm-pulse-ring"
                              cx={sx} cy={sy} r={dotR}
                              fill={sec.color}
                              style={{ pointerEvents: 'none' }}
                            />
                          )}
                          <circle
                            cx={sx} cy={sy} r={seatR}
                            fill={fill}
                            fillOpacity={fillOp}
                            stroke={isZoomedHere ? stroke : 'none'}
                            strokeOpacity={strokeOp}
                            strokeWidth={isZoomedHere ? dotR * (isSelected ? 0.2 : 0.15) : 0}
                            filter={isZoomedHere && (isSelected || isHovered) ? 'url(#vsm-seat-glow)' : undefined}
                            style={{
                              cursor: clickable ? 'pointer' : isZoomedHere ? 'not-allowed' : 'default',
                              pointerEvents: isZoomedHere ? 'auto' : 'none',
                              transition: 'fill 0.15s, fill-opacity 0.15s, stroke 0.15s, r 0.12s ease-out',
                            }}
                            onMouseEnter={() => clickable && setHoveredSeatId(seat.id)}
                            onMouseLeave={() => setHoveredSeatId((id) => (id === seat.id ? null : id))}
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
                              textAnchor="middle" dominantBaseline="central"
                              fontSize={dotR * 0.9}
                              fontWeight={700}
                              fill={textFill}
                              style={{ pointerEvents: 'none', userSelect: 'none' }}
                            >
                              {numberOf(seat, c + 1)}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Zone label — hidden when zoomed into this zone */}
                    {!isZoomedHere && (
                      <text
                        x={ccx + midR * Math.cos(midA)} y={ccy + midR * Math.sin(midA)}
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
              }

              const isZoomedHere = zoomId === sec.id;
              // Overview keeps the box exactly as the admin drew it, but a box
              // can be drawn far too small for its seat count (e.g. 20 seats
              // across a 110-unit-wide box leaves 5.5 units per seat), which
              // makes the dots unclickable however far you zoom. So once zoomed
              // in to actually pick seats, re-lay them on a regular grid.
              const dsec = isZoomedHere ? readableGrid(sec) : sec;
              const { w, h } = getWH(dsec);
              const cx = dsec.x + w / 2;
              const cy = dsec.y + h / 2;
              const soldOut = ticket !== null && seats.length > 0 && available === 0;
              const noTicket = !ticket;
              const cellW = w / dsec.seatsPerRow;
              const cellH = h / dsec.rows;
              const dotR = seatDotRadius(dsec);
              const rot = dsec.rotation || 0;
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
                for (let r = 0; r < dsec.rows; r++) {
                  for (let c = 0; c < dsec.seatsPerRow; c++) {
                    ghostDots.push(seatLocalPos(dsec, r, c));
                  }
                }
              }

              return (
                <g key={sec.id} transform={`rotate(${rot},${cx},${cy})`}>
                  {/* Zone box: always zoomable */}
                  <rect
                    x={dsec.x} y={dsec.y} width={w} height={h} rx={4}
                    fill={noTicket ? sec.color : `url(#vsm-zone-${sec.id})`}
                    fillOpacity={noTicket ? 0.06 : isZoomedHere ? 0.55 : 1}
                    stroke={sec.color}
                    strokeWidth={1.4}
                    strokeOpacity={noTicket ? 0.35 : 0.75}
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); focusZone(sec.id, ticket); }}
                  >
                    <title>{sec.label}{ticket ? ` — ${formatCurrencyVND(ticket.price)} · ${available}/${seats.length} ${lang === 'en' ? 'available' : 'trống'}` : (lang === 'en' ? ' — not on sale' : ' — chưa mở bán')}</title>
                  </rect>

                  <g transform={`translate(${dsec.x}, ${dsec.y})`}>
                    {/* Ghost preview dots (no DB seats yet) */}
                    {ghostDots.map((g, i) => (
                      <circle key={i} cx={g.cx} cy={g.cy} r={dotR} fill={sec.color} opacity={0.25} style={{ pointerEvents: 'none' }} />
                    ))}

                    {/* Side markers (zoomed only). Rows horizontal on screen →
                        letters at the row ends; rows vertical (rotated ~90/270°)
                        → seat numbers at the column ends, which land on the
                        screen's left/right after rotation. */}
                    {isZoomedHere && seats.length > 0 && (rowsAreHorizontal
                      ? Array.from({ length: dsec.rows }, (_, r) => {
                          const left = seatLocalPos(dsec, r, 0);
                          const right = seatLocalPos(dsec, r, dsec.seatsPerRow - 1);
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
                      : Array.from({ length: dsec.seatsPerRow }, (_, c) => {
                          const top = seatLocalPos(dsec, 0, c);
                          const bot = seatLocalPos(dsec, dsec.rows - 1, c);
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
                    {seats.map(({ seat, r, c }) => {
                      // Recomputed from dsec so the zoomed-in regular grid and
                      // the to-scale overview each place seats correctly.
                      const { cx: sx, cy: sy } = seatLocalPos(dsec, r, c);
                      const isSelected = selectedIds.has(seat.id);
                      const isBooked = seat.status === 'BOOKED';
                      const isHeld = seat.status === 'HELD' && !isSelected;
                      const clickable = isZoomedHere && !isBooked && !isHeld && !busy && (!atMax || isSelected);
                      const dimmedByMax = atMax && !isSelected && !isBooked && !isHeld && isZoomedHere;
                      const isHovered = isZoomedHere && clickable && hoveredSeatId === seat.id;

                      // Zoomed: outlined circle with seat number (classic style).
                      // Overview: small solid dot.
                      let fill: string, fillOp: number, stroke: string, strokeOp: number, textFill: string;
                      if (isBooked) {
                        fill = '#26262f'; fillOp = 1; stroke = '#3c3c48'; strokeOp = 1; textFill = 'rgba(255,255,255,0.22)';
                      } else if (isHeld) {
                        fill = 'url(#vsm-held-hatch)'; fillOp = 1; stroke = '#a1a1aa'; strokeOp = 0.8; textFill = 'rgba(255,255,255,0.45)';
                      } else if (isSelected) {
                        fill = sec.color; fillOp = 1; stroke = '#fff'; strokeOp = 1; textFill = '#fff';
                      } else if (isHovered) {
                        fill = sec.color; fillOp = 0.32; stroke = '#fff'; strokeOp = 0.9; textFill = '#fff';
                      } else {
                        fill = sec.color; fillOp = isZoomedHere ? 0.16 : 0.9; stroke = sec.color; strokeOp = 1; textFill = 'rgba(255,255,255,0.95)';
                      }
                      const seatR = isSelected ? dotR * 1.1 : isHovered ? dotR * 1.18 : dotR;

                      return (
                        <g key={seat.id} opacity={dimmedByMax ? 0.35 : 1}>
                          {isSelected && isZoomedHere && (
                            <circle
                              className="vsm-pulse-ring"
                              cx={sx} cy={sy} r={dotR}
                              fill={sec.color}
                              style={{ pointerEvents: 'none' }}
                            />
                          )}
                          <circle
                            cx={sx} cy={sy} r={seatR}
                            fill={fill}
                            fillOpacity={fillOp}
                            stroke={isZoomedHere ? stroke : 'none'}
                            strokeOpacity={strokeOp}
                            strokeWidth={isZoomedHere ? dotR * (isSelected ? 0.2 : 0.15) : 0}
                            filter={isZoomedHere && (isSelected || isHovered) ? 'url(#vsm-seat-glow)' : undefined}
                            style={{
                              cursor: clickable ? 'pointer' : isZoomedHere ? 'not-allowed' : 'default',
                              pointerEvents: isZoomedHere ? 'auto' : 'none',
                              transition: 'fill 0.15s, fill-opacity 0.15s, stroke 0.15s, r 0.12s ease-out',
                            }}
                            onMouseEnter={() => clickable && setHoveredSeatId(seat.id)}
                            onMouseLeave={() => setHoveredSeatId((id) => (id === seat.id ? null : id))}
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
            <span className="vsm-legend-dot" style={{ background: sec.color, boxShadow: `0 0 0 3px ${sec.color}30` }} />
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
