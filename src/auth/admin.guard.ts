import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthRequest } from './auth.guard';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    // app_metadata is managed by the server, unlike user_metadata.
    if (request.user?.app_metadata?.role !== 'admin')
      throw new ForbiddenException('Administrator access required');
    return true;
  }
}
