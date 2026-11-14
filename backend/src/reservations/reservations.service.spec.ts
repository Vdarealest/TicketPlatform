import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Seat } from '../tickets/entities/seat.entity';

type Row = Record<string, any>;
const HOUR = 60 * 60 * 1000;

function onSaleEvent(over: Row = {}) {
  return {
    id: 5,
    status: 'ON_SALE',
    saleOpenAt: null,
    endTime: new Date(Date.now() + HOUR),
    ...over,
  };
}

/**
 * A fake TypeORM query runner. Lock queries for Ticket return `ticket`; lock
 * queries for Seat look the id up in `seats` (and enforce the ticketId filter
 * the real query applies). Records whether the transaction committed or
 * rolled back, which is the property these tests care about most.
 */
function setup(
  opts: { ticket?: Row | null; seats?: Row[]; findOne?: Row | null } = {},
) {
  const seats = new Map((opts.seats ?? []).map((s) => [s.id, s]));
  let nextId = 1;
  const saved: Row[] = [];

  const qb = (entity: unknown) => {
    let params: Row = {};
    const b: any = {
      innerJoinAndSelect: () => b,
      setLock: (mode: string) => {
        b.lock = mode;
        return b;
      },
      where: (_sql: string, p: Row) => {
        params = p;
        return b;
      },
      getOne: async () => {
        if (b.lock !== 'pessimistic_write')
          throw new Error('row read without a write lock');
        if (entity === Ticket) return opts.ticket ?? null;
        if (entity === Seat) {
          const s = seats.get(params.id);
          return s && s.ticketId === params.ticketId ? s : null;
        }
        return null;
      },
    };
    return b;
  };

  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn((entity: unknown) => qb(entity)),
      save: jest.fn(async (x: Row) => {
        if (x.expiresAt && !x.id) x.id = nextId++;
        saved.push(x);
        return x;
      }),
      findOne: jest.fn(async () => opts.findOne ?? null),
    },
  };

  const reservationRepo = {
    create: jest.fn((x: Row) => ({ ...x })),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const queue = { add: jest.fn() };
  const dataSource = { createQueryRunner: () => queryRunner };
  const gateway = { emitSeatUpdate: jest.fn(), emitTicketUpdate: jest.fn() };

  const service = new ReservationsService(
    reservationRepo as any,
    queue as any,
    dataSource as any,
    gateway as any,
  );
  return { service, queryRunner, reservationRepo, queue, gateway, saved };
}

const seat = (id: number, over: Row = {}) => ({
  id,
  ticketId: 10,
  label: `A${id}`,
  status: 'AVAILABLE',
  ...over,
});
const ticket = (over: Row = {}) => ({
  id: 10,
  quantity: 5,
  seating: 'SEATED',
  event: onSaleEvent(),
  ...over,
});

