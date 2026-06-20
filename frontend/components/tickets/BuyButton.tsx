'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import Button from '@/components/common/Button';

interface Props {
  ticketId: number;
  token: string;
}

export default function BuyButton({
  ticketId,
  token,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buyTicket = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post(
        `/reservations/${ticketId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('✅ Reservation successful:', response.data);
      alert('Reserved! Ticket hold expires in 30 seconds.');
    } catch (err: any) {
      const errorMsg = 
        err.response?.data?.message || 
        err.message || 
        'Failed to reserve ticket';
      
      console.error('❌ Reservation failed:', errorMsg);
      setError(errorMsg);
      alert(`Error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
  <div>
    <Button
      onClick={buyTicket}
      disabled={isLoading}
      isLoading={isLoading}
      variant="primary"
      size="lg"
    >
      Buy Ticket
    </Button>

    {error && (
      <p
        style={{
          color: 'red',
          marginTop: '10px',
        }}
      >
        Error: {error}
      </p>
    )}
  </div>
);
}