'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  startLabel: string;
  type?: 'rect';
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

function getWH(sec: DesignerSection) {
  return {
    w: sec.w ?? sec.seatsPerRow * CELL,
    h: sec.h ?? sec.rows * CELL,
  };
}

function SeatPreview({ section }: { section: DesignerSection }) {
  const { w, h } = getWH(section);
  const cellW = w / section.seatsPerRow;
  const cellH = h / section.rows;
  const dir = section.curveDir ?? 'down';
  const halfAngle = (section.curve / 100) * (Math.PI * 0.48);

  const seats: { cx: number; cy: number }[] = [];
  for (let r = 0; r < section.rows; r++) {
    const baseCy = cellH * r + cellH / 2;
    for (let c = 0; c < section.seatsPerRow; c++) {
      const baseCx = cellW * c + cellW / 2;
      let cx = baseCx;
      let cy = baseCy;
      if (halfAngle > 0.001) {
        if (dir === 'down' || dir === 'up') {
          if (section.seatsPerRow > 1) {
            const t = (c / (section.seatsPerRow - 1)) * 2 - 1;
            const angle = t * halfAngle;
            const arcR = (w / 2) / Math.sin(halfAngle);
            cx = w / 2 + arcR * Math.sin(angle);
            const bow = arcR * (1 - Math.cos(angle));
            cy = dir === 'down' ? baseCy + bow : baseCy - bow;
          }
        } else {
          if (section.rows > 1) {
            const t = (r / (section.rows - 1)) * 2 - 1;
            const angle = t * halfAngle;
            const arcR = (h / 2) / Math.sin(halfAngle);
            cy = h / 2 + arcR * Math.sin(angle);
            const bow = arcR * (1 - Math.cos(angle));
            cx = dir === 'right' ? baseCx + bow : baseCx - bow;
          }
        }
      }
      seats.push({ cx, cy });
    }
  }

  const dotR = Math.min(cellW, cellH) * 0.38;
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
  | { kind: 'stage-resize'; startX: number; startY: number; origW: number; origH: number };

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

  const duplicateSection = () => {
    if (!selectedSection) return;
    const copy: DesignerSection = {
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
    } catch (err: any) {
      flash(err?.response?.data?.message || 'Thao tác thất bại.');
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
          <p className="sd-hint">Kéo khu / sân khấu để di chuyển · Kéo ô trắng để đổi kích thước · Esc bỏ chọn · Delete xoá khu</p>
        </div>
      </div>
    </div>
  );
}
