import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Request,
  UseGuards,
  Ip,
} from '@nestjs/common';

import { PaymentsService } from './payments.service';
import type { OptionalAuthRequest } from '../auth/auth-request';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import {
  ConfirmVietQRDto,
  CreateMomoPaymentDto,
  CreatePaymentDto,
} from './dto/payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // All create/confirm endpoints below accept either a logged-in user (JWT)
  // or a guest carrying the guestToken from their reservation — see
  // OptionalJwtAuthGuard and Requester/ownsReservation for the enforcement.

  // ── VNPay endpoints ──

  @Post('vnpay/create-url')
  @UseGuards(OptionalJwtAuthGuard)
  createVnpayUrl(
    @Body() body: CreatePaymentDto,
    @Request() req: OptionalAuthRequest,
    @Ip() ip: string,
  ) {
    // Behind Render's proxy the client is the first x-forwarded-for entry.
    // Node gives a repeated header as an array; take its first value.
    const forwarded = req.headers['x-forwarded-for'];
    const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const clientIp = firstForwarded?.split(',')[0]?.trim() || ip || '127.0.0.1';
    return this.paymentsService.createVnpayPaymentUrl(
      body.reservationIds,
      { userId: req.user?.userId, guestToken: body.guestToken },
      clientIp,
    );
  }

  @Get('vnpay/ipn')
  handleVnpayIpn(@Query() query: Record<string, string>) {
    return this.paymentsService.handleVnpayIpn(query);
  }

  @Get('vnpay/return')
  handleVnpayReturn(@Query() query: Record<string, string>) {
    return this.paymentsService.handleVnpayReturn(query);
  }

  // ── MoMo endpoints ──

  @Post('momo/create-url')
  @UseGuards(OptionalJwtAuthGuard)
  createMomoUrl(
    @Body() body: CreateMomoPaymentDto,
    @Request() req: OptionalAuthRequest,
  ) {
    return this.paymentsService.createMomoPaymentUrl(
      body.reservationIds,
      { userId: req.user?.userId, guestToken: body.guestToken },
      body.requestType,
    );
  }

  // MoMo gọi IPN bằng POST (JSON)
  @Post('momo/ipn')
  handleMomoIpn(@Body() body: Record<string, string>) {
    return this.paymentsService.handleMomoIpn(body);
  }

  // Frontend gửi query params từ redirect của MoMo lên để verify
  @Get('momo/return')
  handleMomoReturn(@Query() query: Record<string, string>) {
    return this.paymentsService.handleMomoReturn(query);
  }

  // Lets checkout hide methods the server would refuse anyway.
  @Get('methods')
  getMethods() {
    return { vietqr: this.paymentsService.isVietQREnabled() };
  }

  // ── VietQR (test-friendly, no redirect) ──

  @Post('vietqr/create')
  @UseGuards(OptionalJwtAuthGuard)
  createVietQR(
    @Body() body: CreatePaymentDto,
    @Request() req: OptionalAuthRequest,
  ) {
    return this.paymentsService.createVietQR(body.reservationIds, {
      userId: req.user?.userId,
      guestToken: body.guestToken,
    });
  }

  @Post('vietqr/confirm')
  @UseGuards(OptionalJwtAuthGuard)
  confirmVietQR(
    @Body() body: ConfirmVietQRDto,
    @Request() req: OptionalAuthRequest,
  ) {
    return this.paymentsService.confirmVietQR(body.orderId, {
      userId: req.user?.userId,
      guestToken: body.guestToken,
    });
  }
}
