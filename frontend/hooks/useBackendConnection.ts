import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ConnectionStatus {
  isConnected: boolean;
  error?: string;
  timestamp?: string;
}

export function useBackendConnection() {
  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: false,
  });

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try to reach backend health endpoint
        const response = await api.get('/health', {
          timeout: 5000,
        });

        if (response.status === 200) {
          setStatus({
            isConnected: true,
            timestamp: new Date().toISOString(),
          });
          console.log('✅ Backend connection successful');
        }
      } catch (error: any) {
        const errorMsg =
          error.code === 'ECONNREFUSED'
            ? 'Backend is not running'
            : error.message || 'Network error';

        setStatus({
          isConnected: false,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        });

        console.error('❌ Backend connection failed:', errorMsg);
        console.error('Backend URL:', process.env.NEXT_PUBLIC_API_URL);
      }
    };

    // Check on mount and every 10 seconds
    checkConnection();
    const interval = setInterval(checkConnection, 10000);

    return () => clearInterval(interval);
  }, []);

  return status;
}
