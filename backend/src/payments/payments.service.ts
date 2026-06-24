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

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,

    @InjectRepository(Seat)
    private seatRepository: Repository<Seat>,

    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,

    @InjectRepository(User)
    private userRepository: Repository<User>,

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
    userId: number,
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
      if (r.user.id !== userId) {
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

    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });
    const payment = this.paymentRepository.create({
      orderId,
      provider,
      amount: totalAmount,
      status: 'PENDING',
      reservationIds,
      user: user as User,
    });
    await this.paymentRepository.save(payment);

    return { totalAmount, count: reservations.length };
  }

  async createVnpayPaymentUrl(
    reservationIds: number[],
    userId: number,
    ipAddr: string,
  ) {
    const orderId = `VTX${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const { totalAmount, count } = await this.validateAndCreatePayment(
      reservationIds,
      userId,
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
    userId: number,
    requestType?: string,
  ) {
    const orderId = `VTX${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const { totalAmount, count } = await this.validateAndCreatePayment(
      reservationIds,
      userId,
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

    payment.vnpTransactionNo = momoParams.transId || '';
    payment.responseCode = String(momoParams.resultCode);

    if (Number(momoParams.resultCode) === 0) {
      payment.status = 'SUCCESS';
      await this.paymentRepository.save(payment);
      await this.confirmReservations(payment.reservationIds, payment.user.id, payment);
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
        payment.user.id,
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
      if (userId && reservation.user.id !== userId) continue;
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
      const userEmail = confirmed[0].user?.email;
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

  // --- Legacy mock endpoints (giữ lại để backward-compatible) ---

  async confirmBulkPayment(reservationIds: number[], userId: number) {
    const results: any[] = [];
    for (const id of reservationIds) {
      results.push(await this.confirmPayment(id, userId));
    }
    return {
      message: `Đã thanh toán ${results.length} vé.`,
      reservations: results.map((r: any) => r.reservation),
    };
  }

  async confirmPayment(reservationId: number, userId: number) {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
      relations: ['ticket', 'ticket.event', 'seat', 'user'],
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.user.id !== userId) {
      throw new ForbiddenException('Not your reservation');
    }

    if (reservation.status !== 'HOLD') {
      throw new BadRequestException('Reservation already processed');
    }

    reservation.status = 'CONFIRMED';
    await this.reservationRepository.save(reservation);

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
    return { message: 'Payment confirmed', reservation: rest };
  }
}
