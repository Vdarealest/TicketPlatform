import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Review } from './entities/review.entity';
import { Event } from '../events/entities/event.entity';
import { Reservation } from '../reservations/entities/reservation.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,

    @InjectRepository(Event)
    private eventRepository: Repository<Event>,

    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
  ) {}

  async create(
    userId: number,
    eventId: number,
    rating: number,
    comment: string,
  ) {
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      throw new BadRequestException('Đánh giá phải từ 1 đến 5 sao.');
    }

    if (!comment.trim()) {
      throw new BadRequestException('Vui lòng nhập bình luận.');
    }

    if (comment.trim().length > 1000) {
      throw new BadRequestException('Bình luận tối đa 1000 ký tự.');
    }

    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Sự kiện không tồn tại.');

    if (new Date(event.endTime) > new Date()) {
      throw new BadRequestException('Chỉ có thể đánh giá sau khi sự kiện kết thúc.');
    }

    const hasTicket = await this.reservationRepository.findOne({
      where: {
        user: { id: userId },
        ticket: { event: { id: eventId } },
        status: 'CONFIRMED',
      },
      relations: ['ticket', 'ticket.event'],
    });

    if (!hasTicket) {
      throw new ForbiddenException('Bạn cần có vé đã xác nhận để đánh giá sự kiện này.');
    }

    const existing = await this.reviewRepository.findOne({
      where: { user: { id: userId }, event: { id: eventId } },
    });

    if (existing) {
      throw new BadRequestException('Bạn đã đánh giá sự kiện này rồi.');
    }

    const review = this.reviewRepository.create({
      user: { id: userId } as any,
      event: { id: eventId } as any,
      rating,
      comment: comment.trim(),
    });

    await this.reviewRepository.save(review);

    return this.reviewRepository.findOne({
      where: { id: review.id },
      relations: ['user'],
    });
  }

  async getByEvent(eventId: number) {
    const reviews = await this.reviewRepository.find({
      where: { event: { id: eventId } },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    const total = reviews.length;
    const avgRating = total > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / total
      : 0;

    return {
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        user: {
          id: r.user.id,
          name: r.user.name,
          email: r.user.email,
          avatarUrl: r.user.avatarUrl,
        },
      })),
      total,
      avgRating: Math.round(avgRating * 10) / 10,
    };
  }

  async delete(reviewId: number, userId: number) {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
      relations: ['user'],
    });

    if (!review) throw new NotFoundException('Đánh giá không tồn tại.');
    if (review.user.id !== userId) {
      throw new ForbiddenException('Bạn không thể xoá đánh giá của người khác.');
    }

    await this.reviewRepository.remove(review);
    return { message: 'Đã xoá đánh giá.' };
  }
}
