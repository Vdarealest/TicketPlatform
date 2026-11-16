'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { apiErrorMessage } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { backendUrl } from '@/lib/config';

// ─── helpers ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#e02020', '#0f35ff', '#007aff', '#34aadc', '#10b981', '#f59e0b', '#8b5cf6'];

function avatarColor(email: string) {
  return AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(email: string) {
  const local = email.split('@')[0];
  const parts = local.split(/[._-]/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : local.slice(0, 2).toUpperCase();
}

function nameInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function decodeJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtPrice(n: number) {
  return n.toLocaleString('vi-VN') + '₫';
}

// ─── status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { label: string; cls: string }> = {
    HOLD:       { label: t.status_hold,      cls: 'pp-badge--hold' },
    CONFIRMED:  { label: t.status_confirmed, cls: 'pp-badge--confirmed' },
    PAID:       { label: t.status_paid,      cls: 'pp-badge--confirmed' },
    EXPIRED:    { label: t.status_expired,   cls: 'pp-badge--expired' },
    CANCELLED:  { label: t.status_cancelled, cls: 'pp-badge--expired' },
  };
  const s = map[status] ?? { label: status, cls: 'pp-badge--expired' };
  return <span className={`pp-status-badge ${s.cls}`}>{s.label}</span>;
}

// ─── types ────────────────────────────────────────────────────────────────────

interface UserInfo {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
  googleId: string | null;
  role: string;
  createdAt: string;
}

interface Reservation {
  id: number;
  status: string;
  createdAt: string;
  ticket: {
    name: string;
    price: number;
    event: { name: string; date?: string };
  };
}

// ─── edit profile modal ─────────────────────────────────────────────────────

