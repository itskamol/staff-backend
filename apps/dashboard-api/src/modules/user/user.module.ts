import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService],
})
export class UserModule {}
