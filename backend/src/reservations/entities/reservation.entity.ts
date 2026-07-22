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

  // Null for guest checkouts — ownership is then proven by guestToken instead.
  @ManyToOne(() => User, { nullable: true })
  user: User | null;

  // Guest-only fields. Set together, only when `user` is null.
  // type: 'varchar' is explicit because TypeORM's reflect-metadata can't
  // infer a column type from a `string | null` union (it reports "Object").
  @Column({ type: 'varchar', nullable: true })
  guestEmail: string | null;

  // Random, unguessable secret (crypto.randomBytes) shared by every
  // reservation in one guest checkout batch — this is what proves ownership
  // of a guest order instead of a user id, since there's no account to check
  // against. Never derived from anything predictable (not the id, not a hash
  // of the email).
  @Column({ type: 'varchar', nullable: true })
  guestToken: string | null;

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