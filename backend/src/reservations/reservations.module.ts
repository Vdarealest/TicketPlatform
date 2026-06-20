import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Reservation } from './entities/reservation.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Seat } from '../tickets/entities/seat.entity';

import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { ReservationExpirationService } from './reservation-expiration.service';
import { WebsocketModule } from '../websocket/websocket.module';
import { BullModule } from '@nestjs/bullmq';
import { ReservationExpirationProcessor }
from './processors/reservation-expiration.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reservation,
      Ticket,
      Seat,
    ]),
    BullModule.registerQueue({
    name: 'reservation-expiration',
  }),
    WebsocketModule,
  ],
  

  controllers: [ReservationsController],

  providers: [ReservationsService,  ReservationExpirationProcessor],
})
export class ReservationsModule {}