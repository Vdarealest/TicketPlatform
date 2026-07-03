import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';

import { Ticket } from '../../tickets/entities/ticket.entity';

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

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(
    () => Ticket,
    (ticket) => ticket.event,
  )
  tickets: Ticket[];
}