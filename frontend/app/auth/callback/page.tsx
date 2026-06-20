'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function GoogleCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('access_token', token);
      window.dispatchEvent(new Event('auth-changed'));
      router.replace('/');
    } else {
      router.replace('/login?error=google_failed');
    }
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
