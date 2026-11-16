'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import api from '@/lib/api';
import { formatCurrencyVND } from '@/lib/format';
import { useTranslation, fmt, tr } from '@/lib/i18n';

interface ReturnResult {
  success: boolean;
  message: string;
  orderId?: string;
  amount?: number;
  reservationIds?: number[];
  responseCode?: string;
}

function VnpayReturnContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [result, setResult] = useState<ReturnResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    if (!params['vnp_TxnRef']) {
      setResult({ success: false, message: 'pr_no_info' });
      setLoading(false);
      return;
    }

    api
      .get('/payments/vnpay/return', { params })
      .then((res) => setResult(res.data))
      .catch(() =>
        setResult({ success: false, message: 'pr_verify_failed' }),
      )
      .finally(() => setLoading(false));
  }, [searchParams]);

  if (loading) {
    return (
      <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid var(--border-input)', borderTopColor: 'var(--text-primary)',
            borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ fontSize: 15, color: 'var(--text-tertiary)' }}>{t.pr_verifying}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  if (!result) return null;

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb', padding: 16 }}>
      <div style={{
        width: '100%', maxWidth: 440, background: 'var(--surface-primary)', borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '40px 32px', textAlign: 'center',
      }}>
        {result.success ? (
          <>
            {/* Success icon */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%', background: '#ecfdf5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="36" height="36" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              {t.pr_success}
            </h1>

            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '0 0 20px', lineHeight: 1.5 }}>
              {t.pr_thanks}
            </p>

            {result.amount && (
              <div style={{
                background: 'var(--surface-secondary)', borderRadius: 12, padding: '16px 20px',
                margin: '0 0 20px', border: '1px solid var(--border-secondary)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t.pr_order_id}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {result.orderId}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t.pr_ticket_count}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {fmt(t.co_n_tickets, { n: result.reservationIds?.length || 0 })}
                  </span>
                </div>
                <div style={{
                  borderTop: '1px solid var(--border-input)', paddingTop: 8, marginTop: 4,
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{t.pr_total}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatCurrencyVND(result.amount)}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Link
                href="/my-tickets"
                style={{
                  padding: '12px 24px', borderRadius: 10, background: '#111', color: '#fff',
                  fontSize: 14, fontWeight: 600, textDecoration: 'none',
                  transition: 'opacity 0.15s',
                }}
              >
                {t.co_view_my_tickets}
              </Link>
              <Link
                href="/"
                style={{
                  padding: '12px 24px', borderRadius: 10, border: '1px solid var(--border-input)',
                  background: 'var(--surface-primary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600,
                  textDecoration: 'none', transition: 'opacity 0.15s',
                }}
              >
                {t.pr_home}
              </Link>
            </div>
          </>
        ) : (
          <>
            {/* Failure icon */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%', background: '#fef2f2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="36" height="36" fill="none" stroke="#ef4444" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              {t.pr_failed}
            </h1>

            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '0 0 24px', lineHeight: 1.5 }}>
              {tr(t, result.message)}
            </p>

            {result.responseCode && result.responseCode !== '00' && (
              <p style={{ fontSize: 12, color: 'var(--text-quaternary)', margin: '0 0 20px' }}>
                {t.pr_error_code} {result.responseCode}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Link
                href="/"
                style={{
                  padding: '12px 24px', borderRadius: 10, background: '#111', color: '#fff',
                  fontSize: 14, fontWeight: 600, textDecoration: 'none',
                }}
              >
                {t.co_back_home}
              </Link>
            </div>
          </>
        )}

        {/* VNPay attribution */}
        <p style={{ fontSize: 11, color: '#b0b6c1', marginTop: 28 }}>
          {fmt(t.pr_processed_by, { gateway: 'VNPay' })}
        </p>
      </div>
    </main>
  );
}

// useSearchParams() opts the tree into client-side rendering, so Next requires
// a Suspense boundary above it or the production build fails at prerender.
export default function VnpayReturnPage() {
  return (
    <Suspense fallback={null}>
      <VnpayReturnContent />
    </Suspense>
  );
}
