import {
  Injectable,
} from '@nestjs/common';

import {
  Cron,
} from '@nestjs/schedule';

import {
  InjectRepository,
} from '@nestjs/typeorm';

import {
  LessThan,
  Repository,
} from 'typeorm';

import { Reservation } from './entities/reservation.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Seat } from '../tickets/entities/seat.entity';
import { TicketGateway } from '../websocket/gateways/ticket.gateway';

@Injectable()
export class ReservationExpirationService {
  constructor(
  @InjectRepository(Reservation)
  private reservationRepository:
    Repository<Reservation>,

  @InjectRepository(Ticket)
  private ticketRepository:
    Repository<Ticket>,

  @InjectRepository(Seat)
  private seatRepository:
    Repository<Seat>,

  private ticketGateway: TicketGateway,
) {}

    @Cron('*/1 * * * *')
  async handleExpiredReservations() {
    console.log(
      'Checking expired reservations...',
    );
    const expiredReservations =
      await this.reservationRepository.find({
        where: {
          status: 'HOLD',
          expiresAt: LessThan(new Date()),
        },

        relations: ['ticket', 'ticket.event', 'seat'],
      });

    for (const reservation of expiredReservations) {
      reservation.status = 'EXPIRED';

      await this.reservationRepository.save(
        reservation,
      );

      reservation.ticket.quantity += 1;

      await this.ticketRepository.save(
        reservation.ticket,
      );

      // Only emit if event is loaded
      if (reservation.ticket.event?.id) {
        this.ticketGateway.emitTicketUpdate(
          String(reservation.ticket.event.id),
          reservation.ticket.id,
          reservation.ticket.quantity,
        );
      }

      if (reservation.seat) {
        reservation.seat.status = 'AVAILABLE';

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

      console.log(
        `Reservation ${reservation.id} expired`,
      );
    }
  }
}