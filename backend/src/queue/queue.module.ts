import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { redisConnection } from './redis-connection';

@Module({
  imports: [
    BullModule.forRoot({
      connection: redisConnection(),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
