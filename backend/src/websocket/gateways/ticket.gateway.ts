import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class TicketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('TicketGateway');
  private activeConnections = new Map<string, Socket>();

  handleConnection(client: Socket) {
    const clientId = client.id;
    this.activeConnections.set(clientId, client);
    
    this.logger.log(
      `✅ Client connected: ${clientId} (Total: ${this.activeConnections.size})`,
    );
    
    // Send connection confirmation
    client.emit('connected', {
      message: 'Connected to ticket updates',
      clientId,
      timestamp: new Date().toISOString(),
    });

    // Broadcast user count
    this.broadcastActiveConnections();
  }

  handleDisconnect(client: Socket) {
    const clientId = client.id;
    this.activeConnections.delete(clientId);
    
    this.logger.log(
      `❌ Client disconnected: ${clientId} (Total: ${this.activeConnections.size})`,
    );

    // Broadcast user count
    this.broadcastActiveConnections();
  }

  @SubscribeMessage('join-event')
  handleJoinEvent(client: Socket, data: { eventId: string }) {
    const room = `event-${data.eventId}`;
    client.join(room);
    
    this.logger.log(`📍 Client ${client.id} joined room: ${room}`);
    
    // Notify others in the room
    this.server.to(room).emit('user-joined', {
      eventId: data.eventId,
      userCount: this.server.sockets.adapter.rooms.get(room)?.size || 0,
      timestamp: new Date().toISOString(),
    });

    return {
      status: 'success',
      message: `Joined event ${data.eventId}`,
    };
  }

  @SubscribeMessage('leave-event')
  handleLeaveEvent(client: Socket, data: { eventId: string }) {
    const room = `event-${data.eventId}`;
    client.leave(room);
    
    this.logger.log(`👋 Client ${client.id} left room: ${room}`);

    // Notify others in the room
    this.server.to(room).emit('user-left', {
      eventId: data.eventId,
      userCount: this.server.sockets.adapter.rooms.get(room)?.size || 0,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit ticket update to specific event room
  emitTicketUpdate(eventId: string, ticketId: number, availableQuantity: number) {
    const room = `event-${eventId}`;
    
    this.server.to(room).emit('ticket-update', {
      eventId,
      ticketId,
      availableQuantity,
      updatedAt: new Date().toISOString(),
    });

    this.logger.log(
      `🎫 Ticket ${ticketId} updated (Event: ${eventId}): ${availableQuantity} available`,
    );
  }

  // Emit seat status update to specific event room
  emitSeatUpdate(eventId: string, ticketId: number, seatId: number, status: string) {
    const room = `event-${eventId}`;

    this.server.to(room).emit('seat-update', {
      eventId,
      ticketId,
      seatId,
      status,
      updatedAt: new Date().toISOString(),
    });

    this.logger.log(
      `💺 Seat ${seatId} (Ticket ${ticketId}, Event: ${eventId}) -> ${status}`,
    );
  }

  // Broadcast real-time ticket count
  broadcastTicketCount(eventId: string, totalTickets: number, soldTickets: number) {
    this.server.to(`event-${eventId}`).emit('ticket-count-update', {
      eventId,
      totalTickets,
      soldTickets,
      availableTickets: totalTickets - soldTickets,
      updatedAt: new Date().toISOString(),
    });
  }

  // Broadcast active connections
  private broadcastActiveConnections() {
    this.server.emit('active-connections', {
      count: this.activeConnections.size,
      timestamp: new Date().toISOString(),
    });
  }

  // Broadcast queue status
  broadcastQueueStatus(eventId: string, position: number, estimatedWait: number) {
    const room = `queue-${eventId}`;
    
    this.server.to(room).emit('queue-status', {
      eventId,
      position,
      estimatedWaitSeconds: estimatedWait,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `⏳ Queue status (Event: ${eventId}): Position ${position}, Wait: ${estimatedWait}s`,
    );
  }

  // Broadcast notification
  broadcastNotification(userId: string, message: any) {
    this.server.to(`user-${userId}`).emit('notification', {
      ...message,
      receivedAt: new Date().toISOString(),
    });
  }

  // Get active connection count
  getActiveConnectionCount(): number {
    return this.activeConnections.size;
  }

  // Get room size
  getRoomSize(room: string): number {
    return this.server.sockets.adapter.rooms.get(room)?.size || 0;
  }
}