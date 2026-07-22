import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  orderId: string;

  @Column({ default: 'VNPAY' })
  provider: string;

  @Column('bigint')
  amount: number;

  @Column({ default: 'PENDING' })
  status: string;

  @Column('simple-array')
  reservationIds: number[];

  @Column({ nullable: true })
  vnpTransactionNo: string;

  @Column({ nullable: true })
  bankCode: string;

  @Column({ nullable: true })
  bankTranNo: string;

  @Column({ nullable: true })
  cardType: string;

  @Column({ nullable: true })
  payDate: string;

  @Column({ nullable: true })
  responseCode: string;

  // Null for guest checkouts — ownership of the payment is then derived from
  // the underlying reservations' guestToken (see PaymentsService.assertOwnsPayment).
  @ManyToOne(() => User, { nullable: true })
  user: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
