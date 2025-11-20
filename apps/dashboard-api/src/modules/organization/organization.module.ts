import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationRepository } from './organization.repository';
import { SharedDatabaseModule } from '@app/shared/database';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [OrganizationController],
    providers: [OrganizationService, OrganizationRepository],
    exports: [OrganizationService],
})
export class OrganizationModule {}
