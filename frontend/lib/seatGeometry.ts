/**
 * Shared seat-placement geometry for the admin SeatDesigner and the
 * customer-facing VenueSeatMap. Both must compute pixel-identical seat
 * positions from the same section definition — factored here once so the
 * two views can never drift apart.
 */

const CELL = 28;

/** Minimal shape both DesignerSection (admin) and LayoutSection (customer) satisfy. */
export interface SeatSection {
  type?: 'rect' | 'arc';
  // rect geometry
  x: number;
  y: number;
  w?: number;
  h?: number;
  rotation: number;
  curve: number;
  curveDir?: 'down' | 'up' | 'left' | 'right';
  // arc geometry
  centerX?: number;
  centerY?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  // common grid
  rows: number;
  seatsPerRow: number;
}

export function isArcSection(sec: SeatSection) {
  return sec.type === 'arc';
}

export function getSectionWH(sec: SeatSection) {
  return {
    w: sec.w ?? sec.seatsPerRow * CELL,
    h: sec.h ?? sec.rows * CELL,
  };
}

// Centre sits just under the default stage so a fresh arc sweeps the lower
// half as a bowl facing it, and row A (inner radius) is the front row nearest
// the stage — matching how real arena maps are numbered.
// Angles are SVG-style: 0° = +X (right), growing clockwise because y points down.
const ARC_DEFAULTS = { centerX: 450, centerY: 60, innerRadius: 140, outerRadius: 260, startAngle: 20, endAngle: 160 };

/**
 * Position of seat (r, c) within a section.
 * - rect: LOCAL coords relative to (sec.x, sec.y) — caller wraps in
 *   translate(sec.x, sec.y) then rotate(sec.rotation, cx, cy).
 * - arc: absolute/world coords directly — orientation is fully encoded by
 *   centerX/centerY/startAngle/endAngle, so no rotate/translate wrapper is used.
 */
export function seatLocalPos(sec: SeatSection, r: number, c: number) {
  if (isArcSection(sec)) {
    const inner = sec.innerRadius ?? ARC_DEFAULTS.innerRadius;
    const outer = sec.outerRadius ?? ARC_DEFAULTS.outerRadius;
    const startA = sec.startAngle ?? ARC_DEFAULTS.startAngle;
    const endA = sec.endAngle ?? ARC_DEFAULTS.endAngle;
    const band = (outer - inner) / sec.rows;
    const radius = inner + band * (r + 0.5);
    const span = endA - startA;
    const step = sec.seatsPerRow > 1 ? span / sec.seatsPerRow : 0;
    const angleDeg = startA + step * (c + 0.5);
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      cx: (sec.centerX ?? ARC_DEFAULTS.centerX) + radius * Math.cos(angleRad),
      cy: (sec.centerY ?? ARC_DEFAULTS.centerY) + radius * Math.sin(angleRad),
    };
  }

  const { w, h } = getSectionWH(sec);
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

/** Room one seat needs before its dot becomes too small to read or tap. */
const READABLE_CELL = 28;

/**
 * A copy of `sec` guaranteed to give every seat at least READABLE_CELL of room.
 * A zone can be drawn far smaller than its seat count needs (20 seats across a
 * 110-unit box leaves 5.5 units each), which no amount of zooming can rescue —
 * the dots stay proportionally tiny. Use this when the zone is being shown for
 * seat picking; use the raw section for the to-scale overview.
 */
export function readableGrid<T extends SeatSection>(sec: T): T {
  if (isArcSection(sec)) {
    // Arc spacing comes from radii/angles, so grow the band outward instead.
    const inner = sec.innerRadius ?? ARC_DEFAULTS.innerRadius;
    const outer = sec.outerRadius ?? ARC_DEFAULTS.outerRadius;
    const needed = inner + sec.rows * READABLE_CELL;
    return outer >= needed ? sec : { ...sec, outerRadius: needed };
  }
  const { w, h } = getSectionWH(sec);
  return {
    ...sec,
    w: Math.max(w, sec.seatsPerRow * READABLE_CELL),
    h: Math.max(h, sec.rows * READABLE_CELL),
  };
}

