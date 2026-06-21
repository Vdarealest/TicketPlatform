'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { formatCurrencyVND } from '../../../lib/format';

interface UserItem {
  id: number;
  email: string;
  phone: string | null;
  role: string;
  googleId: boolean;
  createdAt: string;
  completedOrders: number;
}

interface UserDetailData {
  id: number;
  email: string;
  phone: string | null;
  role: string;
  googleId: boolean;
  createdAt: string;
  reservations: {
    id: number;
    status: string;
    createdAt: string;
    eventTitle: string;
    ticketType: string;
    price: number;
    seatLabel: string | null;
  }[];
}

const STATUS_LABEL: Record<string, string> = { HOLD: 'Đang giữ', CONFIRMED: 'Đã thanh toán', EXPIRED: 'Hết hạn', CANCELLED: 'Đã hủy' };
const STATUS_DOT: Record<string, string> = { HOLD: '#f59e0b', CONFIRMED: '#10b981', EXPIRED: '#a1a1aa', CANCELLED: '#ef4444' };

const EMPTY_ADMIN = { email: '', password: '', phone: '', role: 'ADMIN' };

export default function AdminUsers() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState(EMPTY_ADMIN);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Password confirm modal
  const [confirmAction, setConfirmAction] = useState<null | { type: 'delete' | 'save'; userId?: number }>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Detail modal
  const [detailUser, setDetailUser] = useState<UserDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = (userId: number) => {
    setDetailLoading(true);
    setDetailUser(null);
    api.get(`/admin/users/${userId}`).then((r) => setDetailUser(r.data)).catch(() => {}).finally(() => setDetailLoading(false));
  };

  const load = () => {
    api.get('/admin/users').then((r) => setUsers(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_ADMIN);
    setError('');
    setShowForm(true);
  };

  const openEdit = (u: UserItem) => {
    setEditingUser(u);
    setForm({ email: u.email, password: '', phone: u.phone || '', role: u.role });
    setError('');
    setShowForm(true);
  };

  const needsAdminPassword = () => {
    if (!editingUser) return true;
    const isAdmin = editingUser.role === 'ADMIN';
    const changingToAdmin = form.role === 'ADMIN' && editingUser.role !== 'ADMIN';
    const changingFromAdmin = form.role !== 'ADMIN' && editingUser.role === 'ADMIN';
    return isAdmin || changingToAdmin || changingFromAdmin;
  };

  const handleSave = async (password?: string) => {
    setError('');
    setSaving(true);
    try {
      if (editingUser) {
        const body: any = {};
        if (form.email !== editingUser.email) body.email = form.email;
        if (form.phone !== (editingUser.phone || '')) body.phone = form.phone;
        if (form.role !== editingUser.role) body.role = form.role;
        if (form.password) body.password = form.password;
        if (password) body.adminPassword = password;
        await api.put(`/admin/users/${editingUser.id}`, body);
      } else {
        if (!form.email || !form.password) { setError('Email và mật khẩu là bắt buộc.'); setSaving(false); return; }
        await api.post('/admin/users', {
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          role: 'ADMIN',
          adminPassword: password,
        });
      }
      setShowForm(false);
      setConfirmAction(null);
      load();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Có lỗi xảy ra.';
      if (confirmAction) setConfirmError(msg);
      else setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => {
    if (needsAdminPassword()) {
      setConfirmAction({ type: 'save' });
      setAdminPassword('');
      setConfirmError('');
    } else {
      handleSave();
    }
  };

  const handleDeleteClick = (u: UserItem) => {
    setConfirmAction({ type: 'delete', userId: u.id });
    setAdminPassword('');
    setConfirmError('');
  };

  const handleConfirm = async () => {
    if (!adminPassword) { setConfirmError('Vui lòng nhập mật khẩu.'); return; }
    setConfirming(true);
    setConfirmError('');
    try {
      if (confirmAction?.type === 'delete') {
        await api.delete(`/admin/users/${confirmAction.userId}`, { data: { adminPassword } });
        setConfirmAction(null);
        load();
      } else if (confirmAction?.type === 'save') {
        await handleSave(adminPassword);
      }
    } catch (e: any) {
      setConfirmError(e.response?.data?.message || 'Có lỗi xảy ra.');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return <div className="admin-loading"><div className="edp-spinner" /></div>;

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Quản lý người dùng</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>Tổng: {users.length}</span>
          <button className="admin-btn admin-btn--primary" onClick={openCreate}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            Thêm Admin
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="admin-empty">Chưa có người dùng nào.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>SĐT</th>
                <th>Đăng nhập</th>
                <th>Role</th>
                <th>Ngày tạo</th>
                <th>Giao dịch</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.id}</td>
                  <td style={{ fontWeight: 500 }}>{u.email}</td>
                  <td style={{ color: u.phone ? '#454c52' : '#c4c9d0' }}>{u.phone || '—'}</td>
                  <td>
                    {u.googleId ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#3367d6', fontWeight: 500 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Google
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#9ea5ad' }}>Email</span>
                    )}
                  </td>
                  <td>
                    <span className={`admin-badge ${u.role === 'ADMIN' ? 'admin-badge--admin' : 'admin-badge--user'}`}>{u.role}</span>
                  </td>
                  <td style={{ fontSize: 12, color: '#9ea5ad' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                  <td>
                    <span style={{ fontSize: 13, fontWeight: 600, color: u.completedOrders > 0 ? '#10b981' : '#c4c9d0' }}>
                      {u.completedOrders}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => openDetail(u.id)}>Chi tiết</button>
                      <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => openEdit(u)}>Sửa</button>
                      <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => handleDeleteClick(u)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Form Modal: Thêm / Sửa ── */}
      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h2 className="admin-modal__title">{editingUser ? 'Chỉnh sửa người dùng' : 'Thêm Admin mới'}</h2>
              <button className="admin-modal__close" onClick={() => setShowForm(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff5f5', border: '1px solid #fecaca', color: '#e02020', fontSize: 13, fontWeight: 500, padding: '10px 14px', borderRadius: 10, marginBottom: 16 }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                {error}
              </div>
            )}

            <div className="admin-form-group">
              <label className="admin-form-label">Email *</label>
              <input className="admin-form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@email.com" />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">{editingUser ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu *'}</label>
              <input className="admin-form-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingUser ? 'Nhập mật khẩu mới...' : 'Tối thiểu 6 ký tự'} />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Số điện thoại</label>
              <input className="admin-form-input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0901234567" />
            </div>

            {editingUser && (
              <div className="admin-form-group">
                <label className="admin-form-label">Vai trò</label>
                <select
                  className="admin-form-input"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            )}

            {needsAdminPassword() && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fffbeb', border: '1px solid #fde68a', padding: '10px 14px', borderRadius: 10, marginBottom: 4, fontSize: 12, color: '#92400e' }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
                Thao tác này yêu cầu xác nhận mật khẩu admin
              </div>
            )}

            <div className="admin-form-actions">
              <button className="admin-btn admin-btn--ghost" onClick={() => setShowForm(false)}>Hủy</button>
              <button className="admin-btn admin-btn--primary" onClick={handleSaveClick} disabled={saving}>
                {saving ? 'Đang lưu...' : editingUser ? 'Cập nhật' : 'Tạo Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── User Detail Modal ── */}
      {(detailUser || detailLoading) && (
        <div className="admin-modal-overlay" onClick={() => { setDetailUser(null); setDetailLoading(false); }}>
          <div className="admin-modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 10, color: '#9ca3af' }}>
                <div className="edp-spinner" /><span>Đang tải...</span>
              </div>
            ) : detailUser && (
              <>
                <div className="admin-modal__header">
                  <h2 className="admin-modal__title">Chi tiết người dùng</h2>
                  <button className="admin-modal__close" onClick={() => setDetailUser(null)}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* User info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: '16px 18px', background: '#f9fafb', borderRadius: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: detailUser.role === 'ADMIN' ? '#e02020' : '#3b82f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, color: '#fff',
                  }}>
                    {detailUser.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{detailUser.email}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: '#9ca3af' }}>
                      <span>SĐT: {detailUser.phone || '—'}</span>
                      <span>Đăng ký: {new Date(detailUser.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                  <span className={`admin-badge ${detailUser.role === 'ADMIN' ? 'admin-badge--admin' : 'admin-badge--user'}`}>{detailUser.role}</span>
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Tổng giao dịch', value: detailUser.reservations.length, color: '#3b82f6' },
                    { label: 'Đã thanh toán', value: detailUser.reservations.filter(r => r.status === 'CONFIRMED').length, color: '#10b981' },
                    { label: 'Tổng chi tiêu', value: formatCurrencyVND(detailUser.reservations.filter(r => r.status === 'CONFIRMED').reduce((s, r) => s + (r.price || 0), 0)), color: '#e02020' },
                  ].map((s) => (
                    <div key={s.label} style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Reservation list */}
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 10 }}>
                  Lịch sử giao dịch ({detailUser.reservations.length})
                </div>

                {detailUser.reservations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#c4c9d0', fontSize: 13 }}>Chưa có giao dịch nào.</div>
                ) : (
                  <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #f0f2f5', borderRadius: 12 }}>
                    {detailUser.reservations.map((r, i) => (
                      <div key={r.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px',
                        borderBottom: i < detailUser.reservations.length - 1 ? '1px solid #f4f4f5' : 'none',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.eventTitle || '—'}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                            {r.ticketType}{r.seatLabel ? ` — Ghế ${r.seatLabel}` : ''} — {new Date(r.createdAt).toLocaleString('vi-VN')}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{formatCurrencyVND(r.price)}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[r.status] || '#9ca3af' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_DOT[r.status] || '#9ca3af' }}>{STATUS_LABEL[r.status] || r.status}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Password Confirm Modal ── */}
      {confirmAction && (
        <div className="admin-modal-overlay" style={{ zIndex: 1200 }} onClick={() => setConfirmAction(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'admin-modal-up 0.2s ease',
          }}>
            {/* Icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: confirmAction.type === 'delete' ? '#fef2f2' : '#fffbeb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {confirmAction.type === 'delete' ? (
                  <svg width="24" height="24" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                ) : (
                  <svg width="24" height="24" fill="none" stroke="#f59e0b" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
              </div>
            </div>

            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111', textAlign: 'center', margin: '0 0 6px' }}>
              {confirmAction.type === 'delete' ? 'Xác nhận xóa người dùng' : 'Xác nhận mật khẩu admin'}
            </h3>
            <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 20 }}>
              {confirmAction.type === 'delete'
                ? 'Hành động này không thể hoàn tác. Nhập mật khẩu admin để xác nhận.'
                : 'Nhập mật khẩu tài khoản admin hiện tại để tiếp tục.'
              }
            </p>

            {confirmError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff5f5', border: '1px solid #fecaca', color: '#e02020', fontSize: 13, fontWeight: 500, padding: '10px 14px', borderRadius: 10, marginBottom: 12 }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                {confirmError}
              </div>
            )}

            <div className="admin-form-group" style={{ marginBottom: 20 }}>
              <label className="admin-form-label">Mật khẩu admin</label>
              <input
                className="admin-form-input"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Nhập mật khẩu của bạn..."
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmAction(null)}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: '1px solid #e5e7ea', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
                  background: confirmAction.type === 'delete' ? '#ef4444' : '#18181b',
                  fontSize: 13, fontWeight: 600, color: '#fff',
                  cursor: confirming ? 'not-allowed' : 'pointer',
                  opacity: confirming ? 0.7 : 1,
                }}
              >
                {confirming ? 'Đang xử lý...' : confirmAction.type === 'delete' ? 'Xóa' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
