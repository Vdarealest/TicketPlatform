import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { TicketsModule } from './tickets/tickets.module';
import { ReservationsModule } from './reservations/reservations.module';
import { ScheduleModule } from '@nestjs/schedule';
import { WebsocketModule } from './websocket/websocket.module';
import { QueueModule } from './queue/queue.module';
import { HealthController } from './health/health.controller';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';
import { UploadModule } from './upload/upload.module';
import { MailModule } from './mail/mail.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ContactModule } from './contact/contact.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { connectionOptions } from './database/connection-options';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      
    }),
    ScheduleModule.forRoot(),
    // Global rate limiting: 120 requests / minute per IP by default.
    // Auth routes tighten this further with @Throttle in the controller.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    // Called here, after ConfigModule.forRoot has loaded .env into process.env.
    TypeOrmModule.forRoot({
      ...connectionOptions(),
      autoLoadEntities: true,
    }),
    QueueModule,
    UsersModule,
    AuthModule,
    EventsModule,
    TicketsModule,
    ReservationsModule,
    WebsocketModule,
    PaymentsModule,
    AdminModule,
    UploadModule,
    MailModule,
    ReviewsModule,
    ContactModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
   controllers: [
    HealthController,
  ],
  providers: [
    // Apply rate limiting to every route
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}