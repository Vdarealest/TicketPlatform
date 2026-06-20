import { Injectable, Logger } from '@nestjs/common';
import { TicketGateway } from './gateways/ticket.gateway';

@Injectable()
export class WebsocketService {
  private logger = new Logger('WebsocketService');

  constructor(private ticketGateway: TicketGateway) {}

  // Send ticket update to event room
  notifyTicketUpdate(eventId: string, ticketId: number, availableQuantity: number) {
    this.ticketGateway.emitTicketUpdate(eventId, ticketId, availableQuantity);
  }

  // Send ticket count update
  notifyTicketCountUpdate(
    eventId: string,
    totalTickets: number,
    soldTickets: number,
  ) {
    this.ticketGateway.broadcastTicketCount(eventId, totalTickets, soldTickets);
    this.logger.log(
      `📊 Ticket count updated for event ${eventId}: ${soldTickets}/${totalTickets}`,
    );
  }

  // Send queue status
  notifyQueueStatus(eventId: string, position: number, estimatedWait: number) {
    this.ticketGateway.broadcastQueueStatus(eventId, position, estimatedWait);
  }

  // Send notification to specific user
  notifyUser(userId: string, message: any) {
    this.ticketGateway.broadcastNotification(userId, message);
  }

  // Get current connection stats
  getConnectionStats() {
    return {
      activeConnections: this.ticketGateway.getActiveConnectionCount(),
      timestamp: new Date().toISOString(),
    };
  }

  // Get room stats
  getRoomStats(eventId: string) {
    return {
      eventId,
      activeUsers: this.ticketGateway.getRoomSize(`event-${eventId}`),
      timestamp: new Date().toISOString(),
    };
  }
}
