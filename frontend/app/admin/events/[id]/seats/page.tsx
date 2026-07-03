'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';

const CELL = 28;
const ZONE_COLORS = ['#f43f5e', '#f59e0b', '#a855f7', '#3b82f6', '#10b981', '#f97316', '#06b6d4', '#ec4899'];

interface Section {
  id: string;
  ticketId: number | null;
  label: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  rows: number;
  seatsPerRow: number;
  rotation: number;
  curve: number;
  startLabel: string;
  type: 'rect';
  color: string;
}

interface TicketInfo { id: number; type: string; price: number; quantity: number; }

const uid = () => Math.random().toString(36).slice(2, 9);

function getWH(sec: Section) {
  return {
    w: sec.w ?? sec.seatsPerRow * CELL,
    h: sec.h ?? sec.rows * CELL,
  };
}

function SeatPreview({ section }: { section: Section }) {
  const { w, h } = getWH(section);
  const cellW = w / section.seatsPerRow;
  const cellH = h / section.rows;
  const seats: { cx: number; cy: number }[] = [];
  for (let r = 0; r < section.rows; r++) {
    for (let c = 0; c < section.seatsPerRow; c++) {
      const baseCx = cellW * c + cellW / 2;
      const baseCy = cellH * r + cellH / 2;
      const cx = section.curve === 0 ? baseCx : baseCx + Math.sin((c / (section.seatsPerRow - 1 || 1)) * Math.PI - Math.PI / 2) * section.curve * r * 0.18;
      seats.push({ cx, cy: baseCy });
    }
  }
  const r = Math.min(cellW, cellH) * 0.38;
  return (
    <g>
      {seats.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={r} fill={section.color} opacity={0.85} />
      ))}
    </g>
  );
}

function StagePreview({ w }: { w: number }) {
  return (
    <g>
      <rect x={0} y={0} width={w} height={34} rx={6} fill="#555" opacity={0.7} />
      <text x={w / 2} y={22} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600}>SÂN KHẤU</text>
    </g>
  );
}

type DragState =
  | { kind: 'move'; id: string; startX: number; startY: number; origX: number; origY: number }
  | { kind: 'resize'; id: string; edge: 'r' | 'b' | 'br'; startX: number; startY: number; origW: number; origH: number; origX: number; origY: number };

export default function SeatDesignerPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = Number(params.id);
  const svgRef = useRef<SVGSVGElement>(null);

  const [sections, setSections] = useState<Section[]>([]);
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [drag, setDrag] = useState<DragState | null>(null);

  const CANVAS_W = 900;
  const CANVAS_H = 620;
  const STAGE_W = 340;

  useEffect(() => {
    Promise.all([
      api.get(`/admin/events/${eventId}/seat-layout`),
      api.get(`/admin/events/${eventId}`),
    ]).then(([lr, er]) => {
      setTickets(lr.data.tickets || []);
      setEventTitle(er.data.title || '');
      const layout = lr.data.layout;
      if (layout?.sections?.length) setSections(layout.sections);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelected(null); return; }
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

  const updateSection = useCallback((id: string, patch: Partial<Section>) => {
    setSections(p => p.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const getSVGPoint = (e: React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const onSectionMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelected(id);
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
    setDrag({ kind: 'resize', id, edge, startX: p.x, startY: p.y, origW: w, origH: h, origX: sec.x, origY: sec.y });
  };

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag) return;
    const p = getSVGPoint(e);
    if (drag.kind === 'move') {
      const dx = p.x - drag.startX;
      const dy = p.y - drag.startY;
      updateSection(drag.id, {
        x: Math.max(0, Math.min(CANVAS_W - 40, drag.origX + dx)),
        y: Math.max(50, Math.min(CANVAS_H - 40, drag.origY + dy)),
      });
    } else {
      const dx = p.x - drag.startX;
      const dy = p.y - drag.startY;
      const MIN = CELL * 2;
      const patch: Partial<Section> = {};
      if (drag.edge === 'r' || drag.edge === 'br') {
        patch.w = Math.max(MIN, drag.origW + 2 * dx);
      }
      if (drag.edge === 'b' || drag.edge === 'br') {
        patch.h = Math.max(MIN, drag.origH + 2 * dy);
      }
      updateSection(drag.id, patch);
    }
  }, [drag, updateSection]);

  const onMouseUp = useCallback(() => setDrag(null), []);

  const addSection = () => {
    const tix = tickets[0] ?? null;
    const color = ZONE_COLORS[sections.length % ZONE_COLORS.length];
    const newSec: Section = {
      id: uid(),
      ticketId: tix?.id ?? null,
      label: tix?.type ?? `Khu ${sections.length + 1}`,
      x: 80 + (sections.length % 4) * 120,
      y: 100 + Math.floor(sections.length / 4) * 110,
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
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      await api.put(`/admin/events/${eventId}/seat-layout`, { sections });
      setMsg('Đã lưu!');
      setTimeout(() => setMsg(''), 2000);
    } catch {
      setMsg('Lưu thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setMsg('');
    try {
      const res = await api.post(`/admin/events/${eventId}/generate-seats`);
      setMsg(res.data.message ?? 'Đã tạo ghế!');
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Tạo ghế thất bại.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="adm-loading"><div className="edp-spinner" /><span>Đang tải...</span></div>;

  return (
    <div className="sd-root">
      {/* Header */}
      <div className="sd-header">
        <div className="sd-header__left">
          <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => router.back()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Quay lại
          </button>
          <h1 className="sd-title">Sơ đồ ghế — {eventTitle}</h1>
          {msg && <span className="sd-msg">{msg}</span>}
        </div>
        <div className="sd-header__right">
          <span className="sd-seat-count">{sections.reduce((a, s) => a + s.rows * s.seatsPerRow, 0)} ghế</span>
          <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Đang tạo...' : 'Tạo ghế'}
          </button>
          <button className="admin-btn admin-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu sơ đồ'}
          </button>
        </div>
      </div>

      <div className="sd-body">
        {/* Toolbar / Properties */}
        <div className="sd-toolbar">
          <div className="sd-toolbar__title">
            <button className="sd-tool-btn" onClick={addSection}>+ Thêm khu</button>
            {selected && (
              <button className="sd-tool-btn sd-tool-btn--danger" onClick={() => { setSections(p => p.filter(s => s.id !== selected)); setSelected(null); }}>
                Xoá khu
              </button>
            )}
          </div>

          {selectedSection && (
            <div className="sd-props">
              <div className="sd-prop">
                <label>Nhãn</label>
                <input value={selectedSection.label} onChange={e => updateSection(selected!, { label: e.target.value })} />
              </div>
              <div className="sd-prop">
                <label>Loại vé</label>
                <select
                  value={selectedSection.ticketId ?? ''}
                  onChange={e => {
                    const id = Number(e.target.value) || null;
                    const tix = tickets.find(t => t.id === id);
                    updateSection(selected!, { ticketId: id, label: tix?.type ?? selectedSection.label });
                  }}
                >
                  <option value="">— Chưa chọn —</option>
                  {tickets.map(t => <option key={t.id} value={t.id}>{t.type}</option>)}
                </select>
              </div>
              <div className="sd-prop sd-prop--row">
                <div>
                  <label>Hàng</label>
                  <input type="number" min={1} max={30} value={selectedSection.rows}
                    onChange={e => updateSection(selected!, { rows: Math.max(1, Number(e.target.value)) })} />
                </div>
                <div>
                  <label>Ghế/hàng</label>
                  <input type="number" min={1} max={50} value={selectedSection.seatsPerRow}
                    onChange={e => updateSection(selected!, { seatsPerRow: Math.max(1, Number(e.target.value)) })} />
                </div>
              </div>
              <div className="sd-prop">
                <label>Nhãn bắt đầu</label>
                <input value={selectedSection.startLabel} onChange={e => updateSection(selected!, { startLabel: e.target.value })} />
              </div>
              <div className="sd-prop">
                <label>Xoay ({selectedSection.rotation}°)</label>
                <input type="range" min={-45} max={45} value={selectedSection.rotation}
                  onChange={e => updateSection(selected!, { rotation: Number(e.target.value) })} />
              </div>
              <div className="sd-prop">
                <label>Cong ({selectedSection.curve})</label>
                <input type="range" min={0} max={10} value={selectedSection.curve}
                  onChange={e => updateSection(selected!, { curve: Number(e.target.value) })} />
              </div>
              <div className="sd-prop">
                <label>Màu</label>
                <div className="sd-color-row">
                  {ZONE_COLORS.map(c => (
                    <button
                      key={c}
                      className={`sd-color-dot ${selectedSection.color === c ? 'sd-color-dot--active' : ''}`}
                      style={{ background: c }}
                      onClick={() => updateSection(selected!, { color: c })}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {!selectedSection && (
            <p className="sd-prop-info">Nhấn vào khu ghế trên canvas để chỉnh sửa. Nhấn "+ Thêm khu" để tạo mới.</p>
          )}
        </div>

        {/* Canvas */}
        <div className="sd-canvas-wrap">
          <svg
            ref={svgRef}
            className="sd-canvas"
            width={CANVAS_W}
            height={CANVAS_H}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onClick={() => {}}
          >
            {/* Stage */}
            <g transform={`translate(${(CANVAS_W - STAGE_W) / 2}, 12)`}>
              <StagePreview w={STAGE_W} />
            </g>

            {/* Sections */}
            {sections.map(sec => {
              const { w, h } = getWH(sec);
              const cx = sec.x + w / 2;
              const cy = sec.y + h / 2;
              const isSel = selected === sec.id;
              const HANDLE = 8;
              return (
                <g key={sec.id} transform={`rotate(${sec.rotation},${cx},${cy})`}>
                  {/* Background rect */}
                  <rect
                    x={sec.x} y={sec.y} width={w} height={h}
                    rx={4}
                    fill={sec.color}
                    fillOpacity={isSel ? 0.22 : 0.12}
                    stroke={sec.color}
                    strokeWidth={isSel ? 2 : 1}
                    strokeOpacity={isSel ? 1 : 0.5}
                    style={{ cursor: drag?.kind === 'move' && drag.id === sec.id ? 'grabbing' : 'grab' }}
                    onMouseDown={e => onSectionMouseDown(e, sec.id)}
                  />

                  {/* Seat dots */}
                  <g transform={`translate(${sec.x}, ${sec.y})`} style={{ pointerEvents: 'none' }}>
                    <SeatPreview section={sec} />
                  </g>

                  {/* Label */}
                  <text
                    x={sec.x + w / 2} y={sec.y + h / 2}
                    textAnchor="middle" dominantBaseline="central"
                    fill={sec.color} fontSize={11} fontWeight={700}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                    opacity={0.9}
                  >
                    {sec.label}
                  </text>

                  {/* Resize handles (only when selected) */}
                  {isSel && (
                    <>
                      {/* Right edge */}
                      <rect
                        x={sec.x + w - HANDLE / 2} y={sec.y + h / 2 - HANDLE / 2}
                        width={HANDLE} height={HANDLE} rx={2}
                        fill="#fff" stroke={sec.color} strokeWidth={1.5}
                        style={{ cursor: 'ew-resize' }}
                        onMouseDown={e => onResizeHandleMouseDown(e, sec.id, 'r')}
                      />
                      {/* Bottom edge */}
                      <rect
                        x={sec.x + w / 2 - HANDLE / 2} y={sec.y + h - HANDLE / 2}
                        width={HANDLE} height={HANDLE} rx={2}
                        fill="#fff" stroke={sec.color} strokeWidth={1.5}
                        style={{ cursor: 'ns-resize' }}
                        onMouseDown={e => onResizeHandleMouseDown(e, sec.id, 'b')}
                      />
                      {/* Bottom-right corner */}
                      <rect
                        x={sec.x + w - HANDLE / 2} y={sec.y + h - HANDLE / 2}
                        width={HANDLE} height={HANDLE} rx={2}
                        fill="#fff" stroke={sec.color} strokeWidth={1.5}
                        style={{ cursor: 'nwse-resize' }}
                        onMouseDown={e => onResizeHandleMouseDown(e, sec.id, 'br')}
                      />
                    </>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="sd-hint">Kéo để di chuyển · Kéo handle để resize · Esc bỏ chọn · Delete xoá khu</p>
        </div>
      </div>
    </div>
  );
}
