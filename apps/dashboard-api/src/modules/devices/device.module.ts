import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { DeviceService } from './services/device.service';
import { DeviceController } from './controllers/device.controller';
import { DeviceRepository } from './repositories/device.repository';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [DeviceController],
    providers: [DeviceService, DeviceRepository],
    exports: [DeviceService],
})
export class DeviceModule {}