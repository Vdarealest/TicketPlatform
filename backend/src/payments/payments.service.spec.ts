import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';

type Row = Record<string, any>;

function repo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(async (x) => x),
    create: jest.fn((x) => ({ ...x })),
  };
}

function setup() {
  const reservationRepo = repo();
  const seatRepo = repo();
  const paymentRepo = repo();
  const gateway = { emitSeatUpdate: jest.fn(), emitTicketUpdate: jest.fn() };
  const vnpay = {
    createPaymentUrl: jest.fn(() => 'https://vnpay/pay'),
    verifyIpn: jest.fn(),
    verifyReturnUrl: jest.fn(),
  };
  const momo = {
    createPayment: jest.fn(async () => ({ payUrl: 'https://momo/pay' })),
    verifySignature: jest.fn(),
  };
  const mail = {
    sendTicketConfirmation: jest.fn(
      async (_data: { to: string; tickets: unknown[] }) => undefined,
    ),
  };
  const service = new PaymentsService(
    reservationRepo as any,
    seatRepo as any,
    paymentRepo as any,
    gateway as any,
    vnpay as any,
    momo as any,
    mail as any,
  );
  return {
    service,
    reservationRepo,
    seatRepo,
    paymentRepo,
    gateway,
    vnpay,
    momo,
    mail,
  };
}

function holdReservation(id: number, over: Row = {}): Row {
  return {
    id,
    status: 'HOLD',
    user: { id: 1, email: 'buyer@example.com' },
    guestToken: null,
    ticket: {
      id: 10,
      price: 100000,
      type: 'VIP',
      event: { id: 5, title: 'Show', location: 'HN', startTime: new Date() },
    },
    seat: { id: 100 + id, label: `A${id}`, status: 'HELD' },
    ...over,
  };
}

const pendingPayment = (over: Row = {}): Row => ({
  orderId: 'VTX1',
  provider: 'VNPAY',
  amount: 200000,
  status: 'PENDING',
  reservationIds: [1, 2],
  user: { id: 1 },
  ...over,
});

const okIpn = (over: Row = {}) => ({
  isValid: true,
  responseCode: '00',
  txnRef: 'VTX1',
  amount: 200000,
  transactionNo: 'T1',
  bankCode: 'NCB',
  bankTranNo: 'B1',
  cardType: 'ATM',
  payDate: '20261114120000',
  ...over,
});

