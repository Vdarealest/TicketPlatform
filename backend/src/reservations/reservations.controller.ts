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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('reservations')
export class ReservationsController {
  constructor(
    private reservationsService:
      ReservationsService,
  ) {}

  // "My tickets" genuinely requires an account — guests have nowhere to log
  // back into, so this one stays strictly authenticated.
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
      { userId: req.user.userId },
    );
  }

  // ── Guest-checkout-capable endpoints ──
  // OptionalJwtAuthGuard: works whether or not the caller is logged in. When
  // logged in, ownership ties to the user id as before. When not, the caller
  // must supply a guestEmail (to reserve) or guestToken (to look up/cancel) —
  // enforced in the service layer via ownsReservation().

  @Post(':ticketId/bulk')
  @UseGuards(OptionalJwtAuthGuard)
  reserveBulk(
    @Param('ticketId') ticketId: string,
    @Body() body: { seatIds: number[]; guestEmail?: string },
    @Request() req,
  ) {
    return this.reservationsService.reserveMultipleSeats(
      Number(ticketId),
      body.seatIds,
      { userId: req.user?.userId, guestEmail: body.guestEmail },
    );
  }

  @Post(':ticketId/general')
  @UseGuards(OptionalJwtAuthGuard)
  reserveGeneral(
    @Param('ticketId') ticketId: string,
    @Body() body: { quantity: number; guestEmail?: string },
    @Request() req,
  ) {
    return this.reservationsService.reserveGeneralAdmission(
      Number(ticketId),
      body.quantity,
      { userId: req.user?.userId, guestEmail: body.guestEmail },
    );
  }

  @Post('bulk/details')
  @UseGuards(OptionalJwtAuthGuard)
  getMultiple(
    @Body() body: { ids: number[]; guestToken?: string },
    @Request() req,
  ) {
    return this.reservationsService.getMultipleReservations(
      body.ids,
      { userId: req.user?.userId, guestToken: body.guestToken },
    );
  }

  @Post('bulk/cancel')
  @UseGuards(OptionalJwtAuthGuard)
  cancelMultiple(
    @Body() body: { ids: number[]; guestToken?: string },
    @Request() req,
  ) {
    return this.reservationsService.cancelMultipleReservations(
      body.ids,
      { userId: req.user?.userId, guestToken: body.guestToken },
    );
  }

  @Post(':id/cancel')
  @UseGuards(OptionalJwtAuthGuard)
  cancel(
    @Param('id') id: string,
    @Body() body: { guestToken?: string },
    @Request() req,
  ) {
    return this.reservationsService.cancelReservation(
      Number(id),
      { userId: req.user?.userId, guestToken: body?.guestToken },
    );
  }
}