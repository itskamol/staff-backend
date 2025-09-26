import { Module } from '@nestjs/common';
import { SharedAuthModule } from '@app/shared/auth';
import { SharedDatabaseModule } from '@app/shared/database';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [SharedAuthModule, SharedDatabaseModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}