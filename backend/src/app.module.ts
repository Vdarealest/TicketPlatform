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


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      
    }),
    ScheduleModule.forRoot(),
    // Global rate limiting: 120 requests / minute per IP by default.
    // Auth routes tighten this further with @Throttle in the controller.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      // Managed Postgres (Render, Neon, Supabase…) exposes one connection URL;
      // the discrete DB_* vars stay for local development.
      ...(process.env.DATABASE_URL
        ? { url: process.env.DATABASE_URL }
        : {
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            username: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
          }),
      // Hosted Postgres requires TLS, but issues certs from a private CA that
      // isn't in the container's trust store, hence rejectUnauthorized: false.
      ...(process.env.DB_SSL === 'true'
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
      autoLoadEntities: true,
      // Auto-syncing can silently drop/alter columns, so it stays off in
      // production unless DB_SYNCHRONIZE is explicitly set. This project has no
      // migrations, so a fresh production database needs one boot with
      // DB_SYNCHRONIZE=true to create the schema — turn it back off afterwards.
      synchronize:
        process.env.DB_SYNCHRONIZE === 'true' ||
        (process.env.NODE_ENV !== 'production' &&
          process.env.DB_SYNCHRONIZE !== 'false'),
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