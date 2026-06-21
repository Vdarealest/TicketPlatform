'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { formatCurrencyVND } from '../../../lib/format';

interface OrderItem {
  id: number;
  status: string;
  createdAt: string;
  expiresAt: string;
  user: { id: number; email: string } | null;
  ticket: {
    id: number;
    type: string;
    price: number;
    event: { id: number; title: string } | null;
  } | null;
  seat: { id: number; label: string } | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'HOLD', label: 'Đang giữ' },
  { value: 'CONFIRMED', label: 'Đã thanh toán' },
  { value: 'EXPIRED', label: 'Hết hạn' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const STATUS_LABEL: Record<string, string> = {
  HOLD: 'Đang giữ',
  CONFIRMED: 'Đã thanh toán',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã hủy',
};

const STATUS_CLASS: Record<string, string> = {
  HOLD: 'admin-badge--hold',
  CONFIRMED: 'admin-badge--confirmed',
  EXPIRED: 'admin-badge--expired',
  CANCELLED: 'admin-badge--cancelled',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = (status?: string) => {
    setLoading(true);
    const params = status ? `?status=${status}` : '';
    api
      .get(`/admin/orders${params}`)
      .then((res) => setOrders(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const handleFilter = (status: string) => {
    setFilter(status);
    load(status || undefined);
  };

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Quản lý đơn hàng</h1>
        <span style={{ fontSize: 13, color: '#9ea5ad' }}>
          Tổng: {orders.length} đơn
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`admin-btn admin-btn--sm ${filter === opt.value ? 'admin-btn--primary' : 'admin-btn--ghost'}`}
            onClick={() => handleFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="admin-loading">
          <div className="edp-spinner" />
        </div>
      ) : orders.length === 0 ? (
        <div className="admin-empty">Không có đơn hàng nào.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Email</th>
                <th>Sự kiện</th>
                <th>Loại vé</th>
                <th>Ghế</th>
                <th>Giá</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 600 }}>{o.id}</td>
                  <td>{o.user?.email || '—'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.ticket?.event?.title || '—'}
                  </td>
                  <td>{o.ticket?.type || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {o.seat?.label || '—'}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {o.ticket ? formatCurrencyVND(o.ticket.price) : '—'}
                  </td>
                  <td>
                    <span className={`admin-badge ${STATUS_CLASS[o.status] || ''}`}>
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                  </td>
                  <td style={{ color: '#9ea5ad', fontSize: 12 }}>
                    {new Date(o.createdAt).toLocaleString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
