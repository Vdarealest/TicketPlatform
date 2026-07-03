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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';

const SEAT_MAP_DIR = join(process.cwd(), 'uploads', 'seat-maps');
if (!existsSync(SEAT_MAP_DIR)) mkdirSync(SEAT_MAP_DIR, { recursive: true });

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

  // ─── Seat Layout ──────────────────────────────────────────────────────────

  @Get('events/:id/seat-layout')
  getSeatLayout(@Param('id') id: string) {
    return this.adminService.getSeatLayout(Number(id));
  }

  @Put('events/:id/seat-layout')
  saveSeatLayout(@Param('id') id: string, @Body() body: any) {
    return this.adminService.saveSeatLayout(Number(id), body);
  }

  @Post('events/:id/generate-seats')
  generateSeats(@Param('id') id: string) {
    return this.adminService.generateSeatsFromLayout(Number(id));
  }

  @Post('events/:id/seat-map-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: SEAT_MAP_DIR,
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
          cb(null, `seatmap-${unique}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!/\.(jpg|jpeg|png|webp)$/i.test(extname(file.originalname))) {
          return cb(new BadRequestException('Chỉ hỗ trợ ảnh jpg, png, webp.'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  uploadSeatMapImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Không có file nào.');
    return { url: `/uploads/seat-maps/${file.filename}` };
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
