import type { Request } from 'express';

/** What JwtStrategy.validate puts on req.user. */
export interface AuthUser {
  userId: number;
  email: string;
}

/** Payload signed by AuthService.signToken. */
export interface JwtPayload {
  sub: number;
  email: string;
}

// @types/passport already declares req.user (as Express.User), so these
// replace that field rather than extend it.

/** Request behind JwtAuthGuard: always logged in. */
export type AuthRequest = Omit<Request, 'user'> & { user: AuthUser };

/** Request behind OptionalJwtAuthGuard: user is null for guests. */
export type OptionalAuthRequest = Omit<Request, 'user'> & {
  user?: AuthUser | null;
};
