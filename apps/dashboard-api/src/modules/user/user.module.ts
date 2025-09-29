import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';
import { LoggerService } from '../../core/logger';
import { DataSanitizerService } from '../../shared/services/data-sanitizer.service';

@Module({
    controllers: [UserController],
    providers: [UserRepository, UserService, LoggerService, DataSanitizerService],
    exports: [UserRepository, UserService],
})
export class UserModule {}
