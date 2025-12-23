import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationRepository } from './organization.repository';
import { SharedDatabaseModule } from '@app/shared/database';
import { BullModule } from '@nestjs/bullmq';
import { JOB } from '../../shared/constants';

@Module({
    imports: [SharedDatabaseModule, BullModule.registerQueue({ name: JOB.DEVICE.NAME })],
    controllers: [OrganizationController],
    providers: [OrganizationService, OrganizationRepository],
    exports: [OrganizationService],
})
export class OrganizationModule {}
