import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import type { SeatLayout } from './seat-layout';

@Entity()
export class Venue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  address: string;

  @Column({ type: 'int', nullable: true })
  capacity: number;

  @Column({ type: 'jsonb', nullable: true })
  layout: SeatLayout | null;

  @CreateDateColumn()
  createdAt: Date;
}
