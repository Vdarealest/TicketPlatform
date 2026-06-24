'use client';

import { useEffect, useState, useRef } from 'react';
import api from '../../../lib/api';
import { formatCurrencyVND } from '../../../lib/format';

interface Ticket { id: number; type: string; price: number; quantity: number; }
interface EventItem {
  id: number; title: string; location: string; category: string; bannerUrl: string;
  bannerFocusX: number; bannerFocusY: number;
  startTime: string; endTime: string; description: string; createdAt: string; tickets: Ticket[];
}
interface TicketInput { type: string; price: string; quantity: string; }

const CATEGORIES = ['Âm nhạc', 'Thể thao', 'Sân khấu', 'Hội thảo', 'Triển lãm', 'Ẩm thực', 'Khác'];

const EMPTY_FORM = {
  title: '', description: '', location: '', category: 'Âm nhạc', bannerUrl: '',
  bannerFocusX: 50, bannerFocusY: 50,
  startTime: '', endTime: '',
};

export default function AdminEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [ticketInputs, setTicketInputs] = useState<TicketInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const focusRef = useRef<HTMLDivElement>(null);

  const load = () => {
    api.get('/admin/events').then((r) => setEvents(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => {
    setEditingId(null); setForm(EMPTY_FORM);
    setTicketInputs([{ type: 'Standard', price: '', quantity: '' }]);
    setShowModal(true);
  };

  const openEdit = (ev: EventItem) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title, description: ev.description, location: ev.location,
      category: ev.category || 'Khác',
      bannerUrl: ev.bannerUrl, bannerFocusX: ev.bannerFocusX ?? 50, bannerFocusY: ev.bannerFocusY ?? 50,
      startTime: ev.startTime.slice(0, 16), endTime: ev.endTime.slice(0, 16),
    });
    setTicketInputs([]); setShowModal(true);
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      setForm((f) => ({ ...f, bannerUrl: `${backendUrl}${res.data.url}`, bannerFocusX: 50, bannerFocusY: 50 }));
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
    try {
      if (editingId) {
        await api.put(`/admin/events/${editingId}`, form);
      } else {
        const tickets = ticketInputs.filter((t) => t.type && t.price && t.quantity)
          .map((t) => ({ type: t.type, price: Number(t.price), quantity: Number(t.quantity) }));
        await api.post('/admin/events', { ...form, tickets });
      }
      setShowModal(false); load();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa sự kiện này?')) return;
    try { await api.delete(`/admin/events/${id}`); load(); } catch {}
  };

  const addTicketInput = () => setTicketInputs([...ticketInputs, { type: '', price: '', quantity: '' }]);
  const updateTicketInput = (idx: number, field: keyof TicketInput, val: string) => {
    const copy = [...ticketInputs]; copy[idx] = { ...copy[idx], [field]: val }; setTicketInputs(copy);
  };
  const removeTicketInput = (idx: number) => setTicketInputs(ticketInputs.filter((_, i) => i !== idx));

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
            <thead><tr><th>ID</th><th>Sự kiện</th><th>Địa điểm</th><th>Thể loại</th><th>Diễn ra</th><th>Ngày tạo</th><th>Loại vé</th><th style={{ textAlign: 'right' }}>Thao tác</th></tr></thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ fontWeight: 600 }}>{ev.id}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {ev.bannerUrl && <img src={ev.bannerUrl.startsWith('http') ? ev.bannerUrl : `/img/${ev.bannerUrl}`} alt="" style={{ width: 48, height: 32, borderRadius: 6, objectFit: 'cover', objectPosition: `${ev.bannerFocusX ?? 50}% ${ev.bannerFocusY ?? 50}%` }} />}
                      <span style={{ fontWeight: 600, color: '#111', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{ev.title}</span>
                    </div>
                  </td>
                  <td>{ev.location}</td>
                  <td><span style={{ fontSize: 11, background: '#eef2ff', color: '#0F35FF', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>{ev.category || 'Khác'}</span></td>
                  <td style={{ fontSize: 12, color: '#9ea5ad' }}>{new Date(ev.startTime).toLocaleDateString('vi-VN')}</td>
                  <td style={{ fontSize: 12, color: '#9ea5ad' }}>{ev.createdAt ? new Date(ev.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                  <td>{ev.tickets?.map((t) => (
                    <span key={t.id} style={{ display: 'inline-block', fontSize: 11, background: '#f0f2f5', borderRadius: 6, padding: '2px 8px', marginRight: 4, marginBottom: 2, fontWeight: 500 }}>{t.type}: {formatCurrencyVND(t.price)}</span>
                  ))}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
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
              <label className="admin-form-label">Thể loại</label>
              <select className="admin-form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* ── Banner Upload + Focal Point ── */}
            <div className="admin-form-group">
              <label className="admin-form-label">Hình ảnh banner</label>

              {form.bannerUrl ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Focal point picker */}
                  <div
                    ref={focusRef}
                    onClick={handleFocusClick}
                    style={{
                      position: 'relative', borderRadius: 12, overflow: 'hidden',
                      border: '1px solid #e5e7ea', cursor: 'crosshair', userSelect: 'none',
                    }}
                  >
                    <img src={form.bannerUrl} alt="Banner" style={{ width: '100%', display: 'block' }} />
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
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event Card (16:10)</div>
                      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7ea', aspectRatio: '16/10' }}>
                        <img src={form.bannerUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${form.bannerFocusX}% ${form.bannerFocusY}%`, display: 'block' }} />
                      </div>
                    </div>
                    <div style={{ flex: 1.2 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Banner Detail (21:9)</div>
                      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7ea', aspectRatio: '21/9' }}>
                        <img src={form.bannerUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${form.bannerFocusX}% ${form.bannerFocusY}%`, display: 'block' }} />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <label style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '7px 12px', borderRadius: 8, border: '1px solid #e5e7ea',
                      fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer', background: '#fff',
                    }}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16" /><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
                      Đổi ảnh
                      <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                    </label>
                    <button type="button" onClick={() => setForm({ ...form, bannerUrl: '', bannerFocusX: 50, bannerFocusY: 50 })} style={{
                      padding: '7px 16px', borderRadius: 8, border: '1px solid #fecaca',
                      fontSize: 12, fontWeight: 600, color: '#ef4444', background: '#fff', cursor: 'pointer',
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
                    <><div className="edp-spinner" /><span style={{ fontSize: 13, color: '#9ca3af' }}>Đang tải lên...</span></>
                  ) : (
                    <>
                      <svg width="32" height="32" fill="none" stroke={dragOver ? '#e02020' : '#c4c9d0'} strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14" />
                        <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" />
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 600, color: dragOver ? '#e02020' : '#6b7280' }}>Kéo thả ảnh vào đây hoặc nhấn để chọn</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>JPG, PNG, WebP — tối đa 5MB</span>
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

            {!editingId && (
              <div className="admin-form-group">
                <label className="admin-form-label">Loại vé</label>
                <div className="admin-ticket-list">
                  {ticketInputs.map((t, i) => (
                    <div className="admin-ticket-row" key={i}>
                      <input className="admin-form-input" value={t.type} onChange={(e) => updateTicketInput(i, 'type', e.target.value)} placeholder="Loại (VD: VIP)" style={{ flex: 1 }} />
                      <input className="admin-form-input" type="number" value={t.price} onChange={(e) => updateTicketInput(i, 'price', e.target.value)} placeholder="Giá" style={{ width: 110 }} />
                      <input className="admin-form-input" type="number" value={t.quantity} onChange={(e) => updateTicketInput(i, 'quantity', e.target.value)} placeholder="SL" style={{ width: 70 }} />
                      <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => removeTicketInput(i)} type="button">×</button>
                    </div>
                  ))}
                </div>
                <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={addTicketInput} type="button" style={{ marginTop: 8 }}>+ Thêm loại vé</button>
              </div>
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
