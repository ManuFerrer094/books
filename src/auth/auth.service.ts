import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Session, User } from '@supabase/supabase-js';
import { AuthClientFactory } from './auth-client.factory.js';
import { AuthResponseDto, LoginDto, RegisterDto } from './auth.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly clients: AuthClientFactory) {}

  private async operation<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch {
      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    }
  }

  private fail(
    error: { status?: number },
    action: 'register' | 'login' | 'verify' | 'refresh',
  ): never {
    if (error.status === 429)
      throw new HttpException(
        'Authentication rate limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    if (!error.status || error.status >= 500)
      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    if (action === 'register')
      throw new BadRequestException(
        'Unable to register with these credentials',
      );
    throw new UnauthorizedException(
      action === 'login'
        ? 'Invalid credentials or email not confirmed'
        : 'Invalid or expired session',
    );
  }

  private response(
    user: User | null,
    session: Session | null,
  ): AuthResponseDto {
    return {
      user: user ? { id: user.id, email: user.email } : null,
      session: session
        ? {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_in: session.expires_in,
            expires_at: session.expires_at,
            token_type: session.token_type,
          }
        : null,
    };
  }

  async register(credentials: RegisterDto) {
    const { data, error } = await this.operation(() =>
      this.clients.create().auth.signUp(credentials),
    );
    if (error) this.fail(error, 'register');
    return this.response(data.user, data.session);
  }

  async login(credentials: LoginDto) {
    const { data, error } = await this.operation(() =>
      this.clients.create().auth.signInWithPassword(credentials),
    );
    if (error) this.fail(error, 'login');
    return this.response(data.user, data.session);
  }

  async refresh(refresh_token: string) {
    const { data, error } = await this.operation(() =>
      this.clients.create().auth.refreshSession({ refresh_token }),
    );
    if (error) this.fail(error, 'refresh');
    return this.response(data.user, data.session);
  }

  async verify(accessToken: string): Promise<User> {
    const { data, error } = await this.operation(() =>
      this.clients.create().auth.getUser(accessToken),
    );
    if (error) this.fail(error, 'verify');
    if (!data.user)
      throw new UnauthorizedException('Invalid or expired session');
    return data.user;
  }

  async logout(accessToken: string) {
    const { error } = await this.operation(() =>
      this.clients.create().auth.admin.signOut(accessToken, 'local'),
    );
    if (error) this.fail(error, 'verify');
  }
}
