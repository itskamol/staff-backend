import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { GateService } from './services/gate.service';
import { GateController } from './controllers/gate.controller';
import { GateRepository } from './repositories/gate.repository';
import { JOB } from '../../shared/constants';
import { BullModule } from '@nestjs/bullmq';

@Module({
    imports: [
        SharedDatabaseModule,
        BullModule.registerQueue({
            name: JOB.DEVICE.NAME,
        }),
    ],
    controllers: [GateController],
    providers: [GateService, GateRepository],
    exports: [GateService],
})
export class GateModule {}
