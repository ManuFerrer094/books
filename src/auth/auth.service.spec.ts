import { jest } from '@jest/globals';
import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthClientFactory } from './auth-client.factory';

describe('AuthService', () => {
  const response = {
    data: {
      user: { id: 'user-a', email: 'a@example.com' },
      session: {
        access_token: 'access-a',
        refresh_token: 'refresh-a',
        expires_in: 3600,
        token_type: 'bearer',
      },
    },
    error: null,
  };
  const operation = jest.fn<() => Promise<any>>();
  const client = {
    auth: {
      signUp: operation,
      signInWithPassword: operation,
      refreshSession: operation,
      getUser: operation,
      admin: { signOut: operation },
    },
  };
  const clients = { create: jest.fn(() => client) };
  const service = new AuthService(clients as unknown as AuthClientFactory);
  beforeEach(() => {
    jest.clearAllMocks();
    operation.mockResolvedValue(response);
  });

  it('returns tokens from login without retaining a shared session', async () => {
    await expect(
      service.login({ email: 'a@example.com', password: 'password' }),
    ).resolves.toEqual(response.data);
    expect(clients.create).toHaveBeenCalledTimes(1);
  });
  it('supports signup with email confirmation and no session', async () => {
    operation.mockResolvedValue({
      ...response,
      data: { ...response.data, session: null },
    });
    await expect(
      service.register({ email: 'a@example.com', password: 'password' }),
    ).resolves.toMatchObject({ session: null });
  });
  it('passes refresh tokens to an isolated client', async () => {
    await service.refresh('refresh-a');
    expect(operation).toHaveBeenCalledWith({ refresh_token: 'refresh-a' });
  });
  it('verifies access tokens with the Auth server', async () => {
    await expect(service.verify('access-a')).resolves.toEqual(
      response.data.user,
    );
    expect(operation).toHaveBeenCalledWith('access-a');
  });
  it('revokes only the current login on logout', async () => {
    await service.logout('access-a');
    expect(operation).toHaveBeenCalledWith('access-a', 'local');
  });
  it.each(['login', 'verify', 'refresh'] as const)(
    'rejects invalid credentials/session for %s',
    async (action) => {
      operation.mockResolvedValue({
        data: { user: null, session: null },
        error: { status: 400, message: 'Private details' },
      });
      const call =
        action === 'login'
          ? service.login({ email: 'a@example.com', password: 'password' })
          : service[action]('token');
      await expect(call).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );
  it('maps invalid registration to a generic 400', async () => {
    operation.mockResolvedValue({ data: {}, error: { status: 422 } });
    await expect(
      service.register({ email: 'a@example.com', password: 'password' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('preserves rate limiting as 429', async () => {
    operation.mockResolvedValue({ data: {}, error: { status: 429 } });
    await expect(service.verify('token')).rejects.toMatchObject({
      status: 429,
    });
  });
  it('distinguishes unavailable auth from invalid credentials', async () => {
    operation.mockResolvedValue({ data: {}, error: { status: 503 } });
    await expect(service.verify('token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    operation.mockRejectedValue(new Error('Network failure'));
    await expect(service.verify('token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
