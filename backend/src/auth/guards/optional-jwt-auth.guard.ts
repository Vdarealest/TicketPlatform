import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '../auth-request';

// Like JwtAuthGuard, but never rejects the request for a missing/invalid
// token — it just means "guest" (req.user stays null) instead of a logged-in
// user. Used on endpoints that support guest checkout alongside normal login.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthUser>(
    _err: unknown,
    user: TUser | false,
  ): TUser | null {
    return user || null;
  }
}
