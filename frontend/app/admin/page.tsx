'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import api from '../../lib/api';
import { formatCurrencyVND } from '../../lib/format';

interface DashboardData {
  totalUsers: number;
  totalEvents: number;
  totalReservations: number;
  confirmedReservations: number;
  totalRevenue: number;
  revenueByDay: { date: string; label: string; revenue: number; count: number }[];
  ordersByStatus: { status: string; count: number }[];
  ticketTypeStats: { type: string; revenue: number; count: number }[];
  recentOrders: {
    id: number; userEmail: string; eventTitle: string;
    ticketType: string; price: number; status: string; createdAt: string;
  }[];
}

const STATUS_LABEL: Record<string, string> = { HOLD: 'Đang giữ', CONFIRMED: 'Đã thanh toán', EXPIRED: 'Hết hạn', CANCELLED: 'Đã hủy' };
const STATUS_DOT: Record<string, string> = { HOLD: '#f59e0b', CONFIRMED: '#10b981', EXPIRED: '#a1a1aa', CANCELLED: '#ef4444' };
const PIE_COLORS: Record<string, string> = { HOLD: '#f59e0b', CONFIRMED: '#10b981', EXPIRED: '#d1d5db', CANCELLED: '#ef4444' };
const TYPE_COLORS = ['#6366f1', '#e02020', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'];

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: '#fff', borderRadius: 14, border: '1px solid #e8eaed',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)', ...extra,
});

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
      <div style={{ flex: 1, height: 4, background: '#f0f2f5', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function Skeleton() {
  const s: React.CSSProperties = {
    background: 'linear-gradient(90deg, #f0f2f5 25%, #e5e7eb 50%, #f0f2f5 75%)',
    backgroundSize: '300% 100%', animation: 'dash-shimmer 1.6s infinite', borderRadius: 10,
  };
  return (
    <div>
      <div style={{ ...s, width: 280, height: 32, marginBottom: 8 }} />
      <div style={{ ...s, width: 200, height: 16, marginBottom: 28 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {[0,1,2,3].map(i => <div key={i} style={{ ...s, height: 130 }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 28 }}>
        <div style={{ ...s, height: 280 }} />
        <div style={{ ...s, height: 280 }} />
      </div>
      <div style={{ ...s, height: 320 }} />
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#18181b', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: 'none' }}>
      <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
          {p.name === 'revenue' ? formatCurrencyVND(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;
  if (!data) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12, color: '#9ca3af' }}>
      <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
      <span style={{ fontSize: 14 }}>Không thể tải dữ liệu.</span>
      <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '7px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>Thử lại</button>
    </div>
  );

  const convPct = data.totalReservations > 0 ? Math.round((data.confirmedReservations / data.totalReservations) * 100) : 0;

  const stats = [
    {
      value: formatCurrencyVND(data.totalRevenue), label: `Từ ${data.confirmedReservations} đơn thanh toán`,
      color: '#6366f1', bg: '#eef2ff', pct: convPct,
      icon: <svg width="20" height="20" fill="none" stroke="#6366f1" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
    },
    {
      value: String(data.totalEvents), label: 'Sự kiện đang hoạt động',
      color: '#e02020', bg: '#fef2f2', pct: Math.min(data.totalEvents * 8, 100),
      icon: <svg width="20" height="20" fill="none" stroke="#e02020" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
    },
    {
      value: `${convPct}%`, label: 'Tỷ lệ chuyển đổi',
      color: '#06b6d4', bg: '#ecfeff', pct: convPct,
      icon: <svg width="20" height="20" fill="none" stroke="#06b6d4" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
    },
    {
      value: String(data.totalUsers), label: 'Người dùng đăng ký',
      color: '#f59e0b', bg: '#fffbeb', pct: Math.min(data.totalUsers * 5, 100),
      icon: <svg width="20" height="20" fill="none" stroke="#f59e0b" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>,
    },
  ];

  return (
    <>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: 0, lineHeight: 1.3 }}>Hi Admin</h1>
          <p style={{ fontSize: 13.5, color: '#9ca3af', marginTop: 4 }}>
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/admin/events" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10,
          border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', textDecoration: 'none',
        }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          Tạo sự kiện
        </Link>
      </div>

      {/* ── 4 Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={i} style={card({ padding: '20px 22px' })}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
            </div>
            <ProgressBar pct={s.pct} color={s.color} />
          </div>
        ))}
      </div>

      {/* ── Charts Row: Revenue Area + Order Status Pie ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>

        {/* Revenue Area Chart */}
        <div style={card({ padding: '22px' })}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Doanh thu 7 ngày</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Biểu đồ doanh thu theo ngày</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.revenueByDay} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#revGrad)" name="revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status Pie */}
        <div style={card({ padding: '22px' })}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Trạng thái đơn</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Phân bổ theo trạng thái</div>
          </div>
          {data.ordersByStatus.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: '#d1d5db', fontSize: 13 }}>Chưa có dữ liệu</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={data.ordersByStatus}
                    cx="50%" cy="50%"
                    innerRadius={40} outerRadius={70}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="status"
                    stroke="none"
                  >
                    {data.ordersByStatus.map((entry) => (
                      <Cell key={entry.status} fill={PIE_COLORS[entry.status] || '#d1d5db'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [value, STATUS_LABEL[name] || name]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center', marginTop: 8 }}>
                {data.ordersByStatus.map((s) => (
                  <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[s.status] || '#d1d5db', display: 'inline-block' }} />
                    {STATUS_LABEL[s.status] || s.status}: <strong style={{ color: '#111827', fontWeight: 700 }}>{s.count}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Revenue by Ticket Type Bar + Recent Orders ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.7fr', gap: 16 }}>

        {/* Bar Chart: Revenue by ticket type */}
        <div style={card({ padding: '22px' })}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Doanh thu theo loại vé</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>So sánh các hạng vé</div>
          </div>
          {data.ticketTypeStats.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#d1d5db', fontSize: 13 }}>Chưa có dữ liệu</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.ticketTypeStats} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(0)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} width={45} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" name="revenue" radius={[6, 6, 0, 0]} barSize={32}>
                  {data.ticketTypeStats.map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Orders */}
        <div style={card()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #f0f2f5' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Đơn hàng gần đây</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>5 đơn mới nhất</div>
            </div>
            <Link href="/admin/orders" style={{
              fontSize: 12, fontWeight: 600, color: '#e02020', textDecoration: 'none',
              padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(224,32,32,0.2)', background: 'rgba(224,32,32,0.04)',
            }}>Xem tất cả</Link>
          </div>

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '36px 1.5fr 0.8fr 1fr 90px', gap: 8, padding: '10px 22px', borderBottom: '1px solid #f0f2f5' }}>
            {['No', 'Sự kiện', 'Vé', 'Giá', 'Trạng thái'].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>

          {data.recentOrders.length === 0 ? (
            <div style={{ padding: '40px 22px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Chưa có đơn hàng.</div>
          ) : (
            data.recentOrders.map((o, i) => (
              <div key={o.id} style={{
                display: 'grid', gridTemplateColumns: '36px 1.5fr 0.8fr 1fr 90px', gap: 8,
                padding: '12px 22px', borderBottom: i < data.recentOrders.length - 1 ? '1px solid #f8f9fa' : 'none', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af' }}>{i + 1}.</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: ['#6366f1', '#e02020', '#06b6d4', '#10b981', '#f59e0b'][i % 5],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#fff',
                  }}>
                    {(o.userEmail || '??').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.eventTitle}</div>
                    <div style={{ fontSize: 10.5, color: '#9ca3af' }}>{o.userEmail}</div>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{o.ticketType}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{formatCurrencyVND(o.price)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[o.status] || '#9ca3af', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_DOT[o.status] || '#9ca3af' }}>{STATUS_LABEL[o.status] || o.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