/** Radius of a single seat dot, sized to fit within its row/column cell (rect) or band/angular-step (arc). */
export function seatDotRadius(sec: SeatSection) {
  if (isArcSection(sec)) {
    const inner = sec.innerRadius ?? ARC_DEFAULTS.innerRadius;
    const outer = sec.outerRadius ?? ARC_DEFAULTS.outerRadius;
    const bandThickness = (outer - inner) / sec.rows;
    const span = (sec.endAngle ?? ARC_DEFAULTS.endAngle) - (sec.startAngle ?? ARC_DEFAULTS.startAngle);
    const angleStepRad = sec.seatsPerRow > 1 ? (Math.abs(span) / sec.seatsPerRow) * (Math.PI / 180) : 0.3;
    const midRadius = (inner + outer) / 2;
    const arcLenPerSeat = angleStepRad * midRadius;
    return Math.min(bandThickness, arcLenPerSeat) * 0.38;
  }
  const { w, h } = getSectionWH(sec);
  const cellW = w / sec.seatsPerRow;
  const cellH = h / sec.rows;
  return Math.min(cellW, cellH) * 0.38;
}

/** SVG path for the arc/wedge zone outline (annulus segment). Arc sections only. */
export function arcWedgePath(sec: SeatSection) {
  const inner = sec.innerRadius ?? ARC_DEFAULTS.innerRadius;
  const outer = sec.outerRadius ?? ARC_DEFAULTS.outerRadius;
  const startDeg = sec.startAngle ?? ARC_DEFAULTS.startAngle;
  const endDeg = sec.endAngle ?? ARC_DEFAULTS.endAngle;
  const ccx = sec.centerX ?? ARC_DEFAULTS.centerX;
  const ccy = sec.centerY ?? ARC_DEFAULTS.centerY;
  const startA = (startDeg * Math.PI) / 180;
  const endA = (endDeg * Math.PI) / 180;
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const pt = (r: number, a: number): [number, number] => [ccx + r * Math.cos(a), ccy + r * Math.sin(a)];
  const [x1, y1] = pt(inner, startA);
  const [x2, y2] = pt(outer, startA);
  const [x3, y3] = pt(outer, endA);
  const [x4, y4] = pt(inner, endA);
  return `M ${x1} ${y1} L ${x2} ${y2} A ${outer} ${outer} 0 ${largeArc} 1 ${x3} ${y3} L ${x4} ${y4} A ${inner} ${inner} 0 ${largeArc} 0 ${x1} ${y1} Z`;
}

/** Axis-aligned bounding box of a section, in world/canvas coords. */
export function sectionBBox(sec: SeatSection) {
  if (isArcSection(sec)) {
    const inner = sec.innerRadius ?? ARC_DEFAULTS.innerRadius;
    const outer = sec.outerRadius ?? ARC_DEFAULTS.outerRadius;
    const startDeg = sec.startAngle ?? ARC_DEFAULTS.startAngle;
    const endDeg = sec.endAngle ?? ARC_DEFAULTS.endAngle;
    const ccx = sec.centerX ?? ARC_DEFAULTS.centerX;
    const ccy = sec.centerY ?? ARC_DEFAULTS.centerY;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const a = ((startDeg + ((endDeg - startDeg) * i) / N) * Math.PI) / 180;
      for (const r of [inner, outer]) {
        const x = ccx + r * Math.cos(a);
        const y = ccy + r * Math.sin(a);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: ccx, cy: ccy };
  }

  const { w, h } = getSectionWH(sec);
  const cx = sec.x + w / 2;
  const cy = sec.y + h / 2;
  const rad = ((sec.rotation || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const bw = w * cos + h * sin;
  const bh = w * sin + h * cos;
  return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, cx, cy };
}

export const ARC_SECTION_DEFAULTS = ARC_DEFAULTS;
