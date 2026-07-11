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

  @Column({ nullable: true })
  venueId: number;

  @ManyToOne(() => Venue, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(
    () => Ticket,
    (ticket) => ticket.event,
  )
  tickets: Ticket[];
}