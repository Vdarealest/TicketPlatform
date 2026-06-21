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
  createEvent(@Body() body: any) {
    return this.adminService.createEvent(body);
  }

  @Put('events/:id')
  updateEvent(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateEvent(Number(id), body);
  }

  @Delete('events/:id')
  deleteEvent(@Param('id') id: string) {
    return this.adminService.deleteEvent(Number(id));
  }

  // ─── Tickets ──────────────────────────────────────────────────────────────

  @Post('events/:eventId/tickets')
  addTicket(@Param('eventId') eventId: string, @Body() body: any) {
    return this.adminService.addTicketToEvent(Number(eventId), body);
  }

  @Delete('tickets/:ticketId')
  deleteTicket(@Param('ticketId') ticketId: string) {
    return this.adminService.deleteTicket(Number(ticketId));
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
  createUser(@Body() body: { email: string; password: string; phone?: string; role: string; adminPassword?: string }, @Req() req: any) {
    return this.adminService.createUser(body, req.user.userId);
  }

  @Put('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() body: { email?: string; phone?: string; role?: string; password?: string; adminPassword?: string },
    @Req() req: any,
  ) {
    return this.adminService.updateUser(Number(id), body, req.user.userId, body.adminPassword);
  }

  @Delete('users/:id')
  deleteUser(
    @Param('id') id: string,
    @Body() body: { adminPassword: string },
    @Req() req: any,
  ) {
    return this.adminService.deleteUser(Number(id), req.user.userId, body.adminPassword);
  }

  // ─── Orders ───────────────────────────────────────────────────────────────

  @Get('orders')
  getOrders(@Query('status') status?: string) {
    return this.adminService.getOrders(status);
  }
}
