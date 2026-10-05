import { Module } from '@nestjs/common';
import { AuthClientFactory } from './auth-client.factory.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { AuthController } from './auth.controller.js';

@Module({
  controllers: [AuthController],
  providers: [AuthClientFactory, AuthService, AuthGuard, AdminGuard],
  exports: [AuthClientFactory, AuthService, AuthGuard, AdminGuard],
})
export class AuthModule {}
