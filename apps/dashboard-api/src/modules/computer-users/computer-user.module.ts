import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { ComputerUserService } from './services/computer-user.service';
import { ComputerUserController } from './controllers/computer-user.controller';
import { ComputerUserRepository } from './repositories/computer-user.repository';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [ComputerUserController],
    providers: [ComputerUserService, ComputerUserRepository],
    exports: [ComputerUserService],
})
export class ComputerUserModule {}