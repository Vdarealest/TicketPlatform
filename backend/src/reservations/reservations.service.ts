import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import {
  InjectRepository,
} from '@nestjs/typeorm';

import {
  Repository,
  DataSource,
} from 'typeorm';

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';

import { Reservation } from './entities/reservation.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Seat } from '../tickets/entities/seat.entity';
import { TicketGateway } from '../websocket/gateways/ticket.gateway';
import { effectiveSaleStatus } from '../events/event-status.util';
import { Requester, ownsReservation } from './reservation-ownership.util';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,

    @InjectQueue('reservation-expiration')
    private reservationQueue: Queue,

    private dataSource: DataSource,

    private ticketGateway: TicketGateway,
  ) {}

  async reserveMultipleSeats(
    ticketId: number,
    seatIds: number[],
    requester: { userId?: number; guestEmail?: string },
  ) {
    if (!seatIds.length || seatIds.length > 10) {
      throw new BadRequestException('Chọn từ 1 đến 10 ghế.');
    }

    const userId = requester.userId;
    let guestEmail: string | null = null;
    let guestToken: string | null = null;
    if (!userId) {
      const email = requester.guestEmail?.trim();
      if (!email || !EMAIL_RE.test(email)) {
        throw new BadRequestException('Vui lòng nhập email hợp lệ để đặt vé không cần đăng nhập.');
      }
      guestEmail = email;
      // Unguessable, single checkout batch worth of authority — this is the
      // only thing that lets the guest come back to pay/cancel/view later.
      guestToken = crypto.randomBytes(32).toString('hex');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const ticket = await queryRunner.manager
        .createQueryBuilder(Ticket, 'ticket')
        .innerJoinAndSelect('ticket.event', 'event')
        .setLock('pessimistic_write')
        .where('ticket.id = :id', { id: ticketId })
        .getOne();

      if (!ticket) throw new BadRequestException('Ticket not found');
      // Refuse to sell if the event isn't actually on sale (draft / upcoming).
      // Authoritative check — the frontend also hides the button, but never trust it.
      if (effectiveSaleStatus(ticket.event) !== 'ON_SALE') {
        throw new BadRequestException('Sự kiện này chưa mở bán.');
      }
      if (ticket.quantity < seatIds.length) {
        throw new BadRequestException(`Chỉ còn ${ticket.quantity} vé, không đủ cho ${seatIds.length} ghế.`);
      }

      const reservations: Reservation[] = [];

      for (const seatId of seatIds) {
        const seat = await queryRunner.manager
          .createQueryBuilder(Seat, 'seat')
          .setLock('pessimistic_write')
          .where('seat.id = :id AND seat.ticketId = :ticketId', { id: seatId, ticketId })
          .getOne();

        if (!seat) throw new BadRequestException(`Ghế #${seatId} không tồn tại.`);
        if (seat.status !== 'AVAILABLE') throw new BadRequestException(`Ghế ${seat.label} không còn trống.`);

        seat.status = 'HELD';
        await queryRunner.manager.save(seat);

        this.ticketGateway.emitSeatUpdate(
          String(ticket.event?.id ?? ''),
          ticket.id, seat.id, seat.status,
        );

        const reservation = this.reservationRepository.create({
          user: userId ? ({ id: userId } as any) : null,
          guestEmail,
          guestToken,
          ticket: { id: ticketId } as any,
          seat: { id: seat.id } as any,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          status: 'HOLD',
        });
        await queryRunner.manager.save(reservation);
        reservations.push(reservation);

        await this.reservationQueue.add(
          'expire-reservation',
          { reservationId: reservation.id },
          { delay: 5 * 60 * 1000 },
        );
      }

      ticket.quantity -= seatIds.length;
      await queryRunner.manager.save(ticket);

      this.ticketGateway.emitTicketUpdate(
        String(ticket.event?.id ?? ''),
        ticket.id, ticket.quantity,
      );

      await queryRunner.commitTransaction();

      return {
        message: `Đã giữ ${seatIds.length} ghế.`,
        reservationIds: reservations.map((r) => r.id),
        expiresAt: reservations[0]?.expiresAt,
        // Only present for guest checkouts — the frontend must hold onto this
        // to prove ownership on every later call (details/pay/cancel).
        guestToken: guestToken ?? undefined,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getMultipleReservations(ids: number[], requester: Requester) {
    const reservations = await this.reservationRepository.find({
      where: ids.map((id) => ({ id })),
      relations: ['ticket', 'ticket.event', 'seat', 'user'],
    });

    for (const r of reservations) {
      if (!ownsReservation(r, requester)) throw new ForbiddenException('Not your reservation');
    }

    return reservations.map(({ user, guestToken, ...rest }) => rest);
  }

  async cancelMultipleReservations(ids: number[], requester: Requester) {
    const results: any[] = [];
    for (const id of ids) {
      results.push(await this.cancelReservation(id, requester));
    }
    return results;
  }

  async getMyReservations(
    userId: number,
  ) {
    return this.reservationRepository.find(
      {
        where: {
          user: {
            id: userId,
          },
        },

        relations: [
          'ticket',
          'ticket.event',
          'seat',
        ],

        order: {
          createdAt: 'DESC',
        },
      },
    );
  }

  async getReservation(
    reservationId: number,
    requester: Requester,
  ) {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
      relations: ['ticket', 'ticket.event', 'seat', 'user'],
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (!ownsReservation(reservation, requester)) {
      throw new ForbiddenException('Not your reservation');
    }

    const { user, guestToken, ...rest } = reservation;
    return rest;
  }

  async cancelReservation(
    reservationId: number,
    requester: Requester,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const reservation = await queryRunner.manager.findOne(Reservation, {
        where: { id: reservationId },
        relations: ['ticket', 'ticket.event', 'seat', 'user'],
      });

      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      if (!ownsReservation(reservation, requester)) {
        throw new ForbiddenException('Not your reservation');
      }

      if (reservation.status !== 'HOLD') {
        await queryRunner.commitTransaction();
        const { user, guestToken, ...rest } = reservation;
        return { message: 'Reservation already processed', reservation: rest };
      }

      reservation.status = 'EXPIRED';
      await queryRunner.manager.save(reservation);

      reservation.ticket.quantity += 1;
      await queryRunner.manager.save(reservation.ticket);

      this.ticketGateway.emitTicketUpdate(
        String(reservation.ticket.event?.id ?? ''),
        reservation.ticket.id,
        reservation.ticket.quantity,
      );

      if (reservation.seat) {
        reservation.seat.status = 'AVAILABLE';
        await queryRunner.manager.save(reservation.seat);

        this.ticketGateway.emitSeatUpdate(
          String(reservation.ticket.event?.id ?? ''),
          reservation.ticket.id,
          reservation.seat.id,
          reservation.seat.status,
        );
      }

      await queryRunner.commitTransaction();

      const { user, guestToken, ...rest } = reservation;
      return { message: 'Reservation cancelled', reservation: rest };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}