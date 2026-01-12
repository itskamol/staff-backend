import { Module } from '@nestjs/common';
import { HikvisionController } from './controllers/hikvision.controller';
import { GateModule } from '../gate/gate.module';
import { ActionModule } from '../action/action.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { EmployeeRepository } from '../employee/repositories/employee.repository';
import { XmlJsonService } from '../../shared/services/xtml-json.service';
import { EncryptionService } from '../../shared/services/encryption.service';
import { HikvisionAnprService } from './services/hikvision.anpr.service';
import { HikvisionAccessService } from './services/hikvision.access.service';
import { HikvisionCoreService } from './core/hikvision.core.service';
import { CredentialRepository } from '../credential/repositories/credential.repository';

@Module({
    imports: [GateModule, ActionModule, AttendanceModule],
    controllers: [HikvisionController],
    providers: [
        HikvisionAnprService,
        HikvisionAccessService,
        HikvisionCoreService,
        EmployeeRepository,
        XmlJsonService,
        EncryptionService,
        CredentialRepository,
    ],
    exports: [HikvisionAccessService, HikvisionAnprService, HikvisionCoreService],
})
export class HikvisionModule {}
