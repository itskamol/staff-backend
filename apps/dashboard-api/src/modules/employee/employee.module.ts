import { Module } from '@nestjs/common';
import { EmployeeController } from './controllers/employee.controller';
import { EmployeeGroupController } from './controllers/employee-group.controller';
import { EmployeeService } from './services/employee.service';
import { EmployeeGroupService } from './services/employee-group.service';
import { EmployeeRepository } from './employee.repository';
import { EmployeeGroupRepository } from './repositories/employee-group.repository';
import { DepartmentService } from '../department/department.service';
import { DepartmentRepository } from '../department/department.repository';

@Module({
    imports: [],
    controllers: [EmployeeController, EmployeeGroupController],
    providers: [
        EmployeeService,
        EmployeeGroupService,
        DepartmentService,
        EmployeeRepository,
        EmployeeGroupRepository,
        DepartmentRepository
    ],
    exports: [EmployeeService, EmployeeGroupService, EmployeeRepository, EmployeeGroupRepository],
})
export class EmployeeModule {}