describe('PaymentsService', () => {
  const OLD_FLAG = process.env.VIETQR_MANUAL_CONFIRM;
  afterEach(() => {
    if (OLD_FLAG === undefined) delete process.env.VIETQR_MANUAL_CONFIRM;
    else process.env.VIETQR_MANUAL_CONFIRM = OLD_FLAG;
  });

  describe('creating a payment', () => {
    it('charges the sum of the ticket prices and records a PENDING payment', async () => {
      const { service, reservationRepo, paymentRepo, vnpay } = setup();
      reservationRepo.find.mockResolvedValue([
        holdReservation(1),
        holdReservation(2),
      ]);
      paymentRepo.find.mockResolvedValue([]);

      const res = await service.createVnpayPaymentUrl(
        [1, 2],
        { userId: 1 },
        '1.2.3.4',
      );

      expect(res.paymentUrl).toBe('https://vnpay/pay');
      expect(vnpay.createPaymentUrl).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 200000, orderId: res.orderId }),
      );
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: res.orderId,
          amount: 200000,
          status: 'PENDING',
          provider: 'VNPAY',
        }),
      );
    });

    it('refuses when a reservation id does not exist', async () => {
      const { service, reservationRepo } = setup();
      reservationRepo.find.mockResolvedValue([holdReservation(1)]);
      await expect(
        service.createVnpayPaymentUrl([1, 2], { userId: 1 }, ''),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses to pay for someone else's reservation", async () => {
      const { service, reservationRepo, paymentRepo } = setup();
      reservationRepo.find.mockResolvedValue([
        holdReservation(1, { user: { id: 99 } }),
      ]);
      await expect(
        service.createVnpayPaymentUrl([1], { userId: 1 }, ''),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('refuses reservations that are no longer on hold', async () => {
      const { service, reservationRepo } = setup();
      reservationRepo.find.mockResolvedValue([
        holdReservation(1, { status: 'EXPIRED' }),
      ]);
      await expect(
        service.createVnpayPaymentUrl([1], { userId: 1 }, ''),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cancels an earlier pending payment for the same seats (no double charge)', async () => {
      const { service, reservationRepo, paymentRepo } = setup();
      reservationRepo.find.mockResolvedValue([
        holdReservation(1),
        holdReservation(2),
      ]);
      const stale = {
        orderId: 'OLD',
        status: 'PENDING',
        reservationIds: ['2'],
      };
      const unrelated = {
        orderId: 'OTHER',
        status: 'PENDING',
        reservationIds: ['42'],
      };
      paymentRepo.find.mockResolvedValue([stale, unrelated]);

      await service.createMomoPaymentUrl([1, 2], { userId: 1 });

      expect(stale.status).toBe('CANCELLED');
      expect(unrelated.status).toBe('PENDING');
    });
  });

  describe('VietQR flag', () => {
    it('is off unless VIETQR_MANUAL_CONFIRM is exactly "true"', () => {
      const { service } = setup();
      delete process.env.VIETQR_MANUAL_CONFIRM;
      expect(service.isVietQREnabled()).toBe(false);
      process.env.VIETQR_MANUAL_CONFIRM = '1';
      expect(service.isVietQREnabled()).toBe(false);
      process.env.VIETQR_MANUAL_CONFIRM = 'true';
      expect(service.isVietQREnabled()).toBe(true);
    });

    it('blocks creating and confirming VietQR orders when off', async () => {
      const { service, reservationRepo, paymentRepo } = setup();
      delete process.env.VIETQR_MANUAL_CONFIRM;
      await expect(
        service.createVietQR([1], { userId: 1 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.confirmVietQR('VTX1', { userId: 1 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(reservationRepo.find).not.toHaveBeenCalled();
      expect(paymentRepo.findOne).not.toHaveBeenCalled();
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('confirms a VietQR order when on', async () => {
      const { service, reservationRepo, paymentRepo } = setup();
      process.env.VIETQR_MANUAL_CONFIRM = 'true';
      paymentRepo.findOne.mockResolvedValue(
        pendingPayment({ provider: 'VIETQR', reservationIds: [1] }),
      );
      reservationRepo.findOne.mockResolvedValue(holdReservation(1));

      const res = await service.confirmVietQR('VTX1', { userId: 1 });

      expect(res.success).toBe(true);
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUCCESS' }),
      );
    });

    it("won't confirm a VNPay order through the VietQR endpoint", async () => {
      const { service, paymentRepo } = setup();
      process.env.VIETQR_MANUAL_CONFIRM = 'true';
      paymentRepo.findOne.mockResolvedValue(
        pendingPayment({ provider: 'VNPAY' }),
      );
      await expect(
        service.confirmVietQR('VTX1', { userId: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('VNPay IPN', () => {
    it('rejects an invalid signature without touching the database', async () => {
      const { service, vnpay, paymentRepo } = setup();
      vnpay.verifyIpn.mockReturnValue(okIpn({ isValid: false }));
      expect(await service.handleVnpayIpn({})).toEqual({
        RspCode: '97',
        Message: 'Invalid signature',
      });
      expect(paymentRepo.findOne).not.toHaveBeenCalled();
    });

    it('answers 01 for an unknown order', async () => {
      const { service, vnpay, paymentRepo } = setup();
      vnpay.verifyIpn.mockReturnValue(okIpn());
      paymentRepo.findOne.mockResolvedValue(null);
      expect((await service.handleVnpayIpn({})).RspCode).toBe('01');
    });

    it('answers 02 and changes nothing for an order already processed (retry-safe)', async () => {
      const { service, vnpay, paymentRepo } = setup();
      vnpay.verifyIpn.mockReturnValue(okIpn());
      paymentRepo.findOne.mockResolvedValue(
        pendingPayment({ status: 'SUCCESS' }),
      );
      expect((await service.handleVnpayIpn({})).RspCode).toBe('02');
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('answers 04 when the paid amount differs from what we charged', async () => {
      const { service, vnpay, paymentRepo } = setup();
      vnpay.verifyIpn.mockReturnValue(okIpn({ amount: 1000 }));
      paymentRepo.findOne.mockResolvedValue(pendingPayment());
      expect((await service.handleVnpayIpn({})).RspCode).toBe('04');
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('on success marks the payment paid, books the seats and emails the tickets', async () => {
      const {
        service,
        vnpay,
        paymentRepo,
        reservationRepo,
        seatRepo,
        gateway,
        mail,
      } = setup();
      vnpay.verifyIpn.mockReturnValue(okIpn());
      const payment = pendingPayment();
      paymentRepo.findOne.mockResolvedValue(payment);
      const r1 = holdReservation(1);
      const r2 = holdReservation(2);
      reservationRepo.findOne.mockImplementation(
        async ({ where }) => ({ 1: r1, 2: r2 })[where.id],
      );

      expect(await service.handleVnpayIpn({})).toEqual({
        RspCode: '00',
        Message: 'Confirm Success',
      });

      expect(payment.status).toBe('SUCCESS');
      expect(payment.vnpTransactionNo).toBe('T1');
      for (const r of [r1, r2]) {
        expect(r.status).toBe('CONFIRMED');
        expect(r.confirmationCode).toMatch(/^VTX-[0-9A-Z]+-[0-9A-F]{8}$/);
        expect(r.seat.status).toBe('BOOKED');
      }
      expect(r1.confirmationCode).not.toBe(r2.confirmationCode);
      expect(seatRepo.save).toHaveBeenCalledTimes(2);
      expect(gateway.emitSeatUpdate).toHaveBeenCalledWith(
        '5',
        10,
        101,
        'BOOKED',
      );
      expect(mail.sendTicketConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'buyer@example.com',
          orderId: 'VTX1',
          totalAmount: 200000,
        }),
      );
      expect(mail.sendTicketConfirmation.mock.calls[0][0].tickets).toHaveLength(
        2,
      );
    });

    it('skips reservations that expired before the payment landed', async () => {
      const { service, vnpay, paymentRepo, reservationRepo, mail } = setup();
      vnpay.verifyIpn.mockReturnValue(okIpn());
      paymentRepo.findOne.mockResolvedValue(
        pendingPayment({ reservationIds: [1] }),
      );
      const expired = holdReservation(1, { status: 'EXPIRED' });
      reservationRepo.findOne.mockResolvedValue(expired);

      await service.handleVnpayIpn({});

      expect(expired.status).toBe('EXPIRED');
      expect(mail.sendTicketConfirmation).not.toHaveBeenCalled();
    });

    it('marks the payment FAILED on a non-00 response and books nothing', async () => {
      const { service, vnpay, paymentRepo, reservationRepo } = setup();
      vnpay.verifyIpn.mockReturnValue(okIpn({ responseCode: '24' }));
      const payment = pendingPayment();
      paymentRepo.findOne.mockResolvedValue(payment);

      expect((await service.handleVnpayIpn({})).RspCode).toBe('00');
      expect(payment.status).toBe('FAILED');
      expect(reservationRepo.findOne).not.toHaveBeenCalled();
    });

    it('emails guest buyers at their checkout address', async () => {
      const { service, vnpay, paymentRepo, reservationRepo, mail } = setup();
      vnpay.verifyIpn.mockReturnValue(okIpn());
      paymentRepo.findOne.mockResolvedValue(
        pendingPayment({ user: null, reservationIds: [1] }),
      );
      reservationRepo.findOne.mockResolvedValue(
        holdReservation(1, {
          user: null,
          guestEmail: 'guest@example.com',
          guestToken: 't',
        }),
      );

      await service.handleVnpayIpn({});

      expect(mail.sendTicketConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'guest@example.com' }),
      );
    });

    it('a failing confirmation email neither fails the payment nor goes unhandled', async () => {
      const { service, vnpay, paymentRepo, reservationRepo, mail } = setup();
      vnpay.verifyIpn.mockReturnValue(okIpn());
      paymentRepo.findOne.mockResolvedValue(
        pendingPayment({ reservationIds: [1] }),
      );
      reservationRepo.findOne.mockResolvedValue(holdReservation(1));
      mail.sendTicketConfirmation.mockRejectedValueOnce(new Error('QR failed'));
      const errorLog = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const unhandled = jest.fn();
      process.on('unhandledRejection', unhandled);

      try {
        expect((await service.handleVnpayIpn({})).RspCode).toBe('00');
        await new Promise((r) => setImmediate(r));
        expect(unhandled).not.toHaveBeenCalled();
        expect(errorLog).toHaveBeenCalledWith(
          'Failed to send confirmation email:',
          expect.any(Error),
        );
      } finally {
        process.off('unhandledRejection', unhandled);
        errorLog.mockRestore();
      }
    });

    it('formats the emailed event time in Vietnam time, not the server zone', async () => {
      const { service, vnpay, paymentRepo, reservationRepo, mail } = setup();
      vnpay.verifyIpn.mockReturnValue(okIpn());
      paymentRepo.findOne.mockResolvedValue(
        pendingPayment({ reservationIds: [1] }),
      );
      const r = holdReservation(1);
      r.ticket.event.startTime = new Date('2026-12-12T12:00:00Z'); // 19:00 in Hanoi
      reservationRepo.findOne.mockResolvedValue(r);

      await service.handleVnpayIpn({});

      const sent = mail.sendTicketConfirmation.mock.calls[0][0] as {
        tickets: { eventDate: string }[];
      };
      expect(sent.tickets[0].eventDate).toContain('19:00');
    });
  });

  describe('MoMo IPN', () => {
    const params = {
      orderId: 'VTX1',
      amount: '200000',
      resultCode: '0',
      transId: 'M1',
    };

    it('rejects an invalid signature', async () => {
      const { service, momo, paymentRepo } = setup();
      momo.verifySignature.mockReturnValue(false);
      expect((await service.handleMomoIpn(params)).resultCode).toBe(97);
      expect(paymentRepo.findOne).not.toHaveBeenCalled();
    });

    it('rejects an amount mismatch', async () => {
      const { service, momo, paymentRepo } = setup();
      momo.verifySignature.mockReturnValue(true);
      paymentRepo.findOne.mockResolvedValue(pendingPayment());
      expect(
        (await service.handleMomoIpn({ ...params, amount: '1' })).resultCode,
      ).toBe(21);
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('confirms the reservations on resultCode 0', async () => {
      const { service, momo, paymentRepo, reservationRepo } = setup();
      momo.verifySignature.mockReturnValue(true);
      const payment = pendingPayment({ provider: 'MOMO', reservationIds: [1] });
      paymentRepo.findOne.mockResolvedValue(payment);
      const r = holdReservation(1);
      reservationRepo.findOne.mockResolvedValue(r);

      expect((await service.handleMomoIpn(params)).resultCode).toBe(0);
      expect(payment.status).toBe('SUCCESS');
      expect(r.status).toBe('CONFIRMED');
    });

    it('is idempotent for an order already processed', async () => {
      const { service, momo, paymentRepo } = setup();
      momo.verifySignature.mockReturnValue(true);
      paymentRepo.findOne.mockResolvedValue(
        pendingPayment({ status: 'SUCCESS' }),
      );
      expect(await service.handleMomoIpn(params)).toEqual({
        resultCode: 0,
        message: 'Already processed',
      });
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });
  });
});