describe('ReservationsService', () => {
  describe('reserveMultipleSeats', () => {
    it('holds the seats, decrements stock and schedules expiry, then commits', async () => {
      const t = ticket();
      const s1 = seat(1);
      const s2 = seat(2);
      const { service, queryRunner, queue, gateway } = setup({
        ticket: t,
        seats: [s1, s2],
      });

      const res = await service.reserveMultipleSeats(10, [1, 2], { userId: 7 });

      expect(s1.status).toBe('HELD');
      expect(s2.status).toBe('HELD');
      expect(t.quantity).toBe(3);
      expect(res.reservationIds).toHaveLength(2);
      expect(res.guestToken).toBeUndefined();
      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenCalledWith(
        'expire-reservation',
        expect.any(Object),
        { delay: 5 * 60 * 1000 },
      );
      expect(gateway.emitTicketUpdate).toHaveBeenCalledWith('5', 10, 3);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('expires holds after five minutes', async () => {
      const { service } = setup({ ticket: ticket(), seats: [seat(1)] });
      const before = Date.now();
      const res = await service.reserveMultipleSeats(10, [1], { userId: 7 });
      const ms = new Date(res.expiresAt).getTime() - before;
      expect(ms).toBeGreaterThanOrEqual(5 * 60 * 1000 - 50);
      expect(ms).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);
    });

    it.each([[[]], [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]]])(
      'rejects %j seats before opening a transaction',
      async (ids) => {
        const { service, queryRunner } = setup({ ticket: ticket() });
        await expect(
          service.reserveMultipleSeats(10, ids, { userId: 7 }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      },
    );

    it('requires a valid email from guests and hands them an unguessable token', async () => {
      const { service } = setup({ ticket: ticket(), seats: [seat(1)] });
      await expect(
        service.reserveMultipleSeats(10, [1], {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.reserveMultipleSeats(10, [1], { guestEmail: 'not-an-email' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const res = await service.reserveMultipleSeats(10, [1], {
        guestEmail: '  guest@example.com ',
      });
      expect(res.guestToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rolls back when one of the seats is already taken, leaving stock untouched', async () => {
      const t = ticket();
      const s1 = seat(1);
      const { service, queryRunner } = setup({
        ticket: t,
        seats: [s1, seat(2, { status: 'BOOKED' })],
      });

      await expect(
        service.reserveMultipleSeats(10, [1, 2], { userId: 7 }),
      ).rejects.toThrow('A2');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(t.quantity).toBe(5);
    });

    it('rejects a seat that belongs to a different ticket type', async () => {
      const { service, queryRunner } = setup({
        ticket: ticket(),
        seats: [seat(1, { ticketId: 99 })],
      });
      await expect(
        service.reserveMultipleSeats(10, [1], { userId: 7 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('rejects when fewer tickets remain than seats requested', async () => {
      const { service, queryRunner } = setup({
        ticket: ticket({ quantity: 1 }),
        seats: [seat(1), seat(2)],
      });
      await expect(
        service.reserveMultipleSeats(10, [1, 2], { userId: 7 }),
      ).rejects.toThrow('Chỉ còn 1 vé');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it.each([
      ['a draft event', { status: 'DRAFT' }, 'chưa mở bán'],
      [
        'an upcoming event',
        { status: 'UPCOMING', saleOpenAt: new Date(Date.now() + HOUR) },
        'chưa mở bán',
      ],
      [
        'an event that has ended',
        { endTime: new Date(Date.now() - HOUR) },
        'đã kết thúc',
      ],
    ])('refuses to sell for %s', async (_label, eventOver, message) => {
      const { service, queryRunner } = setup({
        ticket: ticket({ event: onSaleEvent(eventOver) }),
        seats: [seat(1)],
      });
      await expect(
        service.reserveMultipleSeats(10, [1], { userId: 7 }),
      ).rejects.toThrow(message);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('rejects an unknown ticket', async () => {
      const { service, queryRunner } = setup({ ticket: null });
      await expect(
        service.reserveMultipleSeats(10, [1], { userId: 7 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('reserveGeneralAdmission', () => {
    it('holds N standing tickets without seats', async () => {
      const t = ticket({ seating: 'GENERAL', quantity: 4 });
      const { service, queryRunner, reservationRepo } = setup({ ticket: t });

      const res = await service.reserveGeneralAdmission(10, 3, { userId: 7 });

      expect(res.reservationIds).toHaveLength(3);
      expect(t.quantity).toBe(1);
      expect(reservationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ seat: null, status: 'HOLD' }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('refuses seated tickets (they must go through the seat map)', async () => {
      const { service, queryRunner } = setup({
        ticket: ticket({ seating: 'SEATED' }),
      });
      await expect(
        service.reserveGeneralAdmission(10, 1, { userId: 7 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it.each([0, 11, 1.5])('rejects quantity %p', async (q) => {
      const { service, queryRunner } = setup({
        ticket: ticket({ seating: 'GENERAL' }),
      });
      await expect(
        service.reserveGeneralAdmission(10, q, { userId: 7 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('rejects when not enough stock remains', async () => {
      const { service } = setup({
        ticket: ticket({ seating: 'GENERAL', quantity: 2 }),
      });
      await expect(
        service.reserveGeneralAdmission(10, 3, { userId: 7 }),
      ).rejects.toThrow('Chỉ còn 2 vé');
    });
  });

  describe('cancelReservation', () => {
    const held = (over: Row = {}) => ({
      id: 1,
      status: 'HOLD',
      user: { id: 7 },
      guestToken: null,
      ticket: { id: 10, quantity: 3, event: { id: 5 } },
      seat: { id: 100, status: 'HELD' },
      ...over,
    });

    it('releases the seat and returns the ticket to stock', async () => {
      const r = held();
      const { service, queryRunner, gateway } = setup({ findOne: r });

      const res = await service.cancelReservation(1, { userId: 7 });

      expect(res.message).toBe('Reservation cancelled');
      expect(r.status).toBe('EXPIRED');
      expect(r.ticket.quantity).toBe(4);
      expect(r.seat.status).toBe('AVAILABLE');
      expect(gateway.emitSeatUpdate).toHaveBeenCalledWith(
        '5',
        10,
        100,
        'AVAILABLE',
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(res.reservation).not.toHaveProperty('guestToken');
      expect(res.reservation).not.toHaveProperty('user');
    });

    it('does not restock twice for a reservation already processed', async () => {
      const r = held({ status: 'CONFIRMED' });
      const { service, queryRunner } = setup({ findOne: r });

      const res = await service.cancelReservation(1, { userId: 7 });

      expect(res.message).toBe('Reservation already processed');
      expect(r.ticket.quantity).toBe(3);
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });

    it("refuses to cancel someone else's hold", async () => {
      const r = held();
      const { service, queryRunner } = setup({ findOne: r });
      await expect(
        service.cancelReservation(1, { userId: 8 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(r.ticket.quantity).toBe(3);
    });

    it('lets a guest cancel with the matching token only', async () => {
      const { service } = setup({
        findOne: held({ user: null, guestToken: 'tok' }),
      });
      await expect(
        service.cancelReservation(1, { guestToken: 'nope' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.cancelReservation(1, { guestToken: 'tok' }),
      ).resolves.toMatchObject({ message: 'Reservation cancelled' });
    });
  });

  describe('reading reservations', () => {
    it('strips the guest token and user from what it returns', async () => {
      const { service, reservationRepo } = setup();
      reservationRepo.find.mockResolvedValue([
        { id: 1, user: null, guestToken: 'tok', status: 'HOLD' },
      ]);
      const [r] = await service.getMultipleReservations([1], {
        guestToken: 'tok',
      });
      expect(r).toEqual({ id: 1, status: 'HOLD' });
    });

    it('refuses the whole batch if any reservation is not yours', async () => {
      const { service, reservationRepo } = setup();
      reservationRepo.find.mockResolvedValue([
        { id: 1, user: { id: 7 }, guestToken: null },
        { id: 2, user: { id: 8 }, guestToken: null },
      ]);
      await expect(
        service.getMultipleReservations([1, 2], { userId: 7 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
