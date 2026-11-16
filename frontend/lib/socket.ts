import { io } from 'socket.io-client';
import { WS_URL } from './config';

export const socket = io(
  WS_URL,
  {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling'],
  }
);