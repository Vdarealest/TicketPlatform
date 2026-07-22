import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as crypto from 'crypto';

import { Reservation } from '../reservations/entities/reservation.entity';
import { Seat } from '../tickets/entities/seat.entity';
import { Payment } from './entities/payment.entity';
import { User } from '../users/entities/user.entity';
import { TicketGateway } from '../websocket/gateways/ticket.gateway';
import { VnpayService } from './vnpay.service';
import { MomoService } from './momo.service';
import { MailService } from '../mail/mail.service';
import { Requester, ownsReservation } from '../reservations/reservation-ownership.util';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,

    @InjectRepository(Seat)
    private seatRepository: Repository<Seat>,

    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,

    private ticketGateway: TicketGateway,
    private vnpayService: VnpayService,
    private momoService: MomoService,
    private mailService: MailService,
  ) {}

  private generateConfirmationCode(): string {
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `VTX-${Date.now().toString(36).toUpperCase()}-${rand}`;
  }

  // Kiểm tra reservations hợp lệ + tạo bản ghi Payment PENDING, trả về { payment, count }
  private async validateAndCreatePayment(
    reservationIds: number[],
    requester: Requester,
    provider: string,
    orderId: string,
  ) {
    const reservations = await this.reservationRepository.find({
      where: { id: In(reservationIds) },
      relations: ['ticket', 'ticket.event', 'user'],
    });

    if (reservations.length !== reservationIds.length) {
      throw new NotFoundException('Một hoặc nhiều đơn đặt vé không tồn tại.');
    }

    for (const r of reservations) {
      if (!ownsReservation(r, requester)) {
        throw new ForbiddenException('Đơn đặt vé không thuộc về bạn.');
      }
      if (r.status !== 'HOLD') {
        throw new BadRequestException(
          `Đơn đặt vé #${r.id} đã được xử lý hoặc hết hạn.`,
        );
      }
    }

    const totalAmount = reservations.reduce(
      (sum, r) => sum + r.ticket.price,
      0,
    );

    // Supersede any earlier PENDING payment covering the same reservations
    // (e.g. user started VNPay then switched to MoMo). Only the newest payment
    // stays live, so completing an abandoned gateway session can't double-charge:
    // the stale payment is CANCELLED and the confirm handlers ignore it.
    // Scoped by reservation-id overlap rather than by user — ownership of
    // those ids was already verified above, guest or not.
    const idSet = new Set(reservationIds);
    const pendings = await this.paymentRepository.find({ where: { status: 'PENDING' } });
    const stale = pendings.filter((p) =>
      p.reservationIds.some((rid) => idSet.has(Number(rid))),
    );
    if (stale.length) {
      for (const p of stale) p.status = 'CANCELLED';
      await this.paymentRepository.save(stale);
    }

    const payment = this.paymentRepository.create({
      orderId,
      provider,
      amount: totalAmount,
      status: 'PENDING',
      reservationIds,
      user: requester.userId ? ({ id: requester.userId } as User) : null,
    });
    await this.paymentRepository.save(payment);

    return { totalAmount, count: reservations.length };
  }

  async createVnpayPaymentUrl(
    reservationIds: number[],
    requester: Requester,
    ipAddr: string,
  ) {
    const orderId = `VTX${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const { totalAmount, count } = await this.validateAndCreatePayment(
      reservationIds,
      requester,
      'VNPAY',
      orderId,
    );

    const paymentUrl = this.vnpayService.createPaymentUrl({
      orderId,
      amount: totalAmount,
      orderInfo: `Thanhtoan${count}ve_${orderId}`,
      ipAddr: ipAddr || '127.0.0.1',
    });

    return { paymentUrl, orderId };
  }

  async createMomoPaymentUrl(
    reservationIds: number[],
    requester: Requester,
    requestType?: string,
  ) {
    const orderId = `VTX${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const { totalAmount, count } = await this.validateAndCreatePayment(
      reservationIds,
      requester,
      'MOMO',
      orderId,
    );

    const { payUrl } = await this.momoService.createPayment({
      orderId,
      amount: totalAmount,
      orderInfo: `Thanh toan ${count} ve su kien`,
      requestType,
    });

    return { paymentUrl: payUrl, orderId };
  }

  // ── VietQR (test-friendly) ────────────────────────────────────────────────
  // Generates a real Napas-247 QR via the free img.vietqr.io service (no API
  // key). There is no automatic bank IPN here, so confirmVietQR is a MANUAL
  // confirm — great for fast local testing. For production you'd wire a bank
  // webhook (e.g. Casso / SePay) instead of trusting the client's "I paid".
  async createVietQR(reservationIds: number[], requester: Requester) {
    const orderId = `VTX${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const { totalAmount } = await this.validateAndCreatePayment(
      reservationIds,
      requester,
      'VIETQR',
      orderId,
    );

    const bankId = process.env.VIETQR_BANK_ID || '970422'; // 970422 = MB Bank
    const accountNo = process.env.VIETQR_ACCOUNT_NO || '0123456789';
    const accountName = process.env.VIETQR_ACCOUNT_NAME || 'VIETIX DEMO';
    const qrUrl =
      `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png` +
      `?amount=${totalAmount}` +
      `&addInfo=${encodeURIComponent(orderId)}` +
      `&accountName=${encodeURIComponent(accountName)}`;

    return { orderId, amount: totalAmount, qrUrl, bankId, accountNo, accountName };
  }

  async confirmVietQR(orderId: string, requester: Requester) {
    const payment = await this.paymentRepository.findOne({
      where: { orderId },
      relations: ['user'],
    });
    if (!payment) throw new NotFoundException('Không tìm thấy đơn thanh toán.');
    await this.assertOwnsPayment(payment, requester);
    if (payment.provider !== 'VIETQR') {
      throw new BadRequestException('Phương thức thanh toán không hợp lệ.');
    }
    if (payment.status === 'SUCCESS') {
      return {
        success: true,
        message: 'Đơn đã được thanh toán.',
        orderId,
        reservationIds: payment.reservationIds,
      };
    }
    if (payment.status !== 'PENDING') {
      throw new BadRequestException('Đơn thanh toán đã hết hạn hoặc bị hủy.');
    }

    payment.status = 'SUCCESS';
    await this.paymentRepository.save(payment);
    await this.confirmReservations(payment.reservationIds, requester.userId, payment);

    return {
      success: true,
      message: 'Thanh toán thành công!',
      orderId,
      amount: payment.amount,
      reservationIds: payment.reservationIds,
    };
  }

  // Payments don't carry a guestToken of their own — ownership of a guest
  // payment is derived from any one of its underlying reservations, which all
  // share the same guestToken from the checkout batch that created them.
  private async assertOwnsPayment(payment: Payment, requester: Requester) {
    if (payment.user) {
      if (payment.user.id !== requester.userId) {
        throw new ForbiddenException('Đơn thanh toán không thuộc về bạn.');
      }
      return;
    }
    const firstId = Number(payment.reservationIds[0]);
    const reservation = await this.reservationRepository.findOne({ where: { id: firstId } });
    if (!reservation || !ownsReservation(reservation, requester)) {
      throw new ForbiddenException('Đơn thanh toán không thuộc về bạn.');
    }
  }

  async handleMomoIpn(momoParams: Record<string, string>) {
    const isValid = this.momoService.verifySignature(momoParams);
    if (!isValid) {
      return { resultCode: 97, message: 'Invalid signature' };
    }

    const payment = await this.paymentRepository.findOne({
      where: { orderId: momoParams.orderId },
      relations: ['user'],
    });
    if (!payment) {
      return { resultCode: 1, message: 'Order not found' };
    }
    if (payment.status !== 'PENDING') {
      return { resultCode: 0, message: 'Already processed' };
    }

    // Defense-in-depth: the amount MoMo confirms must match what we charged.
    if (Number(momoParams.amount) !== Number(payment.amount)) {
      return { resultCode: 21, message: 'Invalid amount' };
    }

    payment.vnpTransactionNo = momoParams.transId || '';
    payment.responseCode = String(momoParams.resultCode);

    if (Number(momoParams.resultCode) === 0) {
      payment.status = 'SUCCESS';
      await this.paymentRepository.save(payment);
      await this.confirmReservations(payment.reservationIds, payment.user?.id, payment);
    } else {
      payment.status = 'FAILED';
      await this.paymentRepository.save(payment);
    }

    return { resultCode: 0, message: 'Confirm Success' };
  }

  async handleMomoReturn(momoParams: Record<string, string>) {
    const isValid = this.momoService.verifySignature(momoParams);
    if (!isValid) {
      return { success: false, message: 'Chữ ký không hợp lệ.' };
    }

    const payment = await this.paymentRepository.findOne({
      where: { orderId: momoParams.orderId },
      relations: ['user'],
    });
    if (!payment) {
      return { success: false, message: 'Không tìm thấy đơn thanh toán.' };
    }

    if (Number(momoParams.resultCode) === 0) {
      if (payment.status === 'PENDING') {
        if (Number(momoParams.amount) !== Number(payment.amount)) {
          return { success: false, message: 'Số tiền thanh toán không khớp.' };
        }
        payment.status = 'SUCCESS';
        payment.vnpTransactionNo = momoParams.transId || '';
        payment.responseCode = String(momoParams.resultCode);
        await this.paymentRepository.save(payment);
        await this.confirmReservations(payment.reservationIds, undefined, payment);
      }
      return {
        success: true,
        message: 'Thanh toán thành công!',
        orderId: payment.orderId,
        amount: payment.amount,
        reservationIds: payment.reservationIds,
      };
    }

    return {
      success: false,
      message: 'Thanh toán thất bại hoặc bị hủy.',
      responseCode: String(momoParams.resultCode),
    };
  }

  async handleVnpayIpn(vnpParams: Record<string, string>) {
    const result = this.vnpayService.verifyIpn(vnpParams);

    if (!result.isValid) {
      return { RspCode: '97', Message: 'Invalid signature' };
    }

    const payment = await this.paymentRepository.findOne({
      where: { orderId: result.txnRef },
      relations: ['user'],
    });

    if (!payment) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    if (payment.status !== 'PENDING') {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    const expectedAmount = payment.amount;
    if (result.amount !== expectedAmount) {
      return { RspCode: '04', Message: 'Invalid amount' };
    }

    payment.vnpTransactionNo = result.transactionNo;
    payment.bankCode = result.bankCode;
    payment.bankTranNo = result.bankTranNo;
    payment.cardType = result.cardType;
    payment.payDate = result.payDate;
    payment.responseCode = result.responseCode;

    if (result.responseCode === '00') {
      payment.status = 'SUCCESS';
      await this.paymentRepository.save(payment);
      await this.confirmReservations(
        payment.reservationIds,
        payment.user?.id,
        payment,
      );
      return { RspCode: '00', Message: 'Confirm Success' };
    } else {
      payment.status = 'FAILED';
      await this.paymentRepository.save(payment);
      return { RspCode: '00', Message: 'Confirm Success' };
    }
  }

  async handleVnpayReturn(vnpParams: Record<string, string>) {
    const result = this.vnpayService.verifyReturnUrl(vnpParams);

    if (!result.isValid) {
      return { success: false, message: 'Chữ ký không hợp lệ.' };
    }

    const orderId = vnpParams['vnp_TxnRef'];
    const payment = await this.paymentRepository.findOne({
      where: { orderId },
      relations: ['user'],
    });

    if (!payment) {
      return { success: false, message: 'Không tìm thấy đơn thanh toán.' };
    }

    if (result.responseCode === '00') {
      if (payment.status === 'PENDING') {
        payment.status = 'SUCCESS';
        payment.vnpTransactionNo = vnpParams['vnp_TransactionNo'] || '';
        payment.bankCode = vnpParams['vnp_BankCode'] || '';
        payment.responseCode = result.responseCode;
        await this.paymentRepository.save(payment);
        await this.confirmReservations(
          payment.reservationIds,
          undefined,
          payment,
        );
      }
      return {
        success: true,
        message: 'Thanh toán thành công!',
        orderId,
        amount: payment.amount,
        reservationIds: payment.reservationIds,
      };
    }

    return {
      success: false,
      message: 'Thanh toán thất bại hoặc bị hủy.',
      responseCode: result.responseCode,
    };
  }

  async getPaymentByOrderId(orderId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { orderId },
      relations: ['user'],
    });
    if (!payment) throw new NotFoundException('Không tìm thấy đơn thanh toán.');
    return payment;
  }

  private async confirmReservations(
    reservationIds: number[],
    userId?: number,
    payment?: Payment,
  ) {
    const confirmed: Reservation[] = [];

    for (const id of reservationIds) {
      const reservation = await this.reservationRepository.findOne({
        where: { id },
        relations: ['ticket', 'ticket.event', 'seat', 'user'],
      });

      if (!reservation) continue;
      if (userId && reservation.user?.id !== userId) continue;
      if (reservation.status !== 'HOLD') continue;

      reservation.status = 'CONFIRMED';
      reservation.confirmationCode = this.generateConfirmationCode();
      await this.reservationRepository.save(reservation);
      confirmed.push(reservation);

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
    }

    if (confirmed.length > 0 && payment) {
      // Guests have no account to check tickets on later — email is the
      // only delivery channel, so the fallback here isn't optional for them.
      const userEmail = confirmed[0].user?.email ?? confirmed[0].guestEmail;
      if (userEmail) {
        const fmtDate = (d: string) => {
          try {
            return new Date(d).toLocaleDateString('vi-VN', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            });
          } catch { return d; }
        };

        this.mailService.sendTicketConfirmation({
          to: userEmail,
          orderId: payment.orderId,
          totalAmount: Number(payment.amount),
          provider: payment.provider,
          tickets: confirmed.map((r) => ({
            confirmationCode: r.confirmationCode,
            eventTitle: r.ticket?.event?.title ?? 'Sự kiện',
            eventDate: fmtDate(r.ticket?.event?.startTime as any),
            eventLocation: r.ticket?.event?.location ?? '',
            ticketType: r.ticket?.type ?? '',
            seatLabel: r.seat?.label ?? null,
            price: Number(r.ticket?.price ?? 0),
          })),
        });
      }
    }
  }

}
