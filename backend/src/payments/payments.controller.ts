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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  // All create/confirm endpoints below accept either a logged-in user (JWT)
  // or a guest carrying the guestToken from their reservation — see
  // OptionalJwtAuthGuard and Requester/ownsReservation for the enforcement.

  // ── VNPay endpoints ──

  @Post('vnpay/create-url')
  @UseGuards(OptionalJwtAuthGuard)
  createVnpayUrl(
    @Body() body: { reservationIds: number[]; guestToken?: string },
    @Request() req: any,
    @Ip() ip: string,
  ) {
    const clientIp =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      ip ||
      '127.0.0.1';
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
    @Body() body: { reservationIds: number[]; requestType?: string; guestToken?: string },
    @Request() req: any,
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
  createVietQR(@Body() body: { reservationIds: number[]; guestToken?: string }, @Request() req: any) {
    return this.paymentsService.createVietQR(
      body.reservationIds,
      { userId: req.user?.userId, guestToken: body.guestToken },
    );
  }

  @Post('vietqr/confirm')
  @UseGuards(OptionalJwtAuthGuard)
  confirmVietQR(@Body() body: { orderId: string; guestToken?: string }, @Request() req: any) {
    return this.paymentsService.confirmVietQR(
      body.orderId,
      { userId: req.user?.userId, guestToken: body.guestToken },
    );
  }
}
