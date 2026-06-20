import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm';

import { Ticket } from './ticket.entity';

@Entity()
export class Seat {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Ticket, (ticket) => ticket.seats)
  ticket: Ticket;

  @Column()
  row: number;

  @Column()
  col: number;

  @Column()
  label: string;

  @Column({ default: 'AVAILABLE' })
  status: string;
}
