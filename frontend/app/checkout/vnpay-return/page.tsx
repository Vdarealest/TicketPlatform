'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import api from '@/lib/api';
import { formatCurrencyVND } from '@/lib/format';

interface ReturnResult {
  success: boolean;
  message: string;
  orderId?: string;
  amount?: number;
  reservationIds?: number[];
  responseCode?: string;
}

export default function VnpayReturnPage() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<ReturnResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    if (!params['vnp_TxnRef']) {
      setResult({ success: false, message: 'Không có thông tin thanh toán.' });
      setLoading(false);
      return;
    }

    api
      .get('/payments/vnpay/return', { params })
      .then((res) => setResult(res.data))
      .catch(() =>
        setResult({ success: false, message: 'Không thể xác minh thanh toán.' }),
      )
      .finally(() => setLoading(false));
  }, [searchParams]);

  if (loading) {
    return (
      <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#111',
            borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ fontSize: 15, color: '#6b7280' }}>Đang xác minh thanh toán...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  if (!result) return null;

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb', padding: 16 }}>
      <div style={{
        width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16,
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

            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 8px' }}>
              Thanh toán thành công!
            </h1>

            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
              Cảm ơn bạn đã mua vé. Vé của bạn đã được xác nhận.
            </p>

            {result.amount && (
              <div style={{
                background: '#f9fafb', borderRadius: 12, padding: '16px 20px',
                margin: '0 0 20px', border: '1px solid #f0f2f5',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Mã đơn hàng</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111', fontFamily: 'monospace' }}>
                    {result.orderId}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Số lượng vé</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                    {result.reservationIds?.length || 0} vé
                  </span>
                </div>
                <div style={{
                  borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 4,
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Tổng tiền</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>
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
                Xem vé của tôi
              </Link>
              <Link
                href="/"
                style={{
                  padding: '12px 24px', borderRadius: 10, border: '1px solid #e5e7ea',
                  background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600,
                  textDecoration: 'none', transition: 'opacity 0.15s',
                }}
              >
                Trang chủ
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

            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 8px' }}>
              Thanh toán thất bại
            </h1>

            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px', lineHeight: 1.5 }}>
              {result.message}
            </p>

            {result.responseCode && result.responseCode !== '00' && (
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px' }}>
                Mã lỗi: {result.responseCode}
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
                Về trang chủ
              </Link>
            </div>
          </>
        )}

        {/* VNPay attribution */}
        <p style={{ fontSize: 11, color: '#b0b6c1', marginTop: 28 }}>
          Thanh toán được xử lý bởi VNPay
        </p>
      </div>
    </main>
  );
}
