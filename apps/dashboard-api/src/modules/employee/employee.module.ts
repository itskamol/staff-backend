import { Module } from '@nestjs/common';
import { SharedCommonModule } from '@app/shared/common';
import { EmployeeController } from './controllers/employee.controller';
import { EmployeeService } from './services/employee.service';
import { DepartmentService } from '../department/department.service';
import { PolicyService } from '../policy/services/policy.service';
import { EmployeeRepository } from './repositories/employee.repository';
import { DepartmentRepository } from '../department/department.repository';
import { PolicyRepository } from '../policy/repositories/policy.repository';
import { HikvisionService } from '../hikvision/hikvision.service';
import { ConfigService } from '../../core/config/config.service';

@Module({
    imports: [SharedCommonModule],
    controllers: [EmployeeController],
    providers: [
        EmployeeService,
        DepartmentService,
        EmployeeRepository,
        DepartmentRepository,
        PolicyService,
        PolicyRepository,
        HikvisionService,
        ConfigService
    ],
    exports: [EmployeeService, EmployeeRepository],
})
export class EmployeeModule {}
