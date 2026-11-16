import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { User } from '../users/entities/user.entity';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import Redis from 'ioredis';
import { RedisTokenStore, TOKEN_STORE } from './token-store';
import { redisConnection } from '../queue/redis-connection';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),

    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        // Fail fast: never fall back to a hardcoded secret — that would let
        // anyone forge admin tokens if the env var is ever missing.
        if (!secret) {
          throw new Error('JWT_SECRET is not set. Refusing to start.');
        }
        // Short-lived: the frontend renews it with the refresh token
        // (AuthService.refreshSession), so a token lifted from localStorage
        // is only useful for minutes. A refresh-token cookie would be safer
        // still, but the frontend and API are on different sites today,
        // where browsers increasingly block such cookies.
        return { secret, signOptions: { expiresIn: '15m' } };
      },
      inject: [ConfigService],
    }),

    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    {
      provide: TOKEN_STORE,
      // Its own connection with a key prefix, so auth keys never collide
      // with BullMQ's and are easy to find with SCAN vietix:auth:*.
      useFactory: () =>
        new RedisTokenStore(
          new Redis({ ...redisConnection(), keyPrefix: 'vietix:auth:' }),
        ),
    },
  ],
})
export class AuthModule {}
