'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getSectionWH,
  seatLocalPos as sharedSeatPos,
  seatDotRadius,
  arcWedgePath,
  isArcSection,
  ARC_SECTION_DEFAULTS,
} from '@/lib/seatGeometry';
import { apiErrorMessage } from '@/lib/api';

const CELL = 28;
const CANVAS_W = 900;
const CANVAS_H = 620;
const GRID = 10;
const ZONE_COLORS = ['#f43f5e', '#f59e0b', '#a855f7', '#3b82f6', '#10b981', '#f97316', '#06b6d4', '#ec4899'];

export interface DesignerSection {
  id: string;
  ticketId?: number | null;
  label: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  rows: number;
  seatsPerRow: number;
  rotation: number;
  curve: number;
  curveDir?: 'down' | 'up' | 'left' | 'right';
  // Arc/wedge geometry (only when type === 'arc') — see lib/seatGeometry.ts
  centerX?: number;
  centerY?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  startLabel: string;
  type?: 'rect' | 'arc';
  color: string;
}

export interface DesignerStage { x: number; y: number; w: number; h: number; }

export interface DesignerLayout { sections: DesignerSection[]; stage: DesignerStage; }

interface TicketOption { id: number; type: string; seatCount?: number; }

interface SeatDesignerProps {
  title: string;
  subtitle?: string | null;
  initialSections: DesignerSection[];
  initialStage?: DesignerStage | null;
  tickets?: TicketOption[] | null;
  emptyHint: string;
  onSave: (layout: DesignerLayout) => Promise<void>;
  /** Optional second header button (e.g. "Tạo ghế"). Receives the current layout, returns a status message. */
  secondaryAction?: { label: string; busyLabel: string; run: (layout: DesignerLayout) => Promise<string> };
}

const uid = () => Math.random().toString(36).slice(2, 9);
const snap = (v: number) => Math.round(v / GRID) * GRID;
const getWH = getSectionWH;

/** Narrowest wedge we allow, so a zone can never collapse to nothing. */
const MIN_ARC_SPAN = 5;

/** Shift `angle` by whole turns until it lands within ±180° of `near`. */
function unwrapAngle(angle: number, near: number) {
  let a = angle;
  while (a - near > 180) a -= 360;
  while (a - near < -180) a += 360;
  return a;
}

function SeatPreview({ section }: { section: DesignerSection }) {
  const seats: { cx: number; cy: number }[] = [];
  for (let r = 0; r < section.rows; r++) {
    for (let c = 0; c < section.seatsPerRow; c++) {
      seats.push(sharedSeatPos(section, r, c));
    }
  }
  const dotR = seatDotRadius(section);
  return (
    <g>
      {seats.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={dotR} fill={section.color} opacity={0.85} />
      ))}
    </g>
  );
}

type DragState =
  | { kind: 'move'; id: string; startX: number; startY: number; origX: number; origY: number }
  | { kind: 'resize'; id: string; edge: 'r' | 'b' | 'br'; startX: number; startY: number; origW: number; origH: number }
  | { kind: 'stage-move'; startX: number; startY: number; origX: number; origY: number }
  | { kind: 'stage-resize'; startX: number; startY: number; origW: number; origH: number }
  | { kind: 'arc-move'; id: string; startX: number; startY: number; origCenterX: number; origCenterY: number }
  | { kind: 'arc-resize-outer'; id: string; startX: number; startY: number }
  | { kind: 'arc-resize-inner'; id: string; startX: number; startY: number }
  | { kind: 'arc-resize-start-angle'; id: string; startX: number; startY: number }
  | { kind: 'arc-resize-end-angle'; id: string; startX: number; startY: number };

