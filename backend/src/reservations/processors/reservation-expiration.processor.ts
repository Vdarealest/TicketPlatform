import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Reservation } from '../entities/reservation.entity';
import { Ticket } from '../../tickets/entities/ticket.entity';
import { Seat } from '../../tickets/entities/seat.entity';
import { TicketGateway } from '../../websocket/gateways/ticket.gateway';

@Processor('reservation-expiration')
export class ReservationExpirationProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,

    @InjectRepository(Ticket)
    private ticketRepository: Repository<Ticket>,

    @InjectRepository(Seat)
    private seatRepository: Repository<Seat>,

    private ticketGateway: TicketGateway,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    console.log(
      '🔥 Processing reservation:',
      job.data.reservationId,
    );

    const reservation =
      await this.reservationRepository.findOne({
        where: {
          id: job.data.reservationId,
        },
        relations: [
          'ticket',
          'ticket.event',
          'seat',
        ],
      });

    if (!reservation) {
      return;
    }

    if (reservation.status !== 'HOLD') {
      return;
    }

    reservation.status = 'EXPIRED';

    await this.reservationRepository.save(
      reservation,
    );

    reservation.ticket.quantity += 1;

    await this.ticketRepository.save(
      reservation.ticket,
    );

    if (reservation.seat) {
      reservation.seat.status = 'AVAILABLE';

      await this.seatRepository.save(
        reservation.seat,
      );
    }

    // Emit realtime update
    if (reservation.ticket.event?.id) {
      this.ticketGateway.emitTicketUpdate(
        String(reservation.ticket.event.id),
        reservation.ticket.id,
        reservation.ticket.quantity,
      );

      if (reservation.seat) {
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