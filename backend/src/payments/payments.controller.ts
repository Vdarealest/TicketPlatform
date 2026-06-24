import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  Ip,
} from '@nestjs/common';

import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  // ── VNPay endpoints ──

  @Post('vnpay/create-url')
  @UseGuards(JwtAuthGuard)
  createVnpayUrl(
    @Body() body: { reservationIds: number[] },
    @Request() req: any,
    @Ip() ip: string,
  ) {
    const clientIp =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      ip ||
      '127.0.0.1';
    return this.paymentsService.createVnpayPaymentUrl(
      body.reservationIds,
      req.user.userId,
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
  @UseGuards(JwtAuthGuard)
  createMomoUrl(
    @Body() body: { reservationIds: number[]; requestType?: string },
    @Request() req: any,
  ) {
    return this.paymentsService.createMomoPaymentUrl(
      body.reservationIds,
      req.user.userId,
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

  // ── Legacy mock endpoints ──

  @Post('mock-success/:reservationId')
  @UseGuards(JwtAuthGuard)
  confirmPayment(
    @Param('reservationId') reservationId: string,
    @Request() req: any,
  ) {
    return this.paymentsService.confirmPayment(
      +reservationId,
      req.user.userId,
    );
  }

  @Post('mock-success-bulk')
  @UseGuards(JwtAuthGuard)
  confirmBulk(
    @Body() body: { reservationIds: number[] },
    @Request() req: any,
  ) {
    return this.paymentsService.confirmBulkPayment(
      body.reservationIds,
      req.user.userId,
    );
  }
}
