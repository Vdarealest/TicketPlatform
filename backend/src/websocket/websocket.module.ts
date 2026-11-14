import { Module } from '@nestjs/common';
import { TicketGateway } from './gateways/ticket.gateway';
import { WebsocketService } from './websocket.service';

@Module({
  providers: [TicketGateway, WebsocketService],
  exports: [TicketGateway, WebsocketService],
})
export class WebsocketModule {}
