import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';
import { User } from '../users/entities/user.entity';
import { Event } from '../events/entities/event.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Seat } from '../tickets/entities/seat.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Event, Ticket, Seat]),
  ],
  providers: [SeedService],
  controllers: [SeedController],
})
export class DatabaseModule {}
