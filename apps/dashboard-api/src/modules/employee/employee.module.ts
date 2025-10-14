import { Module } from '@nestjs/common';
import { EmployeeController } from './controllers/employee.controller';
import { EmployeeService } from './services/employee.service';
import { DepartmentService } from '../department/department.service';
import { PolicyService } from '../policy/services/policy.service';
import { EmployeeRepository } from './repositories/employee.repository';
import { DepartmentRepository } from '../department/department.repository';
import { PolicyRepository } from '../policy/repositories/policy.repository';

@Module({
    imports: [],
    controllers: [EmployeeController],
    providers: [
        EmployeeService,
        DepartmentService,
        EmployeeRepository,
        DepartmentRepository,
        PolicyService,
        PolicyRepository
    ],
    exports: [EmployeeService, EmployeeRepository],
})
export class EmployeeModule {}
