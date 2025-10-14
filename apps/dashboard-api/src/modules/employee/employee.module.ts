import { Module } from '@nestjs/common';
import { EmployeeController } from './controllers/employee.controller';
import { EmployeeService } from './repositories/employee.service';
import { EmployeeRepository } from './employee.repository';
import { DepartmentService } from '../department/department.service';
import { DepartmentRepository } from '../department/department.repository';

@Module({
    imports: [],
    controllers: [EmployeeController],
    providers: [
        EmployeeService,
        DepartmentService,
        EmployeeRepository,
        DepartmentRepository
    ],
    exports: [EmployeeService, EmployeeRepository],
})
export class EmployeeModule {}
