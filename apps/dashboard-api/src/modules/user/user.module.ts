import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@staff-control-system/shared/database';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [SharedDatabaseModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}