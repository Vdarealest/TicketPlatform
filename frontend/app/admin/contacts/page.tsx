'use client';

import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../../../lib/api';

interface ContactMsg {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('vi-VN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return fmtDate(d);
}

function ReplyForm({ contactId, status, onSent }: { contactId: number; status: string; onSent: () => void }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSend = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setResult(null);
    try {
      await api.post(`/contact/${contactId}/reply`, { message: reply });
      setResult({ ok: true, text: 'Đã gửi phản hồi thành công!' });
      setReply('');
      onSent();
    } catch (err) {
      setResult({ ok: false, text: apiErrorMessage(err, 'Gửi thất bại.') });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="acm-reply">
      {status === 'REPLIED' && !result && (
        <p className="acm-reply__sent">Đã trả lời tin nhắn này.</p>
      )}
      <textarea
        className="acm-reply__input"
        placeholder="Nhập nội dung phản hồi..."
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={3}
      />
      {result && (
        <p className={`acm-reply__result ${result.ok ? 'acm-reply__result--ok' : 'acm-reply__result--err'}`}>
          {result.text}
        </p>
      )}
      <button className="admin-btn admin-btn--primary" onClick={handleSend} disabled={sending || !reply.trim()}>
        {sending ? 'Đang gửi...' : 'Gửi phản hồi'}
      </button>
    </div>
  );
}

export default function AdminContacts() {
  const [messages, setMessages] = useState<ContactMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContactMsg | null>(null);

  const fetch = () => {
    api.get('/contact')
      .then((r) => setMessages(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const markRead = async (id: number) => {
    await api.patch(`/contact/${id}/read`).catch(() => {});
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, status: 'READ' } : m));
    if (selected?.id === id) setSelected({ ...selected, status: 'READ' });
  };

  const pendingCount = messages.filter((m) => m.status === 'PENDING').length;

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="edp-spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">
          Tin nhắn liên hệ
          {pendingCount > 0 && (
            <span className="acm-badge">{pendingCount} mới</span>
          )}
        </h1>
      </div>

      {messages.length === 0 ? (
        <div className="admin-empty">Chưa có tin nhắn nào.</div>
      ) : (
        <div className="acm-layout">
          {/* List */}
          <div className="acm-list">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`acm-item ${m.status === 'PENDING' ? 'acm-item--unread' : ''} ${selected?.id === m.id ? 'acm-item--active' : ''}`}
                onClick={() => {
                  setSelected(m);
                  if (m.status === 'PENDING') markRead(m.id);
                }}
              >
                <div className="acm-item__top">
                  <span className="acm-item__name">{m.name}</span>
                  <span className="acm-item__time">{fmtRelative(m.createdAt)}</span>
                </div>
                <span className="acm-item__subject">{m.subject}</span>
                <span className="acm-item__preview">{m.message.slice(0, 80)}{m.message.length > 80 ? '...' : ''}</span>
              </div>
            ))}
          </div>

          {/* Detail */}
          <div className="acm-detail">
            {selected ? (
              <>
                <div className="acm-detail__header">
                  <h2 className="acm-detail__subject">{selected.subject}</h2>
                  <span className={`acm-status acm-status--${selected.status.toLowerCase()}`}>
                    {selected.status === 'PENDING' ? 'Chưa đọc' : selected.status === 'REPLIED' ? 'Đã trả lời' : 'Đã đọc'}
                  </span>
                </div>
                <div className="acm-detail__meta">
                  <div className="acm-detail__meta-row">
                    <span className="acm-detail__label">Từ</span>
                    <span className="acm-detail__value">{selected.name} ({selected.email})</span>
                  </div>
                  <div className="acm-detail__meta-row">
                    <span className="acm-detail__label">Ngày</span>
                    <span className="acm-detail__value">{fmtDate(selected.createdAt)}</span>
                  </div>
                </div>
                <div className="acm-detail__body">
                  <p>{selected.message}</p>
                </div>
                <ReplyForm
                  contactId={selected.id}
                  status={selected.status}
                  onSent={() => {
                    setMessages((prev) => prev.map((m) => m.id === selected.id ? { ...m, status: 'REPLIED' } : m));
                    setSelected({ ...selected, status: 'REPLIED' });
                  }}
                />
              </>
            ) : (
              <div className="acm-detail__empty">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M6 16l18 12 18-12" stroke="currentColor" strokeWidth="2" />
                </svg>
                <p>Chọn tin nhắn để xem chi tiết</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
