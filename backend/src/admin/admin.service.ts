import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { Event } from '../events/entities/event.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Seat } from '../tickets/entities/seat.entity';
import { Reservation } from '../reservations/entities/reservation.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Event) private eventsRepo: Repository<Event>,
    @InjectRepository(Ticket) private ticketsRepo: Repository<Ticket>,
    @InjectRepository(Seat) private seatsRepo: Repository<Seat>,
    @InjectRepository(Reservation) private reservationsRepo: Repository<Reservation>,
  ) {}

  // ─── Dashboard Stats ─────────────────────────────────────────────────────

  async getDashboardStats() {
    const totalUsers = await this.usersRepo.count();
    const totalEvents = await this.eventsRepo.count();
    const totalReservations = await this.reservationsRepo.count();

    const confirmedReservations = await this.reservationsRepo.count({
      where: { status: 'CONFIRMED' },
    });

    const revenueResult = await this.reservationsRepo
      .createQueryBuilder('r')
      .innerJoin('r.ticket', 't')
      .where('r.status = :status', { status: 'CONFIRMED' })
      .select('COALESCE(SUM(t.price), 0)', 'total')
      .getRawOne();

    const recentOrders = await this.reservationsRepo.find({
      relations: ['user', 'ticket', 'ticket.event'],
      order: { createdAt: 'DESC' },
      take: 5,
    });

    // Revenue by day (last 7 days)
    const revenueByDay = await this.reservationsRepo
      .createQueryBuilder('r')
      .innerJoin('r.ticket', 't')
      .where('r.status = :status', { status: 'CONFIRMED' })
      .select("TO_CHAR(r.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COALESCE(SUM(t.price), 0)', 'revenue')
      .addSelect('COUNT(r.id)', 'count')
      .groupBy("TO_CHAR(r.createdAt, 'YYYY-MM-DD')")
      .orderBy("TO_CHAR(r.createdAt, 'YYYY-MM-DD')", 'ASC')
      .getRawMany();

    // Fill in missing days for last 7 days
    const last7: { date: string; label: string; revenue: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = revenueByDay.find((r) => r.date === key);
      last7.push({
        date: key,
        label: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        revenue: Number(found?.revenue || 0),
        count: Number(found?.count || 0),
      });
    }

    // Orders by status
    const statusCounts = await this.reservationsRepo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(r.id)', 'count')
      .groupBy('r.status')
      .getRawMany();

    const ordersByStatus = statusCounts.map((s) => ({
      status: s.status,
      count: Number(s.count),
    }));

    // Revenue by ticket type
    const revenueByType = await this.reservationsRepo
      .createQueryBuilder('r')
      .innerJoin('r.ticket', 't')
      .where('r.status = :status', { status: 'CONFIRMED' })
      .select('t.type', 'type')
      .addSelect('COALESCE(SUM(t.price), 0)', 'revenue')
      .addSelect('COUNT(r.id)', 'count')
      .groupBy('t.type')
      .getRawMany();

    const ticketTypeStats = revenueByType.map((r) => ({
      type: r.type,
      revenue: Number(r.revenue),
      count: Number(r.count),
    }));

    return {
      totalUsers,
      totalEvents,
      totalReservations,
      confirmedReservations,
      totalRevenue: Number(revenueResult?.total || 0),
      revenueByDay: last7,
      ordersByStatus,
      ticketTypeStats,
      recentOrders: recentOrders.map((r) => ({
        id: r.id,
        userEmail: r.user?.email,
        eventTitle: r.ticket?.event?.title,
        ticketType: r.ticket?.type,
        price: r.ticket?.price,
        status: r.status,
        createdAt: r.createdAt,
      })),
    };
  }

  // ─── Events CRUD ──────────────────────────────────────────────────────────

  async getEvents() {
    return this.eventsRepo.find({
      relations: ['tickets'],
      order: { startTime: 'DESC' },
    });
  }

  async getEvent(id: number) {
    const event = await this.eventsRepo.findOne({
      where: { id },
      relations: ['tickets', 'tickets.seats'],
    });
    if (!event) throw new NotFoundException('Sự kiện không tồn tại.');
    return event;
  }

  async createEvent(data: {
    title: string;
    description: string;
    location: string;
    bannerUrl: string;
    bannerFocusX?: number;
    bannerFocusY?: number;
    startTime: string;
    endTime: string;
    tickets?: { type: string; price: number; quantity: number }[];
  }) {
    const event = this.eventsRepo.create({
      title: data.title,
      description: data.description,
      location: data.location,
      bannerUrl: data.bannerUrl,
      bannerFocusX: data.bannerFocusX ?? 50,
      bannerFocusY: data.bannerFocusY ?? 50,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
    });
    const savedEvent = await this.eventsRepo.save(event);

    if (data.tickets?.length) {
      for (const t of data.tickets) {
        const ticket = this.ticketsRepo.create({
          type: t.type,
          price: t.price,
          quantity: t.quantity,
          event: savedEvent,
        });
        const savedTicket = await this.ticketsRepo.save(ticket);
        await this.generateSeats(savedTicket);
      }
    }

    return this.getEvent(savedEvent.id);
  }

  async updateEvent(
    id: number,
    data: Partial<{
      title: string;
      description: string;
      location: string;
      bannerUrl: string;
      bannerFocusX: number;
      bannerFocusY: number;
      startTime: string;
      endTime: string;
    }>,
  ) {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Sự kiện không tồn tại.');

    if (data.title !== undefined) event.title = data.title;
    if (data.description !== undefined) event.description = data.description;
    if (data.location !== undefined) event.location = data.location;
    if (data.bannerUrl !== undefined) event.bannerUrl = data.bannerUrl;
    if (data.bannerFocusX !== undefined) event.bannerFocusX = data.bannerFocusX;
    if (data.bannerFocusY !== undefined) event.bannerFocusY = data.bannerFocusY;
    if (data.startTime !== undefined) event.startTime = new Date(data.startTime);
    if (data.endTime !== undefined) event.endTime = new Date(data.endTime);

    await this.eventsRepo.save(event);
    return this.getEvent(id);
  }

  async deleteEvent(id: number) {
    const event = await this.eventsRepo.findOne({
      where: { id },
      relations: ['tickets', 'tickets.seats'],
    });
    if (!event) throw new NotFoundException('Sự kiện không tồn tại.');

    const ticketIds = event.tickets.map((t) => t.id);

    if (ticketIds.length) {
      await this.reservationsRepo
        .createQueryBuilder()
        .delete()
        .where('ticketId IN (:...ticketIds)', { ticketIds })
        .execute();
    }

    for (const ticket of event.tickets) {
      if (ticket.seats?.length) {
        await this.seatsRepo.remove(ticket.seats);
      }
    }
    if (event.tickets?.length) {
      await this.ticketsRepo.remove(event.tickets);
    }
    await this.eventsRepo.remove(event);

    return { message: 'Đã xóa sự kiện.' };
  }

  // ─── Tickets for Event ────────────────────────────────────────────────────

  async addTicketToEvent(
    eventId: number,
    data: { type: string; price: number; quantity: number },
  ) {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Sự kiện không tồn tại.');

    const ticket = this.ticketsRepo.create({
      type: data.type,
      price: data.price,
      quantity: data.quantity,
      event,
    });
    const savedTicket = await this.ticketsRepo.save(ticket);
    await this.generateSeats(savedTicket);
    return this.getEvent(eventId);
  }

  async deleteTicket(ticketId: number) {
    const ticket = await this.ticketsRepo.findOne({
      where: { id: ticketId },
      relations: ['seats', 'event'],
    });
    if (!ticket) throw new NotFoundException('Loại vé không tồn tại.');

    await this.reservationsRepo
      .createQueryBuilder()
      .delete()
      .where('ticketId = :ticketId', { ticketId })
      .execute();

    if (ticket.seats?.length) {
      await this.seatsRepo.remove(ticket.seats);
    }
    const eventId = ticket.event?.id;
    await this.ticketsRepo.remove(ticket);

    if (eventId) return this.getEvent(eventId);
    return { message: 'Đã xóa loại vé.' };
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  async getUsers() {
    const users = await this.usersRepo.find({ order: { id: 'DESC' } });

    const userIds = users.map((u) => u.id);
    let reservationCounts: Record<number, number> = {};

    if (userIds.length) {
      const counts = await this.reservationsRepo
        .createQueryBuilder('r')
        .select('r.userId', 'userId')
        .addSelect('COUNT(r.id)', 'count')
        .where('r.status = :status', { status: 'CONFIRMED' })
        .groupBy('r.userId')
        .getRawMany();
      for (const c of counts) {
        reservationCounts[c.userId] = Number(c.count);
      }
    }

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      phone: u.phone,
      role: u.role,
      googleId: u.googleId ? true : false,
      createdAt: u.createdAt,
      completedOrders: reservationCounts[u.id] || 0,
    }));
  }

  async getUserDetail(userId: number) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User không tồn tại.');

    const reservations = await this.reservationsRepo.find({
      where: { user: { id: userId } },
      relations: ['ticket', 'ticket.event', 'seat'],
      order: { createdAt: 'DESC' },
    });

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      googleId: user.googleId ? true : false,
      createdAt: user.createdAt,
      reservations: reservations.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        eventTitle: r.ticket?.event?.title,
        ticketType: r.ticket?.type,
        price: r.ticket?.price,
        seatLabel: r.seat?.label,
      })),
    };
  }

  private async verifyAdminPassword(adminId: number, password: string) {
    const admin = await this.usersRepo.findOne({ where: { id: adminId } });
    if (!admin || !admin.password) {
      throw new ForbiddenException('Không thể xác thực tài khoản admin.');
    }
    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      throw new ForbiddenException('Mật khẩu admin không đúng.');
    }
  }

  async createUser(
    data: { email: string; password: string; phone?: string; role: string; adminPassword?: string },
    adminId: number,
  ) {
    if (data.role === 'ADMIN') {
      if (!data.adminPassword) throw new ForbiddenException('Cần nhập mật khẩu admin để tạo tài khoản admin.');
      await this.verifyAdminPassword(adminId, data.adminPassword);
    }

    const existing = await this.usersRepo.findOne({ where: { email: data.email } });
    if (existing) throw new BadRequestException('Email đã tồn tại.');

    if (!['USER', 'ADMIN'].includes(data.role)) {
      throw new BadRequestException('Role không hợp lệ.');
    }

    const hashed = await bcrypt.hash(data.password, 10);
    const user = this.usersRepo.create({
      email: data.email,
      password: hashed,
      phone: data.phone || undefined,
      role: data.role,
    });
    await this.usersRepo.save(user);
    return { id: user.id, email: user.email, phone: user.phone, role: user.role };
  }

  async updateUser(
    userId: number,
    data: { email?: string; phone?: string; role?: string; password?: string },
    adminId: number,
    adminPassword?: string,
  ) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User không tồn tại.');

    const isChangingToAdmin = data.role === 'ADMIN' && user.role !== 'ADMIN';
    const isChangingFromAdmin = data.role && data.role !== 'ADMIN' && user.role === 'ADMIN';
    const targetIsAdmin = user.role === 'ADMIN';

    if (isChangingToAdmin || isChangingFromAdmin || targetIsAdmin) {
      if (!adminPassword) throw new ForbiddenException('Cần nhập mật khẩu admin để thao tác với tài khoản admin.');
      await this.verifyAdminPassword(adminId, adminPassword);
    }

    if (data.email !== undefined) {
      if (data.email !== user.email) {
        const dup = await this.usersRepo.findOne({ where: { email: data.email } });
        if (dup) throw new BadRequestException('Email đã tồn tại.');
      }
      user.email = data.email;
    }
    if (data.phone !== undefined) user.phone = data.phone || (null as any);
    if (data.role && ['USER', 'ADMIN'].includes(data.role)) user.role = data.role;
    if (data.password) user.password = await bcrypt.hash(data.password, 10);

    await this.usersRepo.save(user);
    return { id: user.id, email: user.email, phone: user.phone, role: user.role };
  }

  async deleteUser(userId: number, adminId: number, adminPassword: string) {
    await this.verifyAdminPassword(adminId, adminPassword);

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User không tồn tại.');
    if (user.id === adminId) throw new BadRequestException('Không thể xóa chính mình.');

    await this.reservationsRepo
      .createQueryBuilder()
      .delete()
      .where('userId = :userId', { userId })
      .execute();

    await this.usersRepo.remove(user);
    return { message: 'Đã xóa người dùng.' };
  }

  // ─── Reservations / Orders ────────────────────────────────────────────────

  async getOrders(status?: string) {
    const where: any = {};
    if (status) where.status = status;

    return this.reservationsRepo.find({
      where,
      relations: ['user', 'ticket', 'ticket.event', 'seat'],
      order: { createdAt: 'DESC' },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async generateSeats(ticket: Ticket) {
    const gridSizes: Record<string, { rows: number; cols: number }> = {
      SVIP: { rows: 2, cols: 8 },
      VIP: { rows: 3, cols: 10 },
      Premium: { rows: 4, cols: 12 },
      Standard: { rows: 5, cols: 14 },
      Economy: { rows: 6, cols: 16 },
    };

    const grid = gridSizes[ticket.type] || { rows: 4, cols: 10 };

    const seats: Seat[] = [];
    for (let r = 1; r <= grid.rows; r++) {
      for (let c = 1; c <= grid.cols; c++) {
        const seat = this.seatsRepo.create({
          row: r,
          col: c,
          label: `${String.fromCharCode(64 + r)}${c}`,
          status: 'AVAILABLE',
          ticket,
        });
        seats.push(seat);
      }
    }

    await this.seatsRepo.save(seats);
  }
}