function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserInfo;
  onClose: () => void;
  onSaved: (u: UserInfo) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(user.name ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError(t.pp_upload_max);
      return;
    }

    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/users/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUrl(res.data.url);
    } catch (err) {
      setError(apiErrorMessage(err, t.pp_upload_fail));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.patch('/users/profile', { name, phone, avatarUrl });
      setSuccess(t.pp_save_success);
      onSaved(res.data);
      window.dispatchEvent(new Event('auth-changed'));
      setTimeout(onClose, 800);
    } catch (err) {
      setError(apiErrorMessage(err, t.pp_save_fail));
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = avatarUrl
    ? backendUrl(avatarUrl)
    : null;

  return (
    <div className="pp-modal-overlay" onClick={onClose}>
      <div className="pp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pp-modal-header">
          <h2 className="pp-modal-title">{t.pp_edit_title}</h2>
          <button className="pp-modal-close" onClick={onClose} aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="pp-modal-body">
          {/* avatar */}
          <div className="pp-edit-avatar-section">
            <div
              className="pp-edit-avatar"
              onClick={() => fileRef.current?.click()}
              style={{ cursor: 'pointer' }}
            >
              {previewSrc ? (
                <img src={previewSrc} alt="Avatar" className="pp-edit-avatar-img" />
              ) : (
                <span className="pp-edit-avatar-placeholder" style={{ background: avatarColor(user.email) }}>
                  {user.name ? nameInitials(user.name) : initials(user.email)}
                </span>
              )}
              <span className="pp-edit-avatar-overlay">
                {uploading ? (
                  <span className="pp-spinner-small" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 11v3h3l7.5-7.5-3-3L2 11z" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M10.5 2.5l3 3" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                )}
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
            />
            <span className="pp-edit-avatar-hint">{t.pp_avatar_hint}</span>
          </div>

          {/* fields */}
          <div className="pp-edit-field">
            <label className="pp-edit-label">{t.pp_display_name}</label>
            <input
              className="pp-edit-input"
              type="text"
              placeholder={t.pp_display_name_ph}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="pp-edit-field">
            <label className="pp-edit-label">{t.pp_phone}</label>
            <input
              className="pp-edit-input"
              type="tel"
              placeholder="0912 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={15}
            />
          </div>

          <div className="pp-edit-field">
            <label className="pp-edit-label">Email</label>
            <input
              className="pp-edit-input pp-edit-input--disabled"
              type="email"
              value={user.email}
              disabled
            />
            <span className="pp-edit-hint">{t.pp_email_readonly}</span>
          </div>

          {error && <p className="pp-edit-error">{error}</p>}
          {success && <p className="pp-edit-success">{success}</p>}
        </div>

        <div className="pp-modal-footer">
          <button className="pp-btn pp-btn--ghost" onClick={onClose} disabled={saving}>
            {t.pp_cancel}
          </button>
          <button className="pp-btn pp-btn--primary" onClick={handleSave} disabled={saving || uploading}>
            {saving ? t.pp_saving : t.pp_save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── change password modal ──────────────────────────────────────────────────

function ChangePasswordModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!currentPw) { setError(t.pp_pw_enter_current); return; }
    if (newPw.length < 6) { setError(t.pp_pw_min); return; }
    if (newPw !== confirmPw) { setError(t.pp_pw_mismatch); return; }

    setSaving(true);
    try {
      await api.patch('/users/change-password', {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setSuccess(t.pp_pw_success);
      setTimeout(onClose, 1000);
    } catch (err) {
      setError(apiErrorMessage(err, t.pp_pw_fail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pp-modal-overlay" onClick={onClose}>
      <div className="pp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pp-modal-header">
          <h2 className="pp-modal-title">{t.pp_pw_title}</h2>
          <button className="pp-modal-close" onClick={onClose} aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="pp-modal-body">
          <div className="pp-edit-field">
            <label className="pp-edit-label">{t.pp_pw_current}</label>
            <div className="pp-pw-wrap">
              <input
                className="pp-edit-input"
                type={showCurrent ? 'text' : 'password'}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder={t.pp_pw_current_ph}
              />
              <button
                type="button"
                className="pp-pw-toggle"
                onClick={() => setShowCurrent(!showCurrent)}
                aria-label={showCurrent ? 'Ẩn' : 'Hiện'}
              >
                <EyeIcon open={showCurrent} />
              </button>
            </div>
          </div>

          <div className="pp-edit-field">
            <label className="pp-edit-label">{t.pp_pw_new}</label>
            <div className="pp-pw-wrap">
              <input
                className="pp-edit-input"
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder={t.pp_pw_new_ph}
              />
              <button
                type="button"
                className="pp-pw-toggle"
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? 'Ẩn' : 'Hiện'}
              >
                <EyeIcon open={showNew} />
              </button>
            </div>
          </div>

          <div className="pp-edit-field">
            <label className="pp-edit-label">{t.pp_pw_confirm}</label>
            <input
              className="pp-edit-input"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder={t.pp_pw_confirm_ph}
            />
          </div>

          {error && <p className="pp-edit-error">{error}</p>}
          {success && <p className="pp-edit-success">{success}</p>}
        </div>

        <div className="pp-modal-footer">
          <button className="pp-btn pp-btn--ghost" onClick={onClose} disabled={saving}>
            {t.pp_cancel}
          </button>
          <button className="pp-btn pp-btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t.pp_saving : t.pp_change_password}
          </button>
        </div>
      </div>
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 13.5l11-11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.replace('/login'); return; }

    const payload = decodeJwt(token);
    if (!payload?.email) { router.replace('/login'); return; }

    const fetchProfile = async () => {
      try {
        const r = await api.get('/users/profile');
        return r.data;
      } catch {
        try {
          const r = await api.get('/auth/me');
          return r.data;
        } catch { return null; }
      }
    };

    Promise.all([
      fetchProfile(),
      api.get('/reservations/my').then(r => r.data).catch(() => []),
    ]).then(([me, res]) => {
      if (me) setUser(me);
      if (Array.isArray(res)) setReservations(res.slice(0, 3));
      setLoading(false);
    });
  }, [router]);

  const logout = () => {
    localStorage.removeItem('access_token');
    window.dispatchEvent(new Event('auth-changed'));
    router.push('/');
  };

  if (loading) {
    return (
      <main className="pp-root">
        <div className="pp-wrap">
          <div className="pp-hero-card">
            <div className="pp-sk-circle" />
            <div className="pp-sk-line" style={{ width: '40%' }} />
            <div className="pp-sk-line" style={{ width: '60%', height: 12 }} />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    router.replace('/login');
    return null;
  }

  const email = user.email;
  const color = avatarColor(email);
  const inits = user.name ? nameInitials(user.name) : initials(email);
  const displayName = user.name || email.split('@')[0];
  const isGoogle = !!user.googleId;
  const totalRes = reservations.length;
  const avatarSrc = user.avatarUrl
    ? backendUrl(user.avatarUrl)
    : null;

  return (
    <main className="pp-root">
      <div className="pp-wrap">

        {/* ── hero ─────────────────────────────────── */}
        <div className="pp-hero-card">
          <div className="pp-avatar-ring" style={{ '--ac': color } as React.CSSProperties}>
            {avatarSrc ? (
              <img src={avatarSrc} alt={displayName} className="pp-avatar pp-avatar--img" />
            ) : (
              <div className="pp-avatar" style={{ background: color }}>{inits}</div>
            )}
          </div>

          <div className="pp-identity">
            <h1 className="pp-display-name">{displayName}</h1>
            <span className="pp-email-text">{email}</span>
            {user.phone && (
              <span className="pp-phone-text">{user.phone}</span>
            )}

            <div className="pp-pill-row">
              {isGoogle && (
                <span className="pp-pill pp-pill--google">
                  <svg width="12" height="12" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Google
                </span>
              )}
              {!isGoogle && (
                <span className="pp-pill pp-pill--email">
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Email
                </span>
              )}
              <span className="pp-pill pp-pill--role">{user.role ?? 'USER'}</span>
            </div>
          </div>

          {/* stats row */}
          <div className="pp-stats">
            <div className="pp-stat">
              <span className="pp-stat__num">{totalRes}</span>
              <span className="pp-stat__label">{t.pp_reservation}</span>
            </div>
            <div className="pp-stat-divider" />
            <div className="pp-stat">
              <span className="pp-stat__num">{user.createdAt ? new Date(user.createdAt).getFullYear() : '-'}</span>
              <span className="pp-stat__label">{t.pp_joined_from}</span>
            </div>
            <div className="pp-stat-divider" />
            <div className="pp-stat">
              <span className="pp-stat__num">{user.role === 'ADMIN' ? 'Admin' : 'Member'}</span>
              <span className="pp-stat__label">{t.pp_rank}</span>
            </div>
          </div>

          {/* edit profile button */}
          <button className="pp-edit-profile-btn" onClick={() => setShowEdit(true)}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M2 11.5V14h2.5L12.06 6.44l-2.5-2.5L2 11.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M10.06 3.44l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            {t.pp_edit_profile}
          </button>
        </div>

        {/* ── recent reservations ───────────────────── */}
        <div className="pp-section">
          <div className="pp-section-head">
            <span className="pp-section-title">{t.pp_recent}</span>
            <Link href="/my-tickets" className="pp-section-link">
              {t.pp_view_all}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6h8M6 2.5L9.5 6 6 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>

          {reservations.length === 0 ? (
            <div className="pp-empty">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="6" width="20" height="14" rx="2" stroke="#c7c7cc" strokeWidth="1.5"/>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#c7c7cc" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 6v14M16 6v14" stroke="#c7c7cc" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span>{t.pp_no_reservation}</span>
              <Link href="/events" className="pp-empty-cta">{t.pp_explore}</Link>
            </div>
          ) : (
            <div className="pp-res-list">
              {reservations.map((r) => (
                <div key={r.id} className="pp-res-item">
                  <div className="pp-res-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="1.5" y="4.5" width="13" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M5.5 4.5v7M10.5 4.5v7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="pp-res-body">
                    <span className="pp-res-event">{r.ticket?.event?.name ?? t.event}</span>
                    <span className="pp-res-meta">
                      {r.ticket?.name} · {fmtPrice(r.ticket?.price ?? 0)} · {fmtDate(r.createdAt)}
                    </span>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── account info ─────────────────────────── */}
        <div className="pp-section">
          <div className="pp-section-head">
            <span className="pp-section-title">{t.pp_account_info}</span>
          </div>
          <div className="pp-info-table">
            <div className="pp-info-row">
              <span className="pp-info-key">{t.pp_name}</span>
              <span className="pp-info-val">{user.name || '—'}</span>
            </div>
            <div className="pp-info-row">
              <span className="pp-info-key">Email</span>
              <span className="pp-info-val">{email}</span>
            </div>
            <div className="pp-info-row">
              <span className="pp-info-key">{t.pp_phone}</span>
              <span className="pp-info-val">{user.phone || '—'}</span>
            </div>
            <div className="pp-info-row">
              <span className="pp-info-key">{t.pp_login_via}</span>
              <span className="pp-info-val">{isGoogle ? 'Google' : 'Email & Password'}</span>
            </div>
            {user.createdAt && (
              <div className="pp-info-row">
                <span className="pp-info-key">{t.pp_joined}</span>
                <span className="pp-info-val">{fmtDate(user.createdAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── security section ─────────────────────── */}
        {!isGoogle && (
          <div className="pp-section">
            <div className="pp-section-head">
              <span className="pp-section-title">{t.pp_security}</span>
            </div>
            <div className="pp-info-table">
              <div
                className="pp-info-row pp-info-row--action"
                onClick={() => setShowPw(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setShowPw(true)}
              >
                <span className="pp-info-key">{t.pp_password}</span>
                <span className="pp-info-action">
                  {t.pp_change_password}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── logout ───────────────────────────────── */}
        <button className="pp-logout-btn" onClick={logout}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M10.5 10.5L13.5 8l-3-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.5 8H6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          {t.pp_logout}
        </button>

      </div>

      {/* modals */}
      {showEdit && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEdit(false)}
          onSaved={(u) => setUser(u)}
        />
      )}
      {showPw && <ChangePasswordModal onClose={() => setShowPw(false)} />}
    </main>
  );
}
