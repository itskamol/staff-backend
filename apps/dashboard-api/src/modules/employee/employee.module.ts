import { forwardRef, Module } from '@nestjs/common';
import { SharedCommonModule } from '@app/shared/common';
import { EmployeeController } from './controllers/employee.controller';
import { EmployeeService } from './services/employee.service';
import { DepartmentService } from '../department/department.service';
import { PolicyService } from '../policy/services/policy.service';
import { EmployeeRepository } from './repositories/employee.repository';
import { DepartmentRepository } from '../department/department.repository';
import { PolicyRepository } from '../policy/repositories/policy.repository';
import { ConfigService } from '../../core/config/config.service';
import { XmlJsonService } from '../../shared/services/xtml-json.service';
import { EncryptionService } from '../../shared/services/encryption.service';
import { OrganizationModule } from '../organization/organization.module';
import { HikvisionAccessService } from '../hikvision/services/hikvision.access.service';
import { HikvisionCoreService } from '../hikvision/core/hikvision.core.service';
import { BullModule } from '@nestjs/bullmq';
import { JOB } from '../../shared/constants';

@Module({
    imports: [
        SharedCommonModule,
        OrganizationModule,
        BullModule.registerQueue({ name: JOB.DEVICE.NAME }),
    ],
    controllers: [EmployeeController],
    providers: [
        EmployeeService,
        DepartmentService,
        EmployeeRepository,
        DepartmentRepository,
        PolicyService,
        PolicyRepository,
    ],
    exports: [EmployeeService, EmployeeRepository],
})
export class EmployeeModule {}
