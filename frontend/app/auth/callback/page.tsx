'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import api from '@/lib/api';
import { saveSession } from '@/lib/session';

function GoogleCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      router.replace('/login?error=google_failed');
      return;
    }
    // Exchange the short-lived one-time code for the actual token — the JWT
    // never appears in this page's URL, so it never lands in history/logs.
    api.post('/auth/oauth/exchange', { code })
      .then((res) => {
        if (!res.data?.access_token) throw new Error('no token');
        saveSession(res.data);
        window.dispatchEvent(new Event('auth-changed'));
        router.replace('/');
      })
      .catch(() => {
        router.replace('/login?error=google_failed');
      });
  }, [router, searchParams]);

  return (
    <main className="lp-root">
      <div className="lp-bg" />
      <div className="lp-card" style={{ alignItems: 'center', gap: 16 }}>
        <span className="lp-logo">Vietix</span>
        <div className="edp-spinner" style={{ width: 32, height: 32, margin: '8px 0' }} />
        <p style={{ color: '#9ea5ad', fontSize: 14 }}>Đang xác thực với Google...</p>
      </div>
    </main>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense>
      <GoogleCallbackInner />
    </Suspense>
  );
}
