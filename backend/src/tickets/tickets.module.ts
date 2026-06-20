import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Ticket } from './entities/ticket.entity';
import { Seat } from './entities/seat.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, Seat]),
  ],
})
export class TicketsModule {}