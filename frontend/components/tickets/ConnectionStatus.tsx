'use client';

import { useBackendConnection } from '@/hooks/useBackendConnection';

export function ConnectionStatus() {
  const status = useBackendConnection();

  if (status.isConnected) {
    return (
      <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
        <p className="text-green-800 text-sm">
          ✅ Backend connection is healthy
        </p>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
      <p className="text-red-800 font-semibold mb-2">
        ❌ Backend Connection Error
      </p>
      <p className="text-red-700 text-sm mb-2">{status.error}</p>
      <p className="text-red-600 text-xs">
        Backend URL: {process.env.NEXT_PUBLIC_API_URL}
      </p>
      <p className="text-red-600 text-xs mt-2">
        Make sure backend is running:
        <br />
        <code className="bg-red-100 px-2 py-1 rounded">
          cd backend && npm run start:dev
        </code>
      </p>
    </div>
  );
}
