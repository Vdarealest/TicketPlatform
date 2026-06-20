import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import {
  InjectRepository,
} from '@nestjs/typeorm';

import {
  Repository,
} from 'typeorm';

import { Reservation }
from '../reservations/entities/reservation.entity';
import { Seat } from '../tickets/entities/seat.entity';
import { TicketGateway } from '../websocket/gateways/ticket.gateway';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepository:
      Repository<Reservation>,

    @InjectRepository(Seat)
    private seatRepository: Repository<Seat>,

    private ticketGateway: TicketGateway,
  ) {}

  async confirmPayment(
    reservationId: number,
    userId: number,
  ) {
    const reservation =
      await this.reservationRepository.findOne({
        where: { id: reservationId },
        relations: ['ticket', 'ticket.event', 'seat', 'user'],
      });

    if (!reservation) {
      throw new NotFoundException(
        'Reservation not found',
      );
    }

    if (reservation.user.id !== userId) {
      throw new ForbiddenException(
        'Not your reservation',
      );
    }

    if (reservation.status !== 'HOLD') {
      throw new BadRequestException(
        'Reservation already processed',
      );
    }

    reservation.status = 'CONFIRMED';

    await this.reservationRepository.save(
      reservation,
    );

    if (reservation.seat) {
      reservation.seat.status = 'BOOKED';

      await this.seatRepository.save(reservation.seat);

      if (reservation.ticket.event?.id) {
        this.ticketGateway.emitSeatUpdate(
          String(reservation.ticket.event.id),
          reservation.ticket.id,
          reservation.seat.id,
          reservation.seat.status,
        );
      }
    }

    const { user, ...rest } = reservation;

    return {
      message: 'Payment confirmed',
      reservation: rest,
    };
  }
}