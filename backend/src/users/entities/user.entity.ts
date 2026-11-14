import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column({ nullable: true, unique: true })
  googleId: string;

  @Column({ nullable: true })
  name: string;

  // Explicit type: with `string | null` TypeORM cannot infer the column type.
  @Column({ type: 'varchar', nullable: true, unique: true })
  phone: string | null;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: 'USER' })
  role: string;

  @CreateDateColumn()
  createdAt: Date;
}
