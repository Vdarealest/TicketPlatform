import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { Event } from '../events/entities/event.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Seat } from '../tickets/entities/seat.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { Venue } from '../venues/venue.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Event) private eventsRepo: Repository<Event>,
    @InjectRepository(Ticket) private ticketsRepo: Repository<Ticket>,
    @InjectRepository(Seat) private seatsRepo: Repository<Seat>,
    @InjectRepository(Reservation) private reservationsRepo: Repository<Reservation>,
    @InjectRepository(Venue) private venuesRepo: Repository<Venue>,
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
      relations: ['tickets', 'venue'],
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
    category?: string;
    bannerUrl: string;
    bannerFocusX?: number;
    bannerFocusY?: number;
    startTime: string;
    endTime: string;
    venueId?: number | null;
    tickets?: { type: string; price: number; quantity: number }[];
  }) {
    const event = this.eventsRepo.create({
      title: data.title,
      description: data.description,
      location: data.location,
      category: data.category?.trim() || 'Khác',
      bannerUrl: data.bannerUrl,
      venueId: data.venueId || (null as any),
      bannerFocusX: data.bannerFocusX ?? 50,
      bannerFocusY: data.bannerFocusY ?? 50,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
    });
    const savedEvent = await this.eventsRepo.save(event);

    if (data.tickets?.length) {
      let rowOffset = 0;
      for (const t of data.tickets) {
        const ticket = this.ticketsRepo.create({
          type: t.type,
          price: t.price,
          quantity: t.quantity,
          event: savedEvent,
        });
        const savedTicket = await this.ticketsRepo.save(ticket);
        const rowsGenerated = await this.generateSeats(savedTicket, rowOffset);
        rowOffset += rowsGenerated;
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
      category: string;
      bannerUrl: string;
      bannerFocusX: number;
      bannerFocusY: number;
      startTime: string;
      endTime: string;
      venueId: number | null;
    }>,
  ) {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Sự kiện không tồn tại.');

    if (data.title !== undefined) event.title = data.title;
    if (data.description !== undefined) event.description = data.description;
    if (data.location !== undefined) event.location = data.location;
    if (data.category !== undefined) event.category = data.category.trim() || 'Khác';
    if (data.bannerUrl !== undefined) event.bannerUrl = data.bannerUrl;
    if (data.bannerFocusX !== undefined) event.bannerFocusX = data.bannerFocusX;
    if (data.bannerFocusY !== undefined) event.bannerFocusY = data.bannerFocusY;
    if (data.startTime !== undefined) event.startTime = new Date(data.startTime);
    if (data.endTime !== undefined) event.endTime = new Date(data.endTime);
    if ('venueId' in data) event.venueId = data.venueId as any;

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
    const event = await this.eventsRepo.findOne({
      where: { id: eventId },
      relations: ['venue'],
    });
    if (!event) throw new NotFoundException('Sự kiện không tồn tại.');

    const ticket = this.ticketsRepo.create({
      type: data.type,
      price: data.price,
      quantity: data.quantity,
      event,
    });
    const savedTicket = await this.ticketsRepo.save(ticket);

    // For SVG-layout events, seats are created from the drawn sections via
    // "Tạo ghế" in the designer — auto-generating a grid here would produce
    // seats that don't match the layout. Only grid-generate for plain events.
    const usesLayout =
      !!event.seatLayout?.sections?.length ||
      !!event.venue?.layout?.sections?.length;

    if (!usesLayout) {
      const maxRow = await this.seatsRepo
        .createQueryBuilder('s')
        .innerJoin('s.ticket', 't')
        .where('t.eventId = :eventId', { eventId })
        .select('MAX(s.row)', 'max')
        .getRawOne();
      await this.generateSeats(savedTicket, Number(maxRow?.max || 0));
    }

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

  // ─── Seat Layout Designer ────────────────────────────────────────────────

  async saveSeatLayout(eventId: number, layout: any) {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Sự kiện không tồn tại.');
    event.seatLayout = layout;
    await this.eventsRepo.save(event);
    return { message: 'Layout saved.' };
  }

  async getSeatLayout(eventId: number) {
    const event = await this.eventsRepo.findOne({
      where: { id: eventId },
      relations: ['tickets', 'tickets.seats', 'venue'],
    });
    if (!event) throw new NotFoundException('Sự kiện không tồn tại.');
    // Use event's own layout; fall back to venue layout
    const layout = event.seatLayout || event.venue?.layout || null;
    return {
      layout,
      venueId: event.venueId || null,
      venueName: event.venue?.name || null,
      tickets: (event.tickets || []).map((t) => ({
        id: t.id,
        type: t.type,
        price: t.price,
        quantity: t.quantity,
        seatCount: t.seats?.length ?? 0,
      })),
    };
  }

  async generateSeatsFromLayout(eventId: number) {
    const event = await this.eventsRepo.findOne({
      where: { id: eventId },
      relations: ['tickets', 'tickets.seats', 'venue'],
    });
    if (!event) throw new NotFoundException('Sự kiện không tồn tại.');
    if (!event.tickets?.length) throw new BadRequestException('Chưa có loại vé nào.');

    // Guard: refuse if any seat is already sold/held
    for (const ticket of event.tickets) {
      if (ticket.seats?.some((s) => s.status !== 'AVAILABLE')) {
        throw new BadRequestException(
          `Loại vé "${ticket.type}" đã có ghế đang giữ/đã bán. Không thể tạo lại.`,
        );
      }
    }

    // Use event's own layout first, then venue layout as fallback
    const layout = (event.seatLayout || event.venue?.layout) as any;

    // Validate BEFORE deleting anything so a failed run never leaves the event seatless
    const hasSections = !!layout?.sections?.length;
    const ticketMap = new Map(event.tickets.map((t) => [t.id, t]));
    const matchedSections = hasSections
      ? layout.sections.filter((s: any) => ticketMap.has(s.ticketId))
      : [];
    if (hasSections && !matchedSections.length) {
      throw new BadRequestException(
        'Chưa có khu nào trong sơ đồ được gán loại vé. Hãy chọn khu và gán "Loại vé" trước khi tạo ghế.',
      );
    }

    // Remove all existing available seats
    for (const ticket of event.tickets) {
      if (ticket.seats?.length) await this.seatsRepo.remove(ticket.seats);
    }

    // ── Image-based layout (type: 'image') or no sections ─────────────────
    if (!hasSections) {
      let totalCreated = 0;
      let rowOffset = 0;
      for (const ticket of event.tickets) {
        const rowsGenerated = await this.generateSeats(ticket, rowOffset);
        rowOffset += rowsGenerated;
        totalCreated += ticket.quantity;
      }
      return { message: `Đã tạo ${totalCreated} ghế.`, total: totalCreated };
    }

    // ── SVG sections-based layout ──────────────────────────────────────────

    const seatCountPerTicket = new Map<number, number>();
    let totalCreated = 0;

    for (const section of matchedSections) {
      const ticket = ticketMap.get(section.ticketId)!;

      const seats: Seat[] = [];
      const rowCount = section.rows || 1;
      const colCount = section.seatsPerRow || 10;
      const startLabel = section.startLabel || 'A';

      // Sections rotated ~90°/270° appear sideways on screen: their lettered
      // rows run vertically. Transpose the labels so on-screen horizontal
      // lines get the letters and seats get the numbers — the classic reading.
      const rot = section.rotation || 0;
      const transposed = ((Math.round(rot / 90) % 4) + 4) % 4 % 2 === 1;

      for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
          const label = transposed
            ? `${String.fromCharCode(startLabel.charCodeAt(0) + c)}${r + 1}`
            : `${String.fromCharCode(startLabel.charCodeAt(0) + r)}${c + 1}`;
          seats.push(this.seatsRepo.create({
            row: r,
            col: c,
            label,
            status: 'AVAILABLE',
            // Reference by id only: passing the loaded entity (with its stale
            // `seats` relation) makes a later save() unlink the new seats.
            ticket: { id: ticket.id } as Ticket,
          }));
        }
      }

      await this.seatsRepo.save(seats);
      seatCountPerTicket.set(
        ticket.id,
        (seatCountPerTicket.get(ticket.id) ?? 0) + seats.length,
      );
      totalCreated += seats.length;
    }

    // Sync quantity with a column-only update — save() on a ticket entity that
    // was loaded with its seats relation would NULL out the new seats' FKs.
    for (const [ticketId, count] of seatCountPerTicket) {
      await this.ticketsRepo.update(ticketId, { quantity: count });
    }

    return { message: `Đã tạo ${totalCreated} ghế.`, total: totalCreated };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async generateSeats(ticket: Ticket, rowOffset = 0): Promise<number> {
    const qty = ticket.quantity;
    if (qty <= 0) return 0;

    const colsPerType: Record<string, number> = {
      SVIP: 8,
      VIP: 10,
      Premium: 12,
      Standard: 14,
      Economy: 16,
    };
    const cols = colsPerType[ticket.type] || Math.min(Math.ceil(Math.sqrt(qty * 2)), 16);
    const rows = Math.ceil(qty / cols);

    const seats: Seat[] = [];
    let remaining = qty;

    for (let r = 1; r <= rows && remaining > 0; r++) {
      const globalRow = rowOffset + r;
      const seatsInRow = Math.min(cols, remaining);
      for (let c = 1; c <= seatsInRow; c++) {
        seats.push(this.seatsRepo.create({
          row: globalRow,
          col: c,
          label: `${String.fromCharCode(64 + globalRow)}${c}`,
          status: 'AVAILABLE',
          ticket: { id: ticket.id } as Ticket,
        }));
        remaining--;
      }
    }

    await this.seatsRepo.save(seats);
    return rows;
  }

  // ─── Venues ───────────────────────────────────────────────────────────────

  async getVenues() {
    return this.venuesRepo.find({ order: { name: 'ASC' } });
  }

  async getVenue(id: number) {
    const venue = await this.venuesRepo.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Địa điểm không tồn tại.');
    return venue;
  }

  async createVenue(data: { name: string; address?: string; capacity?: number }) {
    const venue = this.venuesRepo.create({
      name: data.name,
      address: data.address,
      capacity: data.capacity,
    });
    return this.venuesRepo.save(venue);
  }

  async updateVenue(id: number, data: { name?: string; address?: string; capacity?: number }) {
    const venue = await this.venuesRepo.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Địa điểm không tồn tại.');
    if (data.name !== undefined) venue.name = data.name;
    if (data.address !== undefined) venue.address = data.address;
    if (data.capacity !== undefined) venue.capacity = data.capacity;
    return this.venuesRepo.save(venue);
  }

  async deleteVenue(id: number) {
    const venue = await this.venuesRepo.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Địa điểm không tồn tại.');
    await this.eventsRepo.update({ venueId: id }, { venueId: null as any });
    await this.venuesRepo.remove(venue);
    return { message: 'Đã xóa địa điểm.' };
  }

  async saveVenueLayout(id: number, layout: any) {
    const venue = await this.venuesRepo.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Địa điểm không tồn tại.');
    venue.layout = layout;
    await this.venuesRepo.save(venue);
    return { message: 'Đã lưu layout.' };
  }
}
