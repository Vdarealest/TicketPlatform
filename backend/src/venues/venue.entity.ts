import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';

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
  layout: any;

  @CreateDateColumn()
  createdAt: Date;
}
