'use client';

import { useState } from 'react';
import api, { apiErrorMessage } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

export default function ContactPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await api.post('/contact', form);
      setSent(true);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setError(apiErrorMessage(err, t.contact_fail));
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="sp-root">
      <div className="sp-wrap">
        <div className="sp-header">
          <h1 className="sp-title">{t.contact_title}</h1>
          <p className="sp-subtitle">{t.contact_subtitle}</p>
        </div>

        <div className="sp-contact-grid">
          <div className="sp-contact-info">
            <div className="sp-contact-card">
              <div className="sp-contact-card__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                  <path d="M2 7l10 7 10-7" />
                </svg>
              </div>
              <h3 className="sp-contact-card__title">{t.contact_email}</h3>
              <p className="sp-contact-card__text">support@vietix.vn</p>
            </div>

            <div className="sp-contact-card">
              <div className="sp-contact-card__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <h3 className="sp-contact-card__title">{t.contact_hotline}</h3>
              <p className="sp-contact-card__text">1900 xxxx</p>
              <p className="sp-contact-card__sub">{t.contact_hours}</p>
            </div>

            <div className="sp-contact-card">
              <div className="sp-contact-card__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <h3 className="sp-contact-card__title">{t.contact_office}</h3>
              <p className="sp-contact-card__text">{t.contact_address}</p>
            </div>
          </div>

          <div className="sp-contact-form-wrap">
            {sent ? (
              <div className="sp-contact-success">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="20" stroke="#10b981" strokeWidth="2.5" />
                  <path d="M16 24l6 6 12-12" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3>{t.contact_success_title}</h3>
                <p>{t.contact_success_text}</p>
                <button className="sp-btn sp-btn--primary" onClick={() => setSent(false)}>{t.contact_send_another}</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="sp-form-row">
                  <div className="sp-form-field">
                    <label className="sp-form-label">{t.contact_name}</label>
                    <input className="sp-form-input" type="text" placeholder={t.contact_name_ph} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="sp-form-field">
                    <label className="sp-form-label">{t.contact_email}</label>
                    <input className="sp-form-input" type="email" placeholder={t.contact_email_ph} required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div className="sp-form-field">
                  <label className="sp-form-label">{t.contact_subject}</label>
                  <input className="sp-form-input" type="text" placeholder={t.contact_subject_ph} required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </div>
                <div className="sp-form-field">
                  <label className="sp-form-label">{t.contact_message}</label>
                  <textarea className="sp-form-textarea" placeholder={t.contact_message_ph} rows={5} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                </div>
                {error && <p className="pp-edit-error">{error}</p>}
                <button className="sp-btn sp-btn--primary sp-btn--full" type="submit" disabled={sending}>
                  {sending ? t.contact_sending : t.contact_send}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
