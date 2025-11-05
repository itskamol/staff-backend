import { Module } from '@nestjs/common';
import { EmployeePlanService } from './employee-plan.service';
import { EmployeePlanRepository } from './employee-plan.repository';
import { EmployeePlanController } from './employee-plan.controller';

@Module({
  controllers: [EmployeePlanController],
  providers: [EmployeePlanService, EmployeePlanRepository],
})
export class EmployeePlanModule {}
