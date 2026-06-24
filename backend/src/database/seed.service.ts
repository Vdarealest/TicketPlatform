import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../events/entities/event.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Seat } from '../tickets/entities/seat.entity';
import { User } from '../users/entities/user.entity';

// Kích thước lưới ghế theo loại vé (khớp với ZONE_CONFIG ở frontend SeatMap)
const SEAT_GRID: Record<string, { rows: number; cols: number }> = {
  svip: { rows: 2, cols: 10 },
  vip: { rows: 3, cols: 12 },
  premium: { rows: 3, cols: 13 },
  standard: { rows: 4, cols: 14 },
  economy: { rows: 4, cols: 16 },
  elite: { rows: 2, cols: 10 },
};

const DEFAULT_SEAT_GRID = { rows: 3, cols: 10 };

// Gán thể loại cho các event seed sẵn (theo id)
const EVENT_CATEGORY: Record<number, string> = {
  1: 'Âm nhạc',
  2: 'Âm nhạc',
  3: 'Hội thảo',
  4: 'Âm nhạc',
  5: 'Âm nhạc',
  6: 'Hội thảo',
  7: 'Sân khấu',
  8: 'Thể thao',
  9: 'Âm nhạc',
  10: 'Triển lãm',
  11: 'Ẩm thực',
  12: 'Triển lãm',
};

