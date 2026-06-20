import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { Event } from '../../events/entities/event.entity';
import { Seat } from './seat.entity';

@Entity()
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
  () => Event,
  (event) => event.tickets,
)
event: Event;

  @Column()
  type: string;

  @Column()
  price: number;

  @Column()
  quantity: number;

  @OneToMany(() => Seat, (seat) => seat.ticket)
  seats: Seat[];
}