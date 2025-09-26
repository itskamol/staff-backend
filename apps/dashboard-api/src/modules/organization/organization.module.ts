import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@staff-control-system/shared/database';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

@Module({
  imports: [SharedDatabaseModule],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}