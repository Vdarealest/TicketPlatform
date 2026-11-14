import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Ticket } from '../../tickets/entities/ticket.entity';
import { Venue } from '../../venues/venue.entity';

@Entity()
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column()
  location: string;

  @Column({ default: 'Khác' })
  category: string;

  @Column()
  bannerUrl: string;

  @Column({ type: 'int', default: 50 })
  bannerFocusX: number;

  @Column({ type: 'int', default: 50 })
  bannerFocusY: number;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @Column({ type: 'jsonb', nullable: true })
  seatLayout: any;

  // Admin-picked "featured" events shown in the homepage hero carousel.
  @Column({ type: 'boolean', default: false })
  featured: boolean;

  @Column({ type: 'int', default: 0 })
  featuredOrder: number;

  // Sale lifecycle. 'ON_SALE' default so existing events keep working.
  //   DRAFT     — hidden from the public site entirely
  //   UPCOMING  — publicly visible but not buyable ("Sắp mở bán")
  //   ON_SALE   — buyable
  @Column({ type: 'varchar', default: 'ON_SALE' })
  status: 'DRAFT' | 'UPCOMING' | 'ON_SALE';

  // Optional auto-open time. When status is UPCOMING and now >= saleOpenAt,
  // the event is treated as ON_SALE without any manual flip.
  @Column({ type: 'timestamp', nullable: true })
  saleOpenAt: Date | null;

  @Column({ nullable: true })
  venueId: number;

  @ManyToOne(() => Venue, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: false,
  })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Ticket, (ticket) => ticket.event)
  tickets: Ticket[];
}
