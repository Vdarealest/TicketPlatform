import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
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

  @Column()
  bannerUrl: string;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @OneToMany(
    () => Ticket,
    (ticket) => ticket.event,
  )
  tickets: Ticket[];
}