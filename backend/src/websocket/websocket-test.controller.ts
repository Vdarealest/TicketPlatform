import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { WebsocketService } from '../websocket/websocket.service';

@Controller('ws-test')
export class WebsocketTestController {
  private logger = new Logger('WebsocketTestController');

  constructor(private wsService: WebsocketService) {}

  @Get('status')
  getStatus() {
    const stats = this.wsService.getConnectionStats();
    this.logger.log(`📊 Connection stats requested: ${stats.activeConnections} active`);
    return stats;
  }

  @Get('room/:eventId')
  getRoomStats(@Param('eventId') eventId: string) {
    const stats = this.wsService.getRoomStats(eventId);
    this.logger.log(`📍 Room stats for event ${eventId}: ${stats.activeUsers} users`);
    return stats;
  }

  @Post('ticket-update')
  testTicketUpdate(
    @Body() data: { eventId: string; ticketId: number; availableQuantity: number },
  ) {
    this.wsService.notifyTicketUpdate(data.eventId, data.ticketId, data.availableQuantity);
    return {
      status: 'success',
      message: `Ticket update broadcasted to event ${data.eventId}`,
    };
  }

  @Post('ticket-count')
  testTicketCount(
    @Body() data: { eventId: string; totalTickets: number; soldTickets: number },
  ) {
    this.wsService.notifyTicketCountUpdate(data.eventId, data.totalTickets, data.soldTickets);
    return {
      status: 'success',
      message: `Ticket count update broadcasted to event ${data.eventId}`,
    };
  }

  @Post('queue-status')
  testQueueStatus(
    @Body() data: { eventId: string; position: number; estimatedWait: number },
  ) {
    this.wsService.notifyQueueStatus(data.eventId, data.position, data.estimatedWait);
    return {
      status: 'success',
      message: `Queue status broadcasted to event ${data.eventId}`,
    };
  }

  @Post('notification')
  testNotification(
    @Body() data: { userId: string; title: string; message: string },
  ) {
    this.wsService.notifyUser(data.userId, {
      title: data.title,
      message: data.message,
    });
    return {
      status: 'success',
      message: `Notification sent to user ${data.userId}`,
    };
  }
}
