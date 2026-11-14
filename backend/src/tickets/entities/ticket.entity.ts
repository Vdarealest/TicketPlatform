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

  @ManyToOne(() => Event, (event) => event.tickets)
  event: Event;

  @Column()
  type: string;

  @Column()
  price: number;

  @Column()
  quantity: number;

  // SEATED: buyer picks specific seats off the venue map (existing flow).
  // GENERAL: standing/GA admission — no seat map, buyer just picks a
  // quantity and reservations are tracked purely against this column.
  // Defaults to SEATED so every ticket created before this column existed
  // keeps behaving exactly as it did.
  @Column({ type: 'varchar', default: 'SEATED' })
  seating: 'SEATED' | 'GENERAL';

  @OneToMany(() => Seat, (seat) => seat.ticket)
  seats: Seat[];
}
