import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { DeviceService } from './services/device.service';
import { DeviceController } from './controllers/device.controller';
import { DeviceRepository } from './repositories/device.repository';
import { GateRepository } from '../gate/repositories/gate.repository';
import { HikvisionModule } from '../hikvision/hikvision.module';
import { EmployeeModule } from '../employee/employee.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { BullModule } from '@nestjs/bullmq';
import { JOB } from '../../shared/constants';
import { DeviceProcessor } from '../queue/job/device.processor';

@Module({
    imports: [
        BullModule.registerQueue({
            name: JOB.DEVICE.NAME,
        }),
        SharedDatabaseModule,
        HikvisionModule,
        EmployeeModule,
        DeviceModule,
        WebsocketModule,
    ],
    controllers: [DeviceController],
    providers: [DeviceService, DeviceRepository, GateRepository, DeviceProcessor],
    exports: [DeviceService],
})
export class DeviceModule {}
