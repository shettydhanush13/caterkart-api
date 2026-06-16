import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

// Marks a route as public — the global JwtAuthGuard lets it through with no token.
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Marks a route as staff-only — the RolesGuard requires an authenticated user
// whose token carries `isAdmin: true` (covers both 'admin' and 'vendor' roles).
export const IS_STAFF_KEY = 'isStaff';
export const Staff = () => SetMetadata(IS_STAFF_KEY, true);

export interface AuthUser {
  phone: string;
  isAdmin: boolean;
  type?: 'admin' | 'vendor';
  vendorName?: string;
  name?: string;
}

// Inject the authenticated user (set by JwtAuthGuard) into a handler param.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
