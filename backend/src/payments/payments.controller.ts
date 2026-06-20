import {
  Controller,
  Post,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';

import { PaymentsService }
from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService:
      PaymentsService,
  ) {}

  @Post(
    'mock-success/:reservationId',
  )
  @UseGuards(JwtAuthGuard)
  confirmPayment(
    @Param('reservationId')
    reservationId: string,
    @Request() req,
  ) {
    return this.paymentsService.confirmPayment(
      +reservationId,
      req.user.userId,
    );
  }
}