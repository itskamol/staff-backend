import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { DeviceService } from './services/device.service';
import { DeviceController } from './controllers/device.controller';
import { DeviceRepository } from './repositories/device.repository';
import { GateRepository } from '../gate/repositories/gate.repository';
import { HikvisionModule } from '../hikvision/hikvision.module';
import { EmployeeModule } from '../employee/employee.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
    imports: [SharedDatabaseModule, HikvisionModule, EmployeeModule, DeviceModule,WebsocketModule],
    controllers: [DeviceController],
    providers: [DeviceService, DeviceRepository, GateRepository],
    exports: [DeviceService],
})
export class DeviceModule {}