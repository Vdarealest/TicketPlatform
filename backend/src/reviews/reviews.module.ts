import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Review } from './entities/review.entity';
import { Event } from '../events/entities/event.entity';
import { Reservation } from '../reservations/entities/reservation.entity';

import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Event, Reservation])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