export default function SeatDesigner({ title, subtitle, initialSections, initialStage, tickets, emptyHint, onSave, secondaryAction }: SeatDesignerProps) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);

  const [sections, setSections] = useState<DesignerSection[]>(initialSections);
  const [ticketList, setTicketList] = useState<TicketOption[] | null>(tickets ?? null);
  const [stage, setStage] = useState<DesignerStage>(initialStage ?? { x: 280, y: 10, w: 340, h: 34 });
  const [selected, setSelected] = useState<string | null>(null);
  const [stageSelected, setStageSelected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelected(null); setStageSelected(false); return; }
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        setSections(p => p.filter(s => s.id !== selected));
        setSelected(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const selectedSection = sections.find(s => s.id === selected) ?? null;

  const updateSection = useCallback((id: string, patch: Partial<DesignerSection>) => {
    setSections(p => p.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const getSVGPoint = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const onSectionMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelected(id);
    setStageSelected(false);
    const sec = sections.find(s => s.id === id)!;
    const p = getSVGPoint(e);
    setDrag({ kind: 'move', id, startX: p.x, startY: p.y, origX: sec.x, origY: sec.y });
  };

  /** Sweep an arc zone around its own centre, keeping the wedge width fixed. */
  const rotateArcTo = (id: string, newMidDeg: number) => {
    const sec = sections.find(s => s.id === id);
    if (!sec) return;
    const start = sec.startAngle ?? ARC_SECTION_DEFAULTS.startAngle;
    const end = sec.endAngle ?? ARC_SECTION_DEFAULTS.endAngle;
    const half = (end - start) / 2;
    updateSection(id, { startAngle: newMidDeg - half, endAngle: newMidDeg + half });
  };

  /** Widen/narrow an arc zone about its own midpoint. */
  const setArcSpan = (id: string, newSpanDeg: number) => {
    const sec = sections.find(s => s.id === id);
    if (!sec) return;
    const start = sec.startAngle ?? ARC_SECTION_DEFAULTS.startAngle;
    const end = sec.endAngle ?? ARC_SECTION_DEFAULTS.endAngle;
    const mid = (start + end) / 2;
    const half = Math.max(MIN_ARC_SPAN, Math.min(355, newSpanDeg)) / 2;
    updateSection(id, { startAngle: mid - half, endAngle: mid + half });
  };

  const onResizeHandleMouseDown = (e: React.MouseEvent, id: string, edge: 'r' | 'b' | 'br') => {
    e.stopPropagation();
    setSelected(id);
    const sec = sections.find(s => s.id === id)!;
    const { w, h } = getWH(sec);
    const p = getSVGPoint(e);
    setDrag({ kind: 'resize', id, edge, startX: p.x, startY: p.y, origW: w, origH: h });
  };

  const onStageMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(null);
    setStageSelected(true);
    const p = getSVGPoint(e);
    setDrag({ kind: 'stage-move', startX: p.x, startY: p.y, origX: stage.x, origY: stage.y });
  };

  const onStageResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const p = getSVGPoint(e);
    setDrag({ kind: 'stage-resize', startX: p.x, startY: p.y, origW: stage.w, origH: stage.h });
  };

  const onArcMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelected(id);
    setStageSelected(false);
    const sec = sections.find(s => s.id === id)!;
    const p = getSVGPoint(e);
    setDrag({
      kind: 'arc-move', id, startX: p.x, startY: p.y,
      origCenterX: sec.centerX ?? ARC_SECTION_DEFAULTS.centerX,
      origCenterY: sec.centerY ?? ARC_SECTION_DEFAULTS.centerY,
    });
  };

  const onArcHandleMouseDown = (
    e: React.MouseEvent, id: string,
    kind: 'arc-resize-outer' | 'arc-resize-inner' | 'arc-resize-start-angle' | 'arc-resize-end-angle',
  ) => {
    e.stopPropagation();
    setSelected(id);
    setStageSelected(false);
    const p = getSVGPoint(e);
    setDrag({ kind, id, startX: p.x, startY: p.y });
  };

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag) return;
    const p = getSVGPoint(e);
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;
    if (drag.kind === 'move') {
      const sec = sections.find(s => s.id === drag.id);
      const { w, h } = sec ? getWH(sec) : { w: 40, h: 40 };
      updateSection(drag.id, {
        x: Math.max(0, Math.min(CANVAS_W - w, snap(drag.origX + dx))),
        y: Math.max(0, Math.min(CANVAS_H - h, snap(drag.origY + dy))),
      });
    } else if (drag.kind === 'resize') {
      const MIN = CELL * 2;
      const patch: Partial<DesignerSection> = {};
      if (drag.edge === 'r' || drag.edge === 'br') patch.w = Math.max(MIN, snap(drag.origW + 2 * dx));
      if (drag.edge === 'b' || drag.edge === 'br') patch.h = Math.max(MIN, snap(drag.origH + 2 * dy));
      updateSection(drag.id, patch);
    } else if (drag.kind === 'stage-move') {
      setStage(s => ({
        ...s,
        x: Math.max(0, Math.min(CANVAS_W - s.w, snap(drag.origX + dx))),
        y: Math.max(0, Math.min(CANVAS_H - s.h, snap(drag.origY + dy))),
      }));
    } else if (drag.kind === 'stage-resize') {
      setStage(s => ({ ...s, w: Math.max(80, snap(drag.origW + dx)), h: Math.max(20, snap(drag.origH + dy)) }));
    } else if (drag.kind === 'arc-move') {
      updateSection(drag.id, {
        centerX: Math.max(0, Math.min(CANVAS_W, snap(drag.origCenterX + dx))),
        centerY: Math.max(0, Math.min(CANVAS_H, snap(drag.origCenterY + dy))),
      });
    } else if (drag.kind === 'arc-resize-outer' || drag.kind === 'arc-resize-inner') {
      const sec = sections.find(s => s.id === drag.id);
      if (sec) {
        const ccx = sec.centerX ?? ARC_SECTION_DEFAULTS.centerX;
        const ccy = sec.centerY ?? ARC_SECTION_DEFAULTS.centerY;
        const radius = Math.hypot(p.x - ccx, p.y - ccy);
        if (drag.kind === 'arc-resize-outer') {
          const inner = sec.innerRadius ?? ARC_SECTION_DEFAULTS.innerRadius;
          updateSection(drag.id, { outerRadius: Math.max(inner + 20, snap(radius)) });
        } else {
          const outer = sec.outerRadius ?? ARC_SECTION_DEFAULTS.outerRadius;
          updateSection(drag.id, { innerRadius: Math.max(0, Math.min(outer - 20, snap(radius))) });
        }
      }
    } else if (drag.kind === 'arc-resize-start-angle' || drag.kind === 'arc-resize-end-angle') {
      const sec = sections.find(s => s.id === drag.id);
      if (sec) {
        const ccx = sec.centerX ?? ARC_SECTION_DEFAULTS.centerX;
        const ccy = sec.centerY ?? ARC_SECTION_DEFAULTS.centerY;
        const start = sec.startAngle ?? ARC_SECTION_DEFAULTS.startAngle;
        const end = sec.endAngle ?? ARC_SECTION_DEFAULTS.endAngle;
        const isStart = drag.kind === 'arc-resize-start-angle';
        // atan2 returns -180..180, but stored angles can sit outside that range
        // (e.g. 200°). Unwrap into the same revolution as the value being
        // dragged, otherwise the span jumps by a full turn and the wedge
        // explodes into a wrap-around ring.
        const raw = Math.atan2(p.y - ccy, p.x - ccx) * (180 / Math.PI);
        const angleDeg = Math.round(unwrapAngle(raw, isStart ? start : end));
        if (isStart) {
          updateSection(drag.id, { startAngle: Math.min(angleDeg, end - MIN_ARC_SPAN) });
        } else {
          updateSection(drag.id, { endAngle: Math.max(angleDeg, start + MIN_ARC_SPAN) });
        }
      }
    }
  }, [drag, sections, updateSection]);

  const onMouseUp = useCallback(() => setDrag(null), []);

  const addSection = () => {
    const tix = ticketList?.[0] ?? null;
    const color = ZONE_COLORS[sections.length % ZONE_COLORS.length];
    const newSec: DesignerSection = {
      id: uid(),
      ticketId: tix?.id ?? null,
      label: tix?.type ?? `Khu ${sections.length + 1}`,
      x: snap(90 + (sections.length % 3) * 240),
      y: snap(90 + Math.floor(sections.length / 3) * 180),
      rows: 5,
      seatsPerRow: 8,
      rotation: 0,
      curve: 0,
      startLabel: 'A',
      type: 'rect',
      color,
    };
    setSections(p => [...p, newSec]);
    setSelected(newSec.id);
    setStageSelected(false);
  };

  const addArcSection = () => {
    const tix = ticketList?.[0] ?? null;
    const color = ZONE_COLORS[sections.length % ZONE_COLORS.length];
    const newSec: DesignerSection = {
      id: uid(),
      ticketId: tix?.id ?? null,
      label: tix?.type ?? `Khu ${sections.length + 1}`,
      x: 0, y: 0,
      rows: 4,
      seatsPerRow: 12,
      rotation: 0,
      curve: 0,
      startLabel: 'A',
      type: 'arc',
      color,
      centerX: ARC_SECTION_DEFAULTS.centerX,
      centerY: ARC_SECTION_DEFAULTS.centerY,
      innerRadius: ARC_SECTION_DEFAULTS.innerRadius,
      outerRadius: ARC_SECTION_DEFAULTS.outerRadius,
      startAngle: ARC_SECTION_DEFAULTS.startAngle,
      endAngle: ARC_SECTION_DEFAULTS.endAngle,
    };
    setSections(p => [...p, newSec]);
    setSelected(newSec.id);
    setStageSelected(false);
  };

  const duplicateSection = () => {
    if (!selectedSection) return;
    const copy: DesignerSection = isArcSection(selectedSection)
      ? {
          ...selectedSection,
          id: uid(),
          centerX: (selectedSection.centerX ?? ARC_SECTION_DEFAULTS.centerX) + 20,
          centerY: (selectedSection.centerY ?? ARC_SECTION_DEFAULTS.centerY) + 20,
        }
      : {
          ...selectedSection,
          id: uid(),
          x: Math.min(CANVAS_W - 60, selectedSection.x + 30),
          y: Math.min(CANVAS_H - 60, selectedSection.y + 30),
        };
    setSections(p => [...p, copy]);
    setSelected(copy.id);
  };

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 2500);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ sections, stage });
      flash('Đã lưu!');
    } catch {
      flash('Lưu thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleSecondary = async () => {
    if (!secondaryAction) return;
    setRunning(true);
    try {
      const m = await secondaryAction.run({ sections, stage });
      flash(m);
      // Generation rebuilds seats to match the drawn layout — sync local counts
      setTicketList(prev => prev?.map(t => ({
        ...t,
        seatCount: sections.filter(s => s.ticketId === t.id).reduce((a, s) => a + s.rows * s.seatsPerRow, 0),
      })) ?? null);
    } catch (err) {
      flash(apiErrorMessage(err, 'Thao tác thất bại.'));
    } finally {
      setRunning(false);
    }
  };

  const totalSeats = sections.reduce((a, s) => a + s.rows * s.seatsPerRow, 0);

  // Compare drawn capacity vs actual DB seats per ticket — if they differ,
  // the customer map can't line up and admin needs to regenerate.
  const mismatched = (ticketList ?? [])
    .filter(t => t.seatCount !== undefined)
    .map(t => ({
      ...t,
      capacity: sections.filter(s => s.ticketId === t.id).reduce((a, s) => a + s.rows * s.seatsPerRow, 0),
    }))
    .filter(t => t.capacity > 0 && t.capacity !== t.seatCount);

  return (
    <div className="sd-root">
      <div className="sd-header">
        <div className="sd-header__left">
          <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => router.back()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Quay lại
          </button>
          <h1 className="sd-title">
            {title}
            {subtitle && <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>({subtitle})</span>}
          </h1>
          {msg && <span className="sd-msg">{msg}</span>}
        </div>
        <div className="sd-header__right">
          <span className="sd-seat-count">{totalSeats} ghế</span>
          {secondaryAction && (
            <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={handleSecondary} disabled={running || saving}>
              {running ? secondaryAction.busyLabel : secondaryAction.label}
            </button>
          )}
          <button className="admin-btn admin-btn--primary" onClick={handleSave} disabled={saving || running}>
            {saving ? 'Đang lưu...' : 'Lưu sơ đồ'}
          </button>
        </div>
      </div>

      <div className="sd-body">
        {/* ── Properties panel ── */}
        <div className="sd-toolbar">
          {ticketList && ticketList.length === 0 && (
            <div className="sd-warn">
              Sự kiện này <strong>chưa có loại vé</strong> nên không thể gán vé cho khu ghế.
              Vào <Link href="/admin/events">Quản lý sự kiện</Link> → nút <strong>Sửa</strong> → &quot;+ Thêm loại vé&quot;, rồi quay lại đây.
            </div>
          )}

          {mismatched.length > 0 && (
            <div className="sd-warn">
              Ghế thực tế <strong>chưa khớp sơ đồ</strong>:
              {mismatched.map(t => (
                <div key={t.id}>· {t.type}: sơ đồ {t.capacity} ghế / hệ thống {t.seatCount} ghế</div>
              ))}
              Bấm <strong>&quot;Tạo ghế&quot;</strong> để tạo lại ghế theo sơ đồ.
            </div>
          )}
          <div className="sd-btn-row">
            <button className="sd-tool-btn" onClick={addSection}>+ Thêm khu</button>
            <button className="sd-tool-btn" onClick={addArcSection} title="Khu ghế cong dạng cung, toả quanh 1 tâm — dùng cho sơ đồ kiểu sân vận động">+ Thêm khu cong</button>
            {selectedSection && (
              <button className="sd-tool-btn" onClick={duplicateSection} title="Tạo bản sao của khu đang chọn">Nhân đôi</button>
            )}
          </div>
          {selectedSection && (
            <div className="sd-btn-row">
              <button className="sd-tool-btn sd-tool-btn--danger" onClick={() => { setSections(p => p.filter(s => s.id !== selected)); setSelected(null); }}>
                Xoá khu
              </button>
            </div>
          )}

          {selectedSection && (() => {
            const curveDir = selectedSection.curveDir ?? 'down';
            const { w, h } = getWH(selectedSection);
            return (
              <div className="sd-props">
                <div className="sd-prop">
                  <label>Tên khu</label>
                  <input value={selectedSection.label} onChange={e => updateSection(selected!, { label: e.target.value })} />
                </div>

                {ticketList && (
                  <div className="sd-prop">
                    <label>Loại vé</label>
                    <select
                      value={selectedSection.ticketId ?? ''}
                      onChange={e => {
                        const id = Number(e.target.value) || null;
                        const tix = ticketList.find(t => t.id === id);
                        updateSection(selected!, { ticketId: id, label: tix?.type ?? selectedSection.label });
                      }}
                    >
                      <option value="">— Chưa chọn —</option>
                      {ticketList.map(t => <option key={t.id} value={t.id}>{t.type}</option>)}
                    </select>
                  </div>
                )}

                <div className="sd-prop sd-prop--row">
                  <div>
                    <label>Số hàng</label>
                    <input type="number" min={1} max={60} value={selectedSection.rows}
                      onChange={e => updateSection(selected!, { rows: Math.max(1, Number(e.target.value)) })} />
                  </div>
                  <div>
                    <label>Ghế mỗi hàng</label>
                    <input type="number" min={1} max={100} value={selectedSection.seatsPerRow}
                      onChange={e => updateSection(selected!, { seatsPerRow: Math.max(1, Number(e.target.value)) })} />
                  </div>
                </div>

                {!isArcSection(selectedSection) ? (
                  <>
                    <div className="sd-prop">
                      <label>Xoay (°)</label>
                      <div className="sd-slider-row">
                        <input type="range" min={0} max={360} value={selectedSection.rotation}
                          onChange={e => updateSection(selected!, { rotation: Number(e.target.value) })} />
                        <input type="number" min={0} max={360} value={selectedSection.rotation}
                          onChange={e => updateSection(selected!, { rotation: ((Number(e.target.value) % 360) + 360) % 360 })} />
                      </div>
                    </div>

                    <div className="sd-prop">
                      <label>Độ cong</label>
                      <div className="sd-slider-row">
                        <input type="range" min={0} max={100} value={selectedSection.curve}
                          onChange={e => updateSection(selected!, { curve: Number(e.target.value) })} />
                        <input type="number" min={0} max={100} value={selectedSection.curve}
                          onChange={e => updateSection(selected!, { curve: Math.max(0, Math.min(100, Number(e.target.value))) })} />
                      </div>
                    </div>

                    {selectedSection.curve > 0 && (
                      <div className="sd-prop">
                        <label>Hướng cong</label>
                        <div className="sd-dir-grid">
                          <span /><button className={`sd-dir-btn${curveDir==='up'?' sd-dir-btn--active':''}`} onClick={() => updateSection(selected!, { curveDir: 'up' })}>↑</button><span />
                          <button className={`sd-dir-btn${curveDir==='left'?' sd-dir-btn--active':''}`} onClick={() => updateSection(selected!, { curveDir: 'left' })}>←</button>
                          <span className="sd-dir-center" />
                          <button className={`sd-dir-btn${curveDir==='right'?' sd-dir-btn--active':''}`} onClick={() => updateSection(selected!, { curveDir: 'right' })}>→</button>
                          <span /><button className={`sd-dir-btn${curveDir==='down'?' sd-dir-btn--active':''}`} onClick={() => updateSection(selected!, { curveDir: 'down' })}>↓</button><span />
                        </div>
                      </div>
                    )}
                  </>
                ) : (() => {
                  const start = selectedSection.startAngle ?? ARC_SECTION_DEFAULTS.startAngle;
                  const end = selectedSection.endAngle ?? ARC_SECTION_DEFAULTS.endAngle;
                  const mid = ((((start + end) / 2) % 360) + 360) % 360;
                  const span = end - start;
                  return (
                    <>
                      <div className="sd-prop">
                        <label>Xoay (°)</label>
                        <div className="sd-slider-row">
                          <input type="range" min={0} max={360} value={Math.round(mid)}
                            onChange={e => rotateArcTo(selected!, Number(e.target.value))} />
                          <input type="number" min={0} max={360} value={Math.round(mid)}
                            onChange={e => rotateArcTo(selected!, Number(e.target.value))} />
                        </div>
                      </div>

                      <div className="sd-prop">
                        <label>Độ mở (°)</label>
                        <div className="sd-slider-row">
                          <input type="range" min={MIN_ARC_SPAN} max={355} value={Math.round(span)}
                            onChange={e => setArcSpan(selected!, Number(e.target.value))} />
                          <input type="number" min={MIN_ARC_SPAN} max={355} value={Math.round(span)}
                            onChange={e => setArcSpan(selected!, Number(e.target.value))} />
                        </div>
                      </div>

                      <div className="sd-prop-info">
                        Kéo khối cong để di chuyển tâm · Kéo chấm ở cạnh ngoài/trong để đổi bán kính · Kéo chấm ở 2 đầu để đổi góc mở.
                      </div>
                    </>
                  );
                })()}

                <div className="sd-prop">
                  <label>Màu</label>
                  <div className="sd-color-row">
                    {ZONE_COLORS.map(c => (
                      <button key={c} className={`sd-color-dot ${selectedSection.color === c ? 'sd-color-dot--active' : ''}`}
                        style={{ background: c }} onClick={() => updateSection(selected!, { color: c })} />
                    ))}
                  </div>
                </div>

                <details className="sd-adv">
                  <summary>Nâng cao</summary>
                  {!isArcSection(selectedSection) ? (
                    <>
                      <div className="sd-prop sd-prop--row">
                        <div>
                          <label>Rộng (px)</label>
                          <input type="number" min={CELL * 2} value={Math.round(w)}
                            onChange={e => updateSection(selected!, { w: Math.max(CELL * 2, Number(e.target.value)) })} />
                        </div>
                        <div>
                          <label>Cao (px)</label>
                          <input type="number" min={CELL * 2} value={Math.round(h)}
                            onChange={e => updateSection(selected!, { h: Math.max(CELL * 2, Number(e.target.value)) })} />
                        </div>
                      </div>
                      <div className="sd-prop sd-prop--row">
                        <div>
                          <label>X</label>
                          <input type="number" value={Math.round(selectedSection.x)}
                            onChange={e => updateSection(selected!, { x: Math.max(0, Number(e.target.value)) })} />
                        </div>
                        <div>
                          <label>Y</label>
                          <input type="number" value={Math.round(selectedSection.y)}
                            onChange={e => updateSection(selected!, { y: Math.max(0, Number(e.target.value)) })} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="sd-prop sd-prop--row">
                        <div>
                          <label>Tâm X</label>
                          <input type="number" value={Math.round(selectedSection.centerX ?? ARC_SECTION_DEFAULTS.centerX)}
                            onChange={e => updateSection(selected!, { centerX: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label>Tâm Y</label>
                          <input type="number" value={Math.round(selectedSection.centerY ?? ARC_SECTION_DEFAULTS.centerY)}
                            onChange={e => updateSection(selected!, { centerY: Number(e.target.value) })} />
                        </div>
                      </div>
                      <div className="sd-prop sd-prop--row">
                        <div>
                          <label>Bán kính trong</label>
                          <input type="number" min={0} value={Math.round(selectedSection.innerRadius ?? ARC_SECTION_DEFAULTS.innerRadius)}
                            onChange={e => updateSection(selected!, { innerRadius: Math.max(0, Number(e.target.value)) })} />
                        </div>
                        <div>
                          <label>Bán kính ngoài</label>
                          <input type="number" min={20} value={Math.round(selectedSection.outerRadius ?? ARC_SECTION_DEFAULTS.outerRadius)}
                            onChange={e => updateSection(selected!, { outerRadius: Math.max(20, Number(e.target.value)) })} />
                        </div>
                      </div>
                      <div className="sd-prop sd-prop--row">
                        <div>
                          <label>Góc bắt đầu (°)</label>
                          <input type="number" value={Math.round(selectedSection.startAngle ?? ARC_SECTION_DEFAULTS.startAngle)}
                            onChange={e => updateSection(selected!, { startAngle: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label>Góc kết thúc (°)</label>
                          <input type="number" value={Math.round(selectedSection.endAngle ?? ARC_SECTION_DEFAULTS.endAngle)}
                            onChange={e => updateSection(selected!, { endAngle: Number(e.target.value) })} />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="sd-prop">
                    <label>Hàng bắt đầu từ chữ</label>
                    <input value={selectedSection.startLabel} onChange={e => updateSection(selected!, { startLabel: e.target.value })} />
                  </div>
                </details>
              </div>
            );
          })()}

          {stageSelected && !selectedSection && (
            <div className="sd-props">
              <p className="sd-props__heading">Sân khấu</p>
              <div className="sd-prop sd-prop--row">
                <div><label>Rộng</label><input type="number" min={80} value={Math.round(stage.w)} onChange={e => setStage(s => ({ ...s, w: Math.max(80, Number(e.target.value)) }))} /></div>
                <div><label>Cao</label><input type="number" min={20} value={Math.round(stage.h)} onChange={e => setStage(s => ({ ...s, h: Math.max(20, Number(e.target.value)) }))} /></div>
              </div>
              <div className="sd-prop sd-prop--row">
                <div><label>X</label><input type="number" value={Math.round(stage.x)} onChange={e => setStage(s => ({ ...s, x: Number(e.target.value) }))} /></div>
                <div><label>Y</label><input type="number" value={Math.round(stage.y)} onChange={e => setStage(s => ({ ...s, y: Number(e.target.value) }))} /></div>
              </div>
              <button
                className="sd-tool-btn"
                onClick={() => setStage(s => ({ ...s, x: snap((CANVAS_W - s.w) / 2) }))}
              >
                Căn giữa ngang
              </button>
            </div>
          )}

          {!selectedSection && !stageSelected && (
            <p className="sd-prop-info">{emptyHint}</p>
          )}
        </div>

        {/* ── Canvas ── */}
        <div className="sd-canvas-wrap">
          <svg
            ref={svgRef}
            className="sd-canvas"
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            preserveAspectRatio="xMidYMid meet"
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onMouseDown={() => { setSelected(null); setStageSelected(false); }}
          >
            {/* Dot grid + canvas border so the drawing area is obvious */}
            <defs>
              <pattern id="sd-grid" width={GRID * 2} height={GRID * 2} patternUnits="userSpaceOnUse">
                <circle cx={1} cy={1} r={1} fill="rgba(255,255,255,0.07)" />
              </pattern>
            </defs>
            <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="url(#sd-grid)" style={{ pointerEvents: 'none' }} />
            <rect x={0.5} y={0.5} width={CANVAS_W - 1} height={CANVAS_H - 1} fill="none" stroke="rgba(255,255,255,0.1)" rx={8} style={{ pointerEvents: 'none' }} />

            {/* Stage */}
            <g style={{ cursor: drag?.kind === 'stage-move' ? 'grabbing' : 'grab' }} onMouseDown={onStageMouseDown}>
              <rect
                x={stage.x} y={stage.y} width={stage.w} height={stage.h} rx={6}
                fill="#555" opacity={0.7}
                stroke={stageSelected ? '#fff' : 'transparent'} strokeWidth={2} strokeDasharray={stageSelected ? '5 3' : undefined}
              />
              <text x={stage.x + stage.w / 2} y={stage.y + stage.h * 0.67} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600} style={{ pointerEvents: 'none', userSelect: 'none' }}>SÂN KHẤU</text>
            </g>
            {stageSelected && (
              <rect
                x={stage.x + stage.w - 4} y={stage.y + stage.h - 4}
                width={8} height={8} rx={2}
                fill="#fff" stroke="#555" strokeWidth={1.5}
                style={{ cursor: 'nwse-resize' }}
                onMouseDown={onStageResizeMouseDown}
              />
            )}

            {/* Sections */}
            {sections.map(sec => {
              if (isArcSection(sec)) {
                const isSel = selected === sec.id;
                const ccx = sec.centerX ?? ARC_SECTION_DEFAULTS.centerX;
                const ccy = sec.centerY ?? ARC_SECTION_DEFAULTS.centerY;
                const inner = sec.innerRadius ?? ARC_SECTION_DEFAULTS.innerRadius;
                const outer = sec.outerRadius ?? ARC_SECTION_DEFAULTS.outerRadius;
                const startA = sec.startAngle ?? ARC_SECTION_DEFAULTS.startAngle;
                const endA = sec.endAngle ?? ARC_SECTION_DEFAULTS.endAngle;
                const midA = ((startA + endA) / 2) * (Math.PI / 180);
                const midR = (inner + outer) / 2;
                const startARad = (startA * Math.PI) / 180;
                const endARad = (endA * Math.PI) / 180;
                const HANDLE = 8;
                const labelX = ccx + midR * Math.cos(midA);
                const labelY = ccy + midR * Math.sin(midA);
                return (
                  <g key={sec.id}>
                    <path
                      d={arcWedgePath(sec)}
                      fill={sec.color} fillOpacity={isSel ? 0.22 : 0.12}
                      stroke={sec.color} strokeWidth={isSel ? 2 : 1} strokeOpacity={isSel ? 1 : 0.5}
                      style={{ cursor: drag?.kind === 'arc-move' && drag.id === sec.id ? 'grabbing' : 'grab' }}
                      onMouseDown={e => onArcMouseDown(e, sec.id)}
                    />
                    <g style={{ pointerEvents: 'none' }}>
                      <SeatPreview section={sec} />
                    </g>
                    <text
                      x={labelX} y={labelY}
                      textAnchor="middle" dominantBaseline="central"
                      fill="#fff" fontSize={11} fontWeight={700}
                      style={{ pointerEvents: 'none', userSelect: 'none', paintOrder: 'stroke' }}
                      stroke="rgba(0,0,0,0.5)" strokeWidth={3} opacity={0.95}
                    >
                      {sec.label}
                    </text>
                    {isSel && (
                      <>
                        <rect x={ccx + outer * Math.cos(midA) - HANDLE / 2} y={ccy + outer * Math.sin(midA) - HANDLE / 2}
                          width={HANDLE} height={HANDLE} rx={2}
                          fill="#fff" stroke={sec.color} strokeWidth={1.5} style={{ cursor: 'ns-resize' }}
                          onMouseDown={e => onArcHandleMouseDown(e, sec.id, 'arc-resize-outer')} />
                        <rect x={ccx + inner * Math.cos(midA) - HANDLE / 2} y={ccy + inner * Math.sin(midA) - HANDLE / 2}
                          width={HANDLE} height={HANDLE} rx={2}
                          fill="#fff" stroke={sec.color} strokeWidth={1.5} style={{ cursor: 'ns-resize' }}
                          onMouseDown={e => onArcHandleMouseDown(e, sec.id, 'arc-resize-inner')} />
                        <rect x={ccx + outer * Math.cos(startARad) - HANDLE / 2} y={ccy + outer * Math.sin(startARad) - HANDLE / 2}
                          width={HANDLE} height={HANDLE} rx={2}
                          fill="#fff" stroke={sec.color} strokeWidth={1.5} style={{ cursor: 'grab' }}
                          onMouseDown={e => onArcHandleMouseDown(e, sec.id, 'arc-resize-start-angle')} />
                        <rect x={ccx + outer * Math.cos(endARad) - HANDLE / 2} y={ccy + outer * Math.sin(endARad) - HANDLE / 2}
                          width={HANDLE} height={HANDLE} rx={2}
                          fill="#fff" stroke={sec.color} strokeWidth={1.5} style={{ cursor: 'grab' }}
                          onMouseDown={e => onArcHandleMouseDown(e, sec.id, 'arc-resize-end-angle')} />
                        <circle cx={ccx} cy={ccy} r={3} fill={sec.color} opacity={0.6} style={{ pointerEvents: 'none' }} />
                      </>
                    )}
                  </g>
                );
              }

              const { w, h } = getWH(sec);
              const cx = sec.x + w / 2;
              const cy = sec.y + h / 2;
              const isSel = selected === sec.id;
              const HANDLE = 8;
              return (
                <g key={sec.id} transform={`rotate(${sec.rotation},${cx},${cy})`}>
                  <rect
                    x={sec.x} y={sec.y} width={w} height={h} rx={4}
                    fill={sec.color} fillOpacity={isSel ? 0.22 : 0.12}
                    stroke={sec.color} strokeWidth={isSel ? 2 : 1} strokeOpacity={isSel ? 1 : 0.5}
                    style={{ cursor: drag?.kind === 'move' && drag.id === sec.id ? 'grabbing' : 'grab' }}
                    onMouseDown={e => onSectionMouseDown(e, sec.id)}
                  />
                  <g transform={`translate(${sec.x}, ${sec.y})`} style={{ pointerEvents: 'none' }}>
                    <SeatPreview section={sec} />
                  </g>
                  <text
                    x={cx} y={cy}
                    transform={sec.rotation ? `rotate(${-sec.rotation} ${cx} ${cy})` : undefined}
                    textAnchor="middle" dominantBaseline="central"
                    fill="#fff" fontSize={11} fontWeight={700}
                    style={{ pointerEvents: 'none', userSelect: 'none', paintOrder: 'stroke' }}
                    stroke="rgba(0,0,0,0.5)" strokeWidth={3} opacity={0.95}
                  >
                    {sec.label}
                  </text>
                  {isSel && (
                    <>
                      <rect x={sec.x + w - HANDLE / 2} y={sec.y + h / 2 - HANDLE / 2}
                        width={HANDLE} height={HANDLE} rx={2}
                        fill="#fff" stroke={sec.color} strokeWidth={1.5} style={{ cursor: 'ew-resize' }}
                        onMouseDown={e => onResizeHandleMouseDown(e, sec.id, 'r')} />
                      <rect x={sec.x + w / 2 - HANDLE / 2} y={sec.y + h - HANDLE / 2}
                        width={HANDLE} height={HANDLE} rx={2}
                        fill="#fff" stroke={sec.color} strokeWidth={1.5} style={{ cursor: 'ns-resize' }}
                        onMouseDown={e => onResizeHandleMouseDown(e, sec.id, 'b')} />
                      <rect x={sec.x + w - HANDLE / 2} y={sec.y + h - HANDLE / 2}
                        width={HANDLE} height={HANDLE} rx={2}
                        fill="#fff" stroke={sec.color} strokeWidth={1.5} style={{ cursor: 'nwse-resize' }}
                        onMouseDown={e => onResizeHandleMouseDown(e, sec.id, 'br')} />
                    </>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="sd-hint">Kéo khu / sân khấu để di chuyển · Kéo ô trắng để đổi kích thước hoặc góc mở (khu cong) · Esc bỏ chọn · Delete xoá khu</p>
        </div>
      </div>
    </div>
  );
}
