import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_STAFF_KEY, AuthUser } from './decorators';

/**
 * Authorization guard. Runs after JwtAuthGuard. If a route is marked @Staff(),
 * the authenticated user must carry `isAdmin: true` (admin or vendor). Routes
 * without @Staff() are open to any authenticated (or public) caller.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const staffOnly = this.reflector.getAllAndOverride<boolean>(IS_STAFF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!staffOnly) return true;

    const req = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = req.user;
    if (!user?.isAdmin) {
      throw new ForbiddenException('Staff access required');
    }
    return true;
  }
}
