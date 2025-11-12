import { Module } from '@nestjs/common';
import { EmployeePlanService } from './employee-plan.service';
import { EmployeePlanRepository } from './employee-plan.repository';
import { EmployeePlanController } from './employee-plan.controller';
import { EmployeeModule } from '../employee/employee.module';

@Module({
  imports: [EmployeeModule],
  controllers: [EmployeePlanController],
  providers: [EmployeePlanService, EmployeePlanRepository],
})
export class EmployeePlanModule {}
