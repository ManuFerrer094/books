import { Module } from '@nestjs/common';
import { AuthClientFactory } from './auth-client.factory';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [AuthClientFactory, AuthService, AuthGuard, AdminGuard],
  exports: [AuthClientFactory, AuthService, AuthGuard, AdminGuard],
})
export class AuthModule {}
