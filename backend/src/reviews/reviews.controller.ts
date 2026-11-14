import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Get('event/:eventId')
  getByEvent(@Param('eventId') eventId: string) {
    return this.reviewsService.getByEvent(Number(eventId));
  }

  @Post('event/:eventId')
  @UseGuards(JwtAuthGuard)
  create(
    @Param('eventId') eventId: string,
    @Req() req: any,
    @Body() body: CreateReviewDto,
  ) {
    return this.reviewsService.create(
      req.user.userId,
      Number(eventId),
      body.rating,
      body.comment,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string, @Req() req: any) {
    return this.reviewsService.delete(Number(id), req.user.userId);
  }
}
