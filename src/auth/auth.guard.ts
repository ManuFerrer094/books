import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@supabase/supabase-js';
import { AuthService } from './auth.service';

export interface AuthRequest extends Request {
  user: User;
  accessToken: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const header = request.headers.authorization;
    const match =
      typeof header === 'string' ? /^Bearer ([^\s]+)$/i.exec(header) : null;
    if (!match) throw new UnauthorizedException('Bearer access token required');
    request.user = await this.auth.verify(match[1]);
    request.accessToken = match[1];
    return true;
  }
}
