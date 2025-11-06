import { Module } from '@nestjs/common';
import { EmployeePlanService } from './employee-plan.service';
import { EmployeePlanRepository } from './employee-plan.repository';
import { EmployeePlanController } from './employee-plan.controller';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [OrganizationModule],
  controllers: [EmployeePlanController],
  providers: [EmployeePlanService, EmployeePlanRepository],
})
export class EmployeePlanModule {}