const EVENT_TICKETS: Record<number, { type: string; price: number; quantity: number }[]> = {
  1: [ // BLACKPINK WORLD TOUR
    { type: 'VIP', price: 5000000, quantity: 100 },
    { type: 'Premium', price: 3000000, quantity: 200 },
    { type: 'Standard', price: 1500000, quantity: 500 },
  ],
  2: [ // THE ERAS TOUR
    { type: 'VIP', price: 6000000, quantity: 50 },
    { type: 'Premium', price: 3500000, quantity: 150 },
    { type: 'Standard', price: 2000000, quantity: 400 },
  ],
  3: [ // Tech Summit 2026
    { type: 'VIP', price: 2000000, quantity: 50 },
    { type: 'Standard', price: 800000, quantity: 300 },
  ],
  4: [ // K-Pop Festival
    { type: 'VIP', price: 3000000, quantity: 100 },
    { type: 'Premium', price: 2000000, quantity: 200 },
    { type: 'Standard', price: 1000000, quantity: 600 },
  ],
  5: [ // BLACKPINK WORLD TOUR [BORN PINK]
    { type: 'VIP', price: 5500000, quantity: 80 },
    { type: 'Premium', price: 3200000, quantity: 180 },
    { type: 'Standard', price: 1800000, quantity: 450 },
  ],
  6: [ // Tech Summit Vietnam 2026
    { type: 'VIP', price: 1500000, quantity: 60 },
    { type: 'Standard', price: 600000, quantity: 250 },
  ],
  7: [ // Kịch: Chuyện Tình Mùa Thu
    { type: 'VIP', price: 800000, quantity: 50 },
    { type: 'Standard', price: 400000, quantity: 200 },
  ],
  8: [ // Giải Chạy Marathon Quốc Tế
    { type: 'Elite', price: 1200000, quantity: 100 },
    { type: 'Standard', price: 500000, quantity: 800 },
  ],
  9: [ // Liveshow Hà Anh Tuấn
    { type: 'VIP', price: 2500000, quantity: 80 },
    { type: 'Premium', price: 1500000, quantity: 200 },
    { type: 'Standard', price: 800000, quantity: 500 },
  ],
  10: [ // Triển lãm Nghệ thuật Đương đại
    { type: 'Premium', price: 300000, quantity: 200 },
    { type: 'Standard', price: 150000, quantity: 500 },
  ],
  11: [ // Lễ hội Ẩm thực Đường phố
    { type: 'VIP', price: 500000, quantity: 100 },
    { type: 'Standard', price: 200000, quantity: 1000 },
  ],
  12: [ // Vietnam Motor Show
    { type: 'VIP', price: 1000000, quantity: 50 },
    { type: 'Standard', price: 300000, quantity: 400 },
  ],
};

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Ticket)
    private ticketRepository: Repository<Ticket>,
    @InjectRepository(Seat)
    private seatRepository: Repository<Seat>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  private readonly rowLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // rowOffset: số hàng đã dùng bởi các hạng vé trước đó trong cùng event,
  // để các hạng được xếp liên tục A→Z thay vì mỗi hạng bắt đầu lại từ A.
  private async seedSeatsForTicket(ticket: Ticket, type: string, rowOffset: number): Promise<number> {
    const grid = SEAT_GRID[type.toLowerCase()] ?? DEFAULT_SEAT_GRID;

    const existingSeats = await this.seatRepository.find({
      where: { ticket: { id: ticket.id } },
    });

    if (existingSeats.length > 0) {
      // Tính lại vị trí xác định từ grid (idempotent, không phụ thuộc giá trị cũ).
      // Sắp xếp theo (row, col) hiện tại để giữ đúng thứ tự đã tạo ban đầu.
      existingSeats.sort((a, b) => (a.row - b.row) || (a.col - b.col));
      existingSeats.forEach((seat, i) => {
        const perZoneRow = Math.floor(i / grid.cols);
        const perZoneCol = i % grid.cols;
        const globalRow = rowOffset + perZoneRow;
        seat.row = globalRow;
        seat.col = perZoneCol;
        seat.label = `${this.rowLetters[globalRow] ?? globalRow}${perZoneCol + 1}`;
        seat.status = 'AVAILABLE';
      });
      await this.seatRepository.save(existingSeats);
      return grid.rows;
    }

    const seats: Seat[] = [];
    for (let row = 0; row < grid.rows; row++) {
      const globalRow = rowOffset + row;
      for (let col = 0; col < grid.cols; col++) {
        seats.push(
          this.seatRepository.create({
            ticket,
            row: globalRow,
            col,
            label: `${this.rowLetters[globalRow] ?? globalRow}${col + 1}`,
            status: 'AVAILABLE',
          }),
        );
      }
    }

    await this.seatRepository.save(seats);
    return grid.rows;
  }

  async seed() {
    console.log('🌱 Starting database seed...');

    // ── User ──
    const existingUser = await this.userRepository.findOne({
      where: { email: 'test@gmail.com' },
    });

    if (!existingUser) {
      const user = this.userRepository.create({
        email: 'test@gmail.com',
        password: 'hashed_password',
        role: 'USER',
      });
      await this.userRepository.save(user);
      console.log('✅ Created test user');
    }

    // ── Tickets cho từng event ──
    for (const [eventIdStr, ticketDefs] of Object.entries(EVENT_TICKETS)) {
      const eventId = Number(eventIdStr);

      const event = await this.eventRepository.findOne({ where: { id: eventId } });
      if (!event) {
        console.log(`⚠️  Event id=${eventId} không tồn tại, bỏ qua`);
        continue;
      }

      // Backfill thể loại cho event seed sẵn
      const category = EVENT_CATEGORY[eventId];
      if (category && event.category !== category) {
        event.category = category;
        await this.eventRepository.save(event);
      }

      // Xếp ghế các hạng vé liên tục A→Z theo thứ tự định nghĩa trong EVENT_TICKETS
      let rowOffset = 0;
      for (const def of ticketDefs) {
        const existing = await this.ticketRepository.findOne({
          where: { event: { id: eventId }, type: def.type },
        });

        if (!existing) {
          const ticket = this.ticketRepository.create({ event, ...def });
          await this.ticketRepository.save(ticket);
          rowOffset += await this.seedSeatsForTicket(ticket, def.type, rowOffset);
          console.log(`✅ Tạo vé [${def.type}] cho "${event.title}"`);
        } else {
          // Reset quantity về giá trị gốc
          existing.quantity = def.quantity;
          await this.ticketRepository.save(existing);
          rowOffset += await this.seedSeatsForTicket(existing, def.type, rowOffset);
          console.log(`🔄 Reset vé [${def.type}] cho "${event.title}" → ${def.quantity} vé`);
        }
      }
    }

    console.log('🎉 Seeding hoàn tất!');
    return { message: 'Seeding completed' };
  }
}