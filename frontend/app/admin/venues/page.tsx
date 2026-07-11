'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Venue } from '@/lib/types';

const EMPTY_FORM = { name: '', address: '', capacity: '' };

export default function AdminVenues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/admin/venues')
      .then((r) => setVenues(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (v: Venue) => {
    setEditingId(v.id);
    setForm({ name: v.name, address: v.address || '', capacity: v.capacity ? String(v.capacity) : '' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      };
      if (editingId) {
        await api.put(`/admin/venues/${editingId}`, body);
      } else {
        await api.post('/admin/venues', body);
      }
      setShowModal(false);
      load();
    } catch {}
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa địa điểm này? Các sự kiện liên kết sẽ bị bỏ liên kết.')) return;
    try { await api.delete(`/admin/venues/${id}`); load(); } catch {}
  };

  if (loading) return <div className="admin-loading"><div className="edp-spinner" /></div>;

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Quản lý địa điểm</h1>
        <button className="admin-btn admin-btn--primary" onClick={openCreate}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          Thêm địa điểm
        </button>
      </div>

      {venues.length === 0 ? (
        <div className="admin-empty">Chưa có địa điểm nào. Thêm địa điểm để tạo sơ đồ ghế tái sử dụng.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên địa điểm</th>
                <th>Địa chỉ</th>
                <th>Sức chứa</th>
                <th>Sơ đồ ghế</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.id}</td>
                  <td style={{ fontWeight: 600 }}>{v.name}</td>
                  <td style={{ color: '#6b7280', fontSize: 13 }}>{v.address || '—'}</td>
                  <td>{v.capacity ? v.capacity.toLocaleString() + ' chỗ' : '—'}</td>
                  <td>
                    {v.layout?.sections?.length ? (
                      <span style={{ fontSize: 12, background: '#d1fae5', color: '#065f46', borderRadius: 6, padding: '2px 10px', fontWeight: 600 }}>
                        {v.layout.sections.length} khu · {v.layout.sections.reduce((s: number, sec: any) => s + sec.rows * sec.seatsPerRow, 0)} ghế
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Chưa có sơ đồ</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Link href={`/admin/venues/${v.id}/layout`} className="admin-btn admin-btn--ghost admin-btn--sm" style={{ textDecoration: 'none' }}>
                        Sơ đồ ghế
                      </Link>
                      <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => openEdit(v)}>Sửa</button>
                      <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => handleDelete(v.id)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="admin-modal__header">
              <h2 className="admin-modal__title">{editingId ? 'Chỉnh sửa địa điểm' : 'Thêm địa điểm mới'}</h2>
              <button className="admin-modal__close" onClick={() => setShowModal(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Tên địa điểm *</label>
              <input className="admin-form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Nhà hát Hòa Bình" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Địa chỉ</label>
              <input className="admin-form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="VD: 240 Điện Biên Phủ, Q3, TP.HCM" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Sức chứa</label>
              <input className="admin-form-input" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="VD: 2000" />
            </div>

            <div className="admin-form-actions">
              <button className="admin-btn admin-btn--ghost" onClick={() => setShowModal(false)}>Hủy</button>
              <button className="admin-btn admin-btn--primary" onClick={handleSubmit} disabled={saving || !form.name.trim()}>
                {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Tạo địa điểm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
