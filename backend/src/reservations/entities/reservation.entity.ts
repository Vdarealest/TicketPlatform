import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Ticket } from '../../tickets/entities/ticket.entity';
import { Seat } from '../../tickets/entities/seat.entity';

@Entity()
export class Reservation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Ticket)
  ticket: Ticket;

  @ManyToOne(() => Seat, { nullable: true })
  seat: Seat | null;

  @Column()
  expiresAt: Date;

  @Column({
    default: 'HOLD',
  })
  status: string;

  @Column({ nullable: true, unique: true })
  confirmationCode: string;

  @CreateDateColumn()
  createdAt: Date;
}