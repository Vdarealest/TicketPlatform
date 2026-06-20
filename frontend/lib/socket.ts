import { io } from 'socket.io-client';

export const socket = io(
  process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000',
  {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling'],
  }
);