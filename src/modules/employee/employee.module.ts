import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeRepository } from './employee.repository';

@Module({
    imports: [],
    controllers: [EmployeeController],
    providers: [EmployeeService, EmployeeRepository],
    exports: [EmployeeService, EmployeeRepository],
})
export class EmployeeModule {}