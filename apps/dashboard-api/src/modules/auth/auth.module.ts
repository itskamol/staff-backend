import { Module } from '@nestjs/common';
import { SharedAuthModule } from '@staff-control-system/shared/auth';
import { SharedDatabaseModule } from '@staff-control-system/shared/database';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [SharedAuthModule, SharedDatabaseModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}