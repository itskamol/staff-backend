import { Module } from '@nestjs/common';
import { SharedCommonModule } from '@app/shared/common';
import { CredentialController } from './controllers/credential.controller';
import { CredentialRepository } from './repositories/credential.repository';
import { CredentialService } from './services/credential.services';
import { EmployeeModule } from '../employee/employee.module';
import { HikvisionModule } from '../hikvision/hikvision.module';

@Module({
    imports: [SharedCommonModule, EmployeeModule, HikvisionModule],
    controllers: [CredentialController],
    providers: [CredentialService, CredentialRepository],
    exports: [CredentialService, CredentialRepository],
})
export class CredentialModule {}
