'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AxiosError } from 'axios';

import api from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function EyeOpen() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="lp-input-icon" aria-hidden="true">
      <rect x="2" y="7" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const register = async () => {
    if (!email || !password || !confirm) { setError('Vui lòng nhập đầy đủ thông tin.'); return; }
    if (password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự.'); return; }
    if (password !== confirm) { setError('Mật khẩu xác nhận không khớp.'); return; }
    try {
      setLoading(true);
      setError('');
      await api.post('/auth/register', { email, password, ...(phone ? { phone } : {}) });
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('access_token', res.data.access_token);
      window.dispatchEvent(new Event('auth-changed'));
      router.push('/');
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setError(e.response?.data?.message || 'Đăng ký không thành công. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="lp-root">
      <div className="lp-bg" />

      <div className="lp-card">

        {/* Logo */}
        <Link href="/" className="lp-logo">Vietix</Link>

        {/* Heading */}
        <h1 className="lp-title">Tạo tài khoản</h1>
        <p className="lp-subtitle">Đăng ký để đặt vé sự kiện yêu thích</p>

        {/* Google OAuth */}
        <a href={`${API_URL}/auth/google`} className="lp-google-btn">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Tiếp tục với Google
        </a>

        {/* Divider */}
        <div className="lp-divider">
          <span className="lp-divider-line" />
          <span>hoặc đăng ký bằng email</span>
          <span className="lp-divider-line" />
        </div>

        {/* Error */}
        {error && (
          <div className="lp-error">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        {/* Email */}
        <div className="lp-field">
          <label className="lp-label" htmlFor="rp-email">Email</label>
          <div className="lp-input-wrap">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="lp-input-icon" aria-hidden="true">
              <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              id="rp-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && register()}
              className="lp-input"
              autoComplete="email"
            />
          </div>
        </div>

        {/* Phone */}
        <div className="lp-field">
          <label className="lp-label" htmlFor="rp-phone">
            Số điện thoại <span style={{ color: '#9ea5ad', fontWeight: 400 }}>(tùy chọn)</span>
          </label>
          <div className="lp-input-wrap">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="lp-input-icon" aria-hidden="true">
              <path d="M3 2h3l1 3-2 1.5a11 11 0 0 0 4.5 4.5L11 9l3 1v3a1 1 0 0 1-1 1A13 13 0 0 1 2 3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              id="rp-phone"
              type="tel"
              placeholder="0901234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && register()}
              className="lp-input"
              autoComplete="tel"
            />
          </div>
        </div>

        {/* Password */}
        <div className="lp-field">
          <label className="lp-label" htmlFor="rp-password">Mật khẩu</label>
          <div className="lp-input-wrap">
            <LockIcon />
            <input
              id="rp-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Ít nhất 6 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && register()}
              className="lp-input"
              autoComplete="new-password"
            />
            <button type="button" className="lp-eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
              {showPassword ? <EyeOff /> : <EyeOpen />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div className="lp-field">
          <label className="lp-label" htmlFor="rp-confirm">Xác nhận mật khẩu</label>
          <div className="lp-input-wrap">
            <LockIcon />
            <input
              id="rp-confirm"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Nhập lại mật khẩu"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && register()}
              className="lp-input"
              autoComplete="new-password"
            />
            <button type="button" className="lp-eye-btn" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1} aria-label={showConfirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
              {showConfirm ? <EyeOff /> : <EyeOpen />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={register}
          disabled={loading}
          className={`lp-btn ${loading ? 'lp-btn--loading' : ''}`}
        >
          {loading
            ? <><span className="lp-btn-spinner" />Đang tạo tài khoản...</>
            : 'Tạo tài khoản'}
        </button>

        {/* Footer */}
        <p className="lp-footer-text">
          Đã có tài khoản?{' '}
          <Link href="/login" className="lp-footer-link">Đăng nhập</Link>
        </p>

      </div>
    </main>
  );
}
