import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import {
  CreateEventDto,
  CreateTicketDto,
  CreateUserDto,
  CreateVenueDto,
  RequiredAdminPasswordDto,
  UpdateEventDto,
  UpdateTicketDto,
  UpdateUserDto,
  UpdateVenueDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ─── Dashboard ────────────────────────────────────────────────────────────

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  @Get('events')
  getEvents() {
    return this.adminService.getEvents();
  }

  @Get('events/:id')
  getEvent(@Param('id') id: string) {
    return this.adminService.getEvent(Number(id));
  }

  @Post('events')
  createEvent(@Body() body: CreateEventDto) {
    return this.adminService.createEvent(body);
  }

  @Put('events/:id')
  updateEvent(@Param('id') id: string, @Body() body: UpdateEventDto) {
    return this.adminService.updateEvent(Number(id), body);
  }

  @Delete('events/:id')
  deleteEvent(@Param('id') id: string) {
    return this.adminService.deleteEvent(Number(id));
  }

  // ─── Tickets ──────────────────────────────────────────────────────────────

  @Post('events/:eventId/tickets')
  addTicket(@Param('eventId') eventId: string, @Body() body: CreateTicketDto) {
    return this.adminService.addTicketToEvent(Number(eventId), body);
  }

  @Put('tickets/:ticketId')
  updateTicket(
    @Param('ticketId') ticketId: string,
    @Body() body: UpdateTicketDto,
  ) {
    return this.adminService.updateTicket(Number(ticketId), body);
  }

  @Delete('tickets/:ticketId')
  deleteTicket(@Param('ticketId') ticketId: string) {
    return this.adminService.deleteTicket(Number(ticketId));
  }

  // ─── Seat Layout ──────────────────────────────────────────────────────────

  @Get('events/:id/seat-layout')
  getSeatLayout(@Param('id') id: string) {
    return this.adminService.getSeatLayout(Number(id));
  }

  @Put('events/:id/seat-layout')
  // The designer's layout JSON (sections, shapes, seat positions) is stored
  // as-is in a jsonb column; AdminService validates what it reads from it.
  saveSeatLayout(@Param('id') id: string, @Body() body: any) {
    return this.adminService.saveSeatLayout(Number(id), body);
  }

  @Post('events/:id/generate-seats')
  generateSeats(@Param('id') id: string) {
    return this.adminService.generateSeatsFromLayout(Number(id));
  }

  // ─── Venues ───────────────────────────────────────────────────────────────

  @Get('venues')
  getVenues() {
    return this.adminService.getVenues();
  }

  @Get('venues/:id')
  getVenue(@Param('id') id: string) {
    return this.adminService.getVenue(Number(id));
  }

  @Post('venues')
  createVenue(@Body() body: CreateVenueDto) {
    return this.adminService.createVenue(body);
  }

  @Put('venues/:id')
  updateVenue(@Param('id') id: string, @Body() body: UpdateVenueDto) {
    return this.adminService.updateVenue(Number(id), body);
  }

  @Delete('venues/:id')
  deleteVenue(@Param('id') id: string) {
    return this.adminService.deleteVenue(Number(id));
  }

  @Put('venues/:id/layout')
  saveVenueLayout(@Param('id') id: string, @Body() body: any) {
    return this.adminService.saveVenueLayout(Number(id), body);
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @Get('users/:id')
  getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(Number(id));
  }

  @Post('users')
  createUser(@Body() body: CreateUserDto, @Req() req: any) {
    return this.adminService.createUser(body, req.user.userId);
  }

  @Put('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Req() req: any,
  ) {
    return this.adminService.updateUser(
      Number(id),
      body,
      req.user.userId,
      body.adminPassword,
    );
  }

  @Delete('users/:id')
  deleteUser(
    @Param('id') id: string,
    @Body() body: RequiredAdminPasswordDto,
    @Req() req: any,
  ) {
    return this.adminService.deleteUser(
      Number(id),
      req.user.userId,
      body.adminPassword,
    );
  }

  // ─── Orders ───────────────────────────────────────────────────────────────

  @Get('orders')
  getOrders(@Query('status') status?: string) {
    return this.adminService.getOrders(status);
  }
}
