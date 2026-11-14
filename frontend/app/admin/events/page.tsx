'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import api, { apiErrorMessage } from '../../../lib/api';
import { formatCurrencyVND } from '../../../lib/format';
import { resolveImageUrl } from '../../../lib/image';

interface Ticket { id: number; type: string; price: number; quantity: number; seating?: 'SEATED' | 'GENERAL'; }
interface EventItem {
  id: number; title: string; location: string; category: string; bannerUrl: string;
  bannerFocusX: number; bannerFocusY: number;
  startTime: string; endTime: string; description: string; createdAt: string;
  tickets: Ticket[]; venueId?: number; venue?: { id: number; name: string };
  featured?: boolean; featuredOrder?: number;
  status?: 'DRAFT' | 'UPCOMING' | 'ON_SALE'; saleOpenAt?: string | null;
}
interface VenueOption { id: number; name: string; }
interface TicketInput { type: string; price: string; quantity: string; seating: 'SEATED' | 'GENERAL'; }
// An already-saved tier, held as strings so it can be typed into directly.
// seating is read-only here — switching a tier between SEATED and GENERAL
// after seats (or GA holds) already exist would orphan data, so it's fixed
// at creation and just displayed, not editable.
interface ExistingTicketInput { id: number; type: string; price: string; quantity: string; seating?: 'SEATED' | 'GENERAL'; }

const CATEGORIES = ['Âm nhạc', 'Thể thao', 'Sân khấu', 'Hội thảo', 'Triển lãm', 'Ẩm thực', 'Khác'];

const EMPTY_FORM = {
  title: '', description: '', location: '', category: 'Âm nhạc', bannerUrl: '',
  bannerFocusX: 50, bannerFocusY: 50,
  startTime: '', endTime: '',
  venueId: '' as string,
  featured: false,
  featuredOrder: 0,
  status: 'ON_SALE' as 'DRAFT' | 'UPCOMING' | 'ON_SALE',
  saleOpenAt: '' as string,
};

// <input type="datetime-local"> has no timezone: it reads and writes a bare
// wall-clock string. Converting explicitly at both ends keeps the stored
// instant from depending on whichever timezone the server happens to run in —
// a naive "2026-09-27T19:00" means 12:00Z on a +7 box but 19:00Z on a UTC one.
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Stored UTC instant → the admin's local wall clock, for the input. */
function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    + `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** The admin's local wall clock → an absolute instant the API can't misread. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value); // browsers parse a zone-less value as local time
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function AdminEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [ticketInputs, setTicketInputs] = useState<TicketInput[]>([]);
  const [existingTickets, setExistingTickets] = useState<ExistingTicketInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const focusRef = useRef<HTMLDivElement>(null);
  // Values as loaded, so only the tiers actually changed get sent on save.
  const originalTickets = useRef<Record<number, Ticket>>({});

  const load = () => {
    Promise.all([
      api.get('/admin/events'),
      api.get('/admin/venues'),
    ]).then(([evRes, vRes]) => {
      setEvents(evRes.data);
      setVenues(vRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => {
    setEditingId(null); setForm(EMPTY_FORM); setFormError(null);
    setTicketInputs([{ type: 'Standard', price: '', quantity: '', seating: 'SEATED' }]);
    setExistingTickets([]);
    originalTickets.current = {};
    setShowModal(true);
  };

  const openEdit = (ev: EventItem) => {
    setEditingId(ev.id); setFormError(null);
    setForm({
      title: ev.title, description: ev.description, location: ev.location,
      category: ev.category || 'Khác',
      bannerUrl: ev.bannerUrl, bannerFocusX: ev.bannerFocusX ?? 50, bannerFocusY: ev.bannerFocusY ?? 50,
      startTime: toLocalInput(ev.startTime), endTime: toLocalInput(ev.endTime),
      venueId: ev.venueId ? String(ev.venueId) : '',
      featured: ev.featured ?? false,
      featuredOrder: ev.featuredOrder ?? 0,
      status: ev.status ?? 'ON_SALE',
      saleOpenAt: toLocalInput(ev.saleOpenAt),
    });
    setTicketInputs([]);
    const saved = ev.tickets || [];
    setExistingTickets(saved.map((t) => ({
      id: t.id, type: t.type, price: String(t.price), quantity: String(t.quantity), seating: t.seating,
    })));
    originalTickets.current = Object.fromEntries(saved.map((t) => [t.id, t]));
    setShowModal(true);
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      // Store the relative path ("/uploads/…"); the domain is added at render time.
      setForm((f) => ({ ...f, bannerUrl: res.data.url, bannerFocusX: 50, bannerFocusY: 50 }));
    } catch {}
    setUploading(false);
  };

  const handleFocusClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setForm((f) => ({ ...f, bannerFocusX: Math.max(0, Math.min(100, x)), bannerFocusY: Math.max(0, Math.min(100, y)) }));
  };

  const handleSubmit = async () => {
    if (!form.title || !form.location || !form.startTime || !form.endTime) return;
    setSaving(true);
    setFormError(null);
    try {
      const venueId = form.venueId ? Number(form.venueId) : null;
      const newTickets = ticketInputs.filter((t) => t.type && t.price && t.quantity)
        .map((t) => ({ type: t.type, price: Number(t.price), quantity: Number(t.quantity), seating: t.seating }));

      // Send absolute instants, never the bare wall-clock the inputs hold
      const payload = {
        ...form,
        venueId,
        startTime: fromLocalInput(form.startTime),
        endTime: fromLocalInput(form.endTime),
        saleOpenAt: fromLocalInput(form.saleOpenAt),
      };

      if (editingId) {
        await api.put(`/admin/events/${editingId}`, payload);

        // Only send tiers whose values actually changed
        for (const t of existingTickets) {
          const before = originalTickets.current[t.id];
          if (!before) continue;
          const patch: Record<string, string | number> = {};
          if (t.type !== before.type) patch.type = t.type;
          if (Number(t.price) !== before.price) patch.price = Number(t.price);
          if (Number(t.quantity) !== before.quantity) patch.quantity = Number(t.quantity);
          if (Object.keys(patch).length) {
            await api.put(`/admin/tickets/${t.id}`, patch);
          }
        }

        for (const t of newTickets) {
          await api.post(`/admin/events/${editingId}/tickets`, t);
        }
      } else {
        await api.post('/admin/events', { ...payload, tickets: newTickets });
      }
      setShowModal(false); load();
    } catch (err) {
      // Surfaced because the ticket rules can legitimately reject a save
      // (e.g. reducing a tier below the number of seats already sold).
      setFormError(apiErrorMessage(err, 'Không lưu được. Vui lòng thử lại.'));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa sự kiện này?')) return;
    try { await api.delete(`/admin/events/${id}`); load(); } catch {}
  };

  // Quick on/off for the homepage hero carousel — optimistic update then persist.
  const toggleFeatured = async (ev: EventItem) => {
    const next = !ev.featured;
    setEvents((list) => list.map((e) => e.id === ev.id ? { ...e, featured: next } : e));
    try {
      await api.put(`/admin/events/${ev.id}`, { featured: next });
    } catch {
      setEvents((list) => list.map((e) => e.id === ev.id ? { ...e, featured: !next } : e));
    }
  };

  const addTicketInput = () => setTicketInputs([...ticketInputs, { type: '', price: '', quantity: '', seating: 'SEATED' }]);
  const updateTicketInput = (idx: number, field: keyof TicketInput, val: string) => {
    const copy = [...ticketInputs]; copy[idx] = { ...copy[idx], [field]: val }; setTicketInputs(copy);
  };
  const removeTicketInput = (idx: number) => setTicketInputs(ticketInputs.filter((_, i) => i !== idx));

  const updateExistingTicket = (id: number, field: 'type' | 'price' | 'quantity', val: string) =>
    setExistingTickets((list) => list.map((t) => (t.id === id ? { ...t, [field]: val } : t)));

  if (loading) return <div className="admin-loading"><div className="edp-spinner" /></div>;

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Quản lý sự kiện</h1>
        <button className="admin-btn admin-btn--primary" onClick={openCreate}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          Tạo sự kiện
        </button>
      </div>

      {events.length === 0 ? (
        <div className="admin-empty">Chưa có sự kiện nào.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th style={{ textAlign: 'center' }} title="Hiển thị trên banner trang chủ">Banner</th><th>ID</th><th>Sự kiện</th><th>Địa điểm</th><th>Thể loại</th><th>Diễn ra</th><th>Ngày tạo</th><th>Loại vé</th><th style={{ textAlign: 'right' }}>Thao tác</th></tr></thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => toggleFeatured(ev)}
                      title={ev.featured ? 'Đang hiển thị trên banner — bấm để tắt' : 'Bấm để đưa lên banner trang chủ'}
                      className="adm-star"
                      style={{ color: ev.featured ? '#f59e0b' : '#cbd0d6' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill={ev.featured ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
                        <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9L12 2.5z" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </td>
                  <td style={{ fontWeight: 600 }}>{ev.id}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {ev.bannerUrl && <img src={resolveImageUrl(ev.bannerUrl)} alt="" style={{ width: 48, height: 32, borderRadius: 6, objectFit: 'cover', objectPosition: `${ev.bannerFocusX ?? 50}% ${ev.bannerFocusY ?? 50}%` }} />}
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{ev.title}</span>
                        {ev.status === 'DRAFT' && <span className="adm-status adm-status--draft">Nháp</span>}
                        {ev.status === 'UPCOMING' && <span className="adm-status adm-status--upcoming">Sắp mở bán</span>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{ev.location}</div>
                    {ev.venue && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{ev.venue.name}</span>}
                  </td>
                  <td><span style={{ fontSize: 11, background: 'rgba(224, 32, 32, 0.08)', color: '#e02020', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>{ev.category || 'Khác'}</span></td>
                  <td style={{ fontSize: 12, color: '#9ea5ad' }}>{new Date(ev.startTime).toLocaleDateString('vi-VN')}</td>
                  <td style={{ fontSize: 12, color: '#9ea5ad' }}>{ev.createdAt ? new Date(ev.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                  <td>{ev.tickets?.map((t) => (
                    <span key={t.id} style={{ display: 'inline-block', fontSize: 11, background: 'var(--surface-tertiary)', borderRadius: 6, padding: '2px 8px', marginRight: 4, marginBottom: 2, fontWeight: 500 }}>{t.type}: {formatCurrencyVND(t.price)}</span>
                  ))}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Link href={`/admin/events/${ev.id}/seats`} className="admin-btn admin-btn--ghost admin-btn--sm" style={{ textDecoration: 'none' }}>Seats</Link>
                      <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => openEdit(ev)}>Sửa</button>
                      <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => handleDelete(ev.id)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Event Form Modal ── */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h2 className="admin-modal__title">{editingId ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'}</h2>
              <button className="admin-modal__close" onClick={() => setShowModal(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Tên sự kiện *</label>
              <input className="admin-form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nhập tên sự kiện" />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Mô tả</label>
              <textarea className="admin-form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả sự kiện" />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Địa điểm *</label>
              <input className="admin-form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Nhập địa điểm" />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Venue (sơ đồ ghế)</label>
              <select className="admin-form-input" value={form.venueId} onChange={(e) => setForm({ ...form, venueId: e.target.value })}>
                <option value="">— Không chọn —</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              {form.venueId && (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Sơ đồ ghế của venue này sẽ được dùng để tạo ghế cho sự kiện.
                </p>
              )}
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Thể loại</label>
              <select className="admin-form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* ── Sale status ── */}
            <div className="admin-form-group">
              <label className="admin-form-label">Trạng thái mở bán</label>
              <select
                className="admin-form-input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
              >
                <option value="DRAFT">Nháp — ẩn khỏi web</option>
                <option value="UPCOMING">Sắp mở bán — hiện nhưng chưa bán</option>
                <option value="ON_SALE">Đang mở bán</option>
              </select>
              {form.status === 'UPCOMING' && (
                <div style={{ marginTop: 8 }}>
                  <label className="admin-form-label">Tự động mở bán lúc (để trống = admin tự bấm)</label>
                  <input
                    className="admin-form-input"
                    type="datetime-local"
                    value={form.saleOpenAt}
                    onChange={(e) => setForm({ ...form, saleOpenAt: e.target.value })}
                  />
                </div>
              )}
            </div>

            {/* ── Featured on homepage hero ── */}
            <div className="admin-form-group">
              <label className="adm-featured-toggle">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                />
                <span>Hiển thị trên banner trang chủ (nổi bật)</span>
              </label>
              {form.featured && (
                <div style={{ marginTop: 8 }}>
                  <label className="admin-form-label">Thứ tự hiển thị (số nhỏ hiện trước)</label>
                  <input
                    className="admin-form-input"
                    type="number"
                    value={form.featuredOrder}
                    onChange={(e) => setForm({ ...form, featuredOrder: Number(e.target.value) })}
                    style={{ width: 140 }}
                  />
                </div>
              )}
            </div>

            {/* ── Banner Upload + Focal Point ── */}
            <div className="admin-form-group">
              <label className="admin-form-label">Hình ảnh banner</label>
              <p style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text-quaternary)', margin: '0 0 8px' }}>
                Khuyến nghị <strong style={{ color: 'var(--text-secondary)' }}>1920 × 760 px</strong> (tỉ lệ ~2,5:1).
                Muốn nét trên màn hình lớn thì dùng 2560 × 1000 px.
                <br />
                Banner hiển thị tràn ngang màn hình nên khung ảnh co giãn theo từng cỡ màn hình —
                hãy để chữ và logo trong vùng giữa, chừa mép khoảng 12% mỗi phía để không bị cắt mất.
              </p>

              {form.bannerUrl ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Focal point picker */}
                  <div
                    ref={focusRef}
                    onClick={handleFocusClick}
                    style={{
                      position: 'relative', borderRadius: 12, overflow: 'hidden',
                      border: '1px solid var(--border-input)', cursor: 'crosshair', userSelect: 'none',
                    }}
                  >
                    <img src={resolveImageUrl(form.bannerUrl)} alt="Banner" style={{ width: '100%', display: 'block' }} />
                    {/* Focus dot */}
                    <div style={{
                      position: 'absolute',
                      left: `${form.bannerFocusX}%`, top: `${form.bannerFocusY}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 24, height: 24, borderRadius: '50%',
                      border: '3px solid #fff',
                      background: 'rgba(224,32,32,0.7)',
                      boxShadow: '0 0 0 2px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.3)',
                      pointerEvents: 'none',
                      transition: 'left 0.15s, top 0.15s',
                    }} />
                    {/* Crosshair lines */}
                    <div style={{ position: 'absolute', left: `${form.bannerFocusX}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: `${form.bannerFocusY}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                    {/* Overlay label */}
                    <div style={{
                      position: 'absolute', bottom: 8, left: 8,
                      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                      borderRadius: 6, padding: '4px 10px',
                      fontSize: 11, fontWeight: 600, color: '#fff',
                    }}>
                      Nhấn vào điểm quan trọng nhất
                    </div>
                  </div>

                  {/* Preview strips */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {/* Thẻ sự kiện dùng object-fit: contain trên nền ảnh mờ — ảnh
                        luôn hiện trọn vẹn, điểm focus không ảnh hưởng ở đây. */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-quaternary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thẻ sự kiện — không cắt</div>
                      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-input)', aspectRatio: '16/10' }}>
                        <img src={resolveImageUrl(form.bannerUrl)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(18px) brightness(0.9)', transform: 'scale(1.15)', display: 'block' }} />
                        <img src={resolveImageUrl(form.bannerUrl)} alt="" style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                      </div>
                    </div>
                    {/* Banner trang chủ + trang chi tiết dùng cùng một khung cover */}
                    <div style={{ flex: 1.2 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-quaternary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Banner lớn (2,5:1) — bị cắt</div>
                      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-input)', aspectRatio: '2.5/1' }}>
                        <img src={resolveImageUrl(form.bannerUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${form.bannerFocusX}% ${form.bannerFocusY}%`, display: 'block' }} />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <label style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-input)',
                      fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', background: 'var(--surface-primary)',
                    }}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16" /><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
                      Đổi ảnh
                      <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                    </label>
                    <button type="button" onClick={() => setForm({ ...form, bannerUrl: '', bannerFocusX: 50, bannerFocusY: 50 })} style={{
                      padding: '7px 16px', borderRadius: 8, border: '1px solid #fecaca',
                      fontSize: 12, fontWeight: 600, color: '#ef4444', background: 'var(--surface-primary)', cursor: 'pointer',
                    }}>Xóa</button>
                  </div>
                </div>
              ) : (
                <label
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8, padding: '32px 20px', borderRadius: 12,
                    border: `2px dashed ${dragOver ? '#e02020' : '#e5e7ea'}`,
                    background: dragOver ? 'rgba(224,32,32,0.03)' : '#fafafa',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                  {uploading ? (
                    <><div className="edp-spinner" /><span style={{ fontSize: 13, color: 'var(--text-quaternary)' }}>Đang tải lên...</span></>
                  ) : (
                    <>
                      <svg width="32" height="32" fill="none" stroke={dragOver ? '#e02020' : '#c4c9d0'} strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14" />
                        <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" />
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 600, color: dragOver ? '#e02020' : '#6b7280' }}>Kéo thả ảnh vào đây hoặc nhấn để chọn</span>
                      <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>JPG, PNG, WebP — tối đa 5MB</span>
                    </>
                  )}
                </label>
              )}
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Bắt đầu *</label>
                <input className="admin-form-input" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Kết thúc *</label>
                <input className="admin-form-input" type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Loại vé</label>
              {existingTickets.length > 0 && (
                <>
                  <div className="admin-ticket-list" style={{ marginBottom: 6 }}>
                    {existingTickets.map((t) => (
                      <div className="admin-ticket-row" key={t.id}>
                        <input
                          className="admin-form-input"
                          value={t.type}
                          onChange={(e) => updateExistingTicket(t.id, 'type', e.target.value)}
                          placeholder="Loại (VD: VIP)"
                          style={{ flex: 1 }}
                        />
                        <input
                          className="admin-form-input"
                          type="number"
                          value={t.price}
                          onChange={(e) => updateExistingTicket(t.id, 'price', e.target.value)}
                          placeholder="Giá"
                          style={{ width: 110 }}
                        />
                        <input
                          className="admin-form-input"
                          type="number"
                          value={t.quantity}
                          onChange={(e) => updateExistingTicket(t.id, 'quantity', e.target.value)}
                          placeholder="SL"
                          style={{ width: 70 }}
                        />
                        {/* Fixed at creation — see the ExistingTicketInput comment for why
                            this isn't editable. */}
                        <span
                          title={t.seating === 'GENERAL' ? 'Vé đứng — không chọn ghế' : 'Có chọn chỗ ngồi'}
                          style={{
                            fontSize: 10.5, fontWeight: 700, padding: '4px 8px', borderRadius: 6,
                            whiteSpace: 'nowrap', flexShrink: 0,
                            background: t.seating === 'GENERAL' ? 'rgba(224,32,32,0.08)' : 'var(--surface-tertiary)',
                            color: t.seating === 'GENERAL' ? '#e02020' : 'var(--text-tertiary)',
                          }}
                        >
                          {t.seating === 'GENERAL' ? 'Đứng' : 'Có chỗ'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text-quaternary)', margin: '0 0 10px' }}>
                    Sửa trực tiếp các hạng vé đã có. Giảm số lượng chỉ bỏ được những ghế còn trống —
                    ghế đang giữ hoặc đã bán luôn được giữ nguyên.
                  </p>
                </>
              )}
              <div className="admin-ticket-list">
                {ticketInputs.map((t, i) => (
                  <div className="admin-ticket-row" key={i}>
                    <input className="admin-form-input" value={t.type} onChange={(e) => updateTicketInput(i, 'type', e.target.value)} placeholder="Loại (VD: VIP)" style={{ flex: 1 }} />
                    <input className="admin-form-input" type="number" value={t.price} onChange={(e) => updateTicketInput(i, 'price', e.target.value)} placeholder="Giá" style={{ width: 110 }} />
                    <input className="admin-form-input" type="number" value={t.quantity} onChange={(e) => updateTicketInput(i, 'quantity', e.target.value)} placeholder="SL" style={{ width: 70 }} />
                    <select
                      className="admin-form-input"
                      value={t.seating}
                      onChange={(e) => updateTicketInput(i, 'seating', e.target.value)}
                      style={{ width: 110, flexShrink: 0 }}
                      title="Vé có chỗ ngồi gắn vào sơ đồ ghế; vé đứng chỉ bán theo số lượng, không chọn chỗ."
                    >
                      <option value="SEATED">Có chỗ ngồi</option>
                      <option value="GENERAL">Vé đứng</option>
                    </select>
                    <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => removeTicketInput(i)} type="button">×</button>
                  </div>
                ))}
              </div>
              <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={addTicketInput} type="button" style={{ marginTop: 8 }}>+ Thêm loại vé</button>
              {editingId !== null && existingTickets.length === 0 && ticketInputs.length === 0 && (
                <p style={{ fontSize: 12, color: '#b45309', marginTop: 6 }}>Sự kiện này chưa có loại vé — thêm ít nhất một loại để gán vào sơ đồ ghế.</p>
              )}
            </div>

            {formError && (
              <p style={{
                margin: '4px 0 0', padding: '10px 12px', borderRadius: 8,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#ef4444', fontSize: 13, fontWeight: 600, lineHeight: 1.5,
              }}>
                {formError}
              </p>
            )}

            <div className="admin-form-actions">
              <button className="admin-btn admin-btn--ghost" onClick={() => setShowModal(false)}>Hủy</button>
              <button className="admin-btn admin-btn--primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Tạo sự kiện'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
