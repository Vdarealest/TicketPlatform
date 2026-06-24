import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';

import { ReservationsService } from './reservations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reservations')
export class ReservationsController {
  constructor(
    private reservationsService:
      ReservationsService,
  ) {}

  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyReservations(
    @Request() req,
  ) {
    return this.reservationsService.getMyReservations(
      req.user.userId,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getReservation(
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.reservationsService.getReservation(
      Number(id),
      req.user.userId,
    );
  }

  @Post(':ticketId')
  @UseGuards(JwtAuthGuard)
  reserve(
    @Param('ticketId') ticketId: string,
    @Body() body: { seatId?: number },
    @Request() req,
  ) {
    return this.reservationsService.reserveTicket(
      Number(ticketId),
      req.user.userId,
      body?.seatId,
    );
  }

  @Post(':ticketId/bulk')
  @UseGuards(JwtAuthGuard)
  reserveBulk(
    @Param('ticketId') ticketId: string,
    @Body() body: { seatIds: number[] },
    @Request() req,
  ) {
    return this.reservationsService.reserveMultipleSeats(
      Number(ticketId),
      req.user.userId,
      body.seatIds,
    );
  }

  @Post('bulk/details')
  @UseGuards(JwtAuthGuard)
  getMultiple(
    @Body() body: { ids: number[] },
    @Request() req,
  ) {
    return this.reservationsService.getMultipleReservations(body.ids, req.user.userId);
  }

  @Post('bulk/cancel')
  @UseGuards(JwtAuthGuard)
  cancelMultiple(
    @Body() body: { ids: number[] },
    @Request() req,
  ) {
    return this.reservationsService.cancelMultipleReservations(body.ids, req.user.userId);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.reservationsService.cancelReservation(
      Number(id),
      req.user.userId,
    );
  }
}