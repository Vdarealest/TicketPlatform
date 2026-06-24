import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { VnpayService } from './vnpay.service';
import { MomoService } from './momo.service';

import { Reservation } from '../reservations/entities/reservation.entity';
import { Seat } from '../tickets/entities/seat.entity';
import { Payment } from './entities/payment.entity';
import { User } from '../users/entities/user.entity';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reservation,
      Seat,
      Payment,
      User,
    ]),
    WebsocketModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, VnpayService, MomoService],
})
export class PaymentsModule {}
