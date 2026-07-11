import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { User } from '../users/entities/user.entity';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

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
        return { secret, signOptions: { expiresIn: '7d' } };
      },
      inject: [ConfigService],
    }),

    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],

  controllers: [AuthController],

  providers: [AuthService, JwtStrategy, GoogleStrategy],
})
export class AuthModule {}
