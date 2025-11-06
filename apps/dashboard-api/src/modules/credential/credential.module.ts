import { Module } from '@nestjs/common';
import { SharedCommonModule } from '@app/shared/common';
import { CredentialController } from './controllers/credential.controller';
import { CredentialRepository } from './repositories/credential.repository';
import { CredentialService } from './services/credential.services';
import { EmployeeModule } from '../employee/employee.module';

@Module({
    imports: [
        SharedCommonModule,
        EmployeeModule
    ],
    controllers: [CredentialController],
    providers: [
        CredentialService,
        CredentialRepository,
    ],
})
export class CredentialModule {}
