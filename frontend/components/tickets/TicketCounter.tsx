'use client';

import { useEffect, useState } from 'react';
import { socket } from '../../lib/socket';

interface Props {
  ticketId: number;
  initialQuantity: number;
  eventId?: string;
}

export default function TicketCounter({
  ticketId,
  initialQuantity,
  eventId = '1',
}: Props) {
  const [quantity, setQuantity] =
    useState(initialQuantity);

  useEffect(() => {
    // Join event room to receive updates
    socket.emit('join-event', { eventId });
    
    console.log(`📍 Joined event room: ${eventId}`);

    // Listen for ticket updates
    const handleTicketUpdate = (data: any) => {
      console.log('🎫 Ticket update received:', data);
      if (
        String(data.ticketId) === String(ticketId)
      ) {
        setQuantity(data.availableQuantity);
      }
    };

    socket.on(
      'ticket-update',
      handleTicketUpdate,
    );

    return () => {
      socket.off('ticket-update', handleTicketUpdate);
      socket.emit('leave-event', { eventId });
    };
  }, [ticketId, eventId]);

  return (
    <h2>
      Tickets Left: {quantity}
    </h2>
  );
}