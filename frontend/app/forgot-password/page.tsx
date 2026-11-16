'use client';

import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import Link from 'next/link';
import api, { apiErrorMessage } from '@/lib/api';
import { useTranslation, fmt } from '@/lib/i18n';

// ─── OTP input — 6 individual digit boxes ────────────────────────────────────

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const clean = (s: string) => s.replace(/\D/g, '').slice(0, 6).padEnd(6, '');

  const handleChange = (i: number, raw: string) => {
    const ch = raw.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = ch;
    onChange(arr.join('').slice(0, 6).padEnd(6, ''));
    if (ch && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[i]) {
        const arr = value.split('');
        arr[i] = '';
        onChange(arr.join(''));
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = clean(e.clipboardData.getData('text'));
    onChange(pasted);
    refs.current[Math.min(pasted.replace(/ /g, '').length, 5)]?.focus();
  };

  return (
    <div className="otp-row" onPaste={handlePaste}>
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] !== ' ' && value[i] ? value[i] : ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.target.select()}
          className="otp-box"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={fmt(t.fp_digit, { n: i + 1 })}
        />
      ))}
    </div>
  );
}

// ─── Resend countdown ─────────────────────────────────────────────────────────

function ResendTimer({ onResend }: { onResend: () => Promise<void> }) {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(60);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const handleResend = async () => {
    setResending(true);
    await onResend();
    setSeconds(60);
    setResending(false);
  };

  if (seconds > 0) {
    return (
      <p className="fp-resend-text">
        {t.fp_resend_in} <strong>{seconds}s</strong>
      </p>
    );
  }

  return (
    <button type="button" className="fp-resend-btn" onClick={handleResend} disabled={resending}>
      {resending ? t.fp_sending : t.fp_resend}
    </button>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const { t } = useTranslation();
  const labels = [t.fp_step_identify, t.fp_step_verify, t.fp_step_new];
  return (
    <div className="fp-steps">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const active = n === current;
        return (
          <Fragment key={n}>
            <div className="fp-step-item">
              <div className={`fp-step-dot${done ? ' fp-step-dot--done' : active ? ' fp-step-dot--active' : ''}`}>
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : n}
              </div>
              <span className={`fp-step-label${active ? ' fp-step-label--active' : ''}`}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div className={`fp-step-connector${done ? ' fp-step-connector--done' : ''}`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 'done';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);
  const [identifier, setIdentifier] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('      ');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Step 1: send OTP ──
  const sendOtp = useCallback(async () => {
    if (!identifier.trim()) { setError(t.fp_need_identifier); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/forgot-password', { identifier: identifier.trim() });
      setResolvedEmail(res.data.email);
      setMaskedEmail(res.data.maskedEmail);
      setStep(2);
      setOtp('      ');
    } catch (err) {
      setError(apiErrorMessage(err, t.fp_generic_error));
    } finally {
      setLoading(false);
    }
  }, [identifier]);

  // ── Step 2: verify OTP ──
  const verifyOtp = async () => {
    const code = otp.trim();
    if (code.length < 6) { setError(t.fp_need_6_digits); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/verify-otp', { email: resolvedEmail, otp: code });
      setStep(3);
    } catch (err) {
      setError(apiErrorMessage(err, t.fp_wrong_otp));
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: reset password ──
  const resetPassword = async () => {
    if (!password) { setError(t.fp_need_password); return; }
    if (password.length < 6) { setError(t.fp_password_short); return; }
    if (password !== confirm) { setError(t.fp_password_mismatch); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { email: resolvedEmail, otp: otp.trim(), newPassword: password });
      setStep('done');
    } catch (err) {
      setError(apiErrorMessage(err, t.fp_generic_error));
    } finally {
      setLoading(false);
    }
  };

  const otpFilled = otp.trim().length === 6;

  return (
    <main className="lp-root">
      <div className="lp-bg" />
      <div className="lp-card">
        <Link href="/" className="lp-logo">Vietix</Link>

        {/* ── Done ── */}
        {step === 'done' && (
          <>
            <div className="lp-success-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="23" stroke="#22c55e" strokeWidth="2"/>
                <path d="M14 24l7 7 13-13" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="lp-title">{t.fp_done_title}</h1>
            <p className="lp-subtitle" style={{ marginBottom: 28 }}>
              {t.fp_done_text}
            </p>
            <Link href="/login" className="lp-btn" style={{ textDecoration: 'none', justifyContent: 'center' }}>
              {t.fp_login_now}
            </Link>
          </>
        )}

        {/* ── Steps 1-3 ── */}
        {step !== 'done' && (
          <>
            <Steps current={step} />

            {error && (
              <div className="lp-error">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            {/* Step 1 */}
            {step === 1 && (
              <>
                <h1 className="lp-title">{t.fp_title}</h1>
                <p className="lp-subtitle">{t.fp_subtitle}</p>

                <div className="lp-field">
                  <label className="lp-label" htmlFor="fp-identifier">{t.fp_identifier_label}</label>
                  <div className="lp-input-wrap">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="lp-input-icon" aria-hidden="true">
                      <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <input
                      id="fp-identifier"
                      type="text"
                      placeholder={t.fp_identifier_placeholder}
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendOtp()}
                      className="lp-input"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <button onClick={sendOtp} disabled={loading} className={`lp-btn ${loading ? 'lp-btn--loading' : ''}`}>
                  {loading ? <><span className="lp-btn-spinner" /> {t.fp_sending}</> : t.fp_send_otp}
                </button>

                <p className="lp-footer-text">
                  <Link href="/login" className="lp-footer-link">{t.fp_back_to_login}</Link>
                </p>
              </>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <>
                <h1 className="lp-title">{t.fp_enter_otp}</h1>
                <p className="lp-subtitle">
                  {t.fp_otp_sent_to} <strong style={{ color: 'var(--text-primary)' }}>{maskedEmail}</strong>. {t.fp_otp_valid}
                </p>

                <OtpInput value={otp} onChange={setOtp} />

                <button
                  onClick={verifyOtp}
                  disabled={loading || !otpFilled}
                  className={`lp-btn ${loading ? 'lp-btn--loading' : ''}`}
                  style={{ marginTop: 8 }}
                >
                  {loading ? <><span className="lp-btn-spinner" /> {t.fp_verifying}</> : t.fp_confirm_code}
                </button>

                <div className="fp-resend-wrap">
                  <ResendTimer onResend={sendOtp} />
                </div>

                <p className="lp-footer-text">
                  <button
                    type="button"
                    className="lp-footer-link"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0 }}
                    onClick={() => { setStep(1); setError(''); }}
                  >
                    {t.fp_change_identifier}
                  </button>
                </p>
              </>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <>
                <h1 className="lp-title">{t.fp_new_title}</h1>
                <p className="lp-subtitle">{t.fp_new_subtitle} <strong style={{ color: 'var(--text-primary)' }}>{maskedEmail}</strong>.</p>

                <div className="lp-field">
                  <label className="lp-label" htmlFor="fp-password">{t.fp_new_label}</label>
                  <div className="lp-input-wrap">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="lp-input-icon" aria-hidden="true">
                      <rect x="2" y="7" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <input
                      id="fp-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t.fp_min_6}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="lp-input"
                      autoComplete="new-password"
                      autoFocus
                    />
                    <button type="button" className="lp-eye-btn" onClick={() => setShowPassword(p => !p)} tabIndex={-1} aria-label={showPassword ? t.fp_hide : t.fp_show}>
                      {showPassword ? (
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="lp-field">
                  <label className="lp-label" htmlFor="fp-confirm">{t.fp_confirm_label}</label>
                  <div className="lp-input-wrap">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="lp-input-icon" aria-hidden="true">
                      <rect x="2" y="7" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <input
                      id="fp-confirm"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder={t.fp_confirm_placeholder}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && resetPassword()}
                      className="lp-input"
                      autoComplete="new-password"
                    />
                    <button type="button" className="lp-eye-btn" onClick={() => setShowConfirm(p => !p)} tabIndex={-1} aria-label={showConfirm ? t.fp_hide : t.fp_show}>
                      {showConfirm ? (
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                <button onClick={resetPassword} disabled={loading} className={`lp-btn ${loading ? 'lp-btn--loading' : ''}`}>
                  {loading ? <><span className="lp-btn-spinner" /> {t.fp_updating}</> : t.fp_reset}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
