import { Module } from '@nestjs/common';
import { TicketGateway } from './gateways/ticket.gateway';
import { WebsocketService } from './websocket.service';
import { WebsocketTestController } from './websocket-test.controller';

@Module({
  controllers: [WebsocketTestController],
  providers: [TicketGateway, WebsocketService],
  exports: [TicketGateway, WebsocketService],
})
export class WebsocketModule {}