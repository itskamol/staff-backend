import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { VisitorService } from './services/visitor.service';
import { VisitorController } from './controllers/visitor.controller';
import { VisitorRepository } from './repositories/visitor.repository';
import { VisitorProcessor } from '../queue/job/visitor.processor';
import { HikvisionModule } from '../hikvision/hikvision.module';
import { BullModule } from '@nestjs/bullmq';
import { JOB } from '../../shared/constants';

@Module({
    imports: [
        SharedDatabaseModule,
        HikvisionModule,
        BullModule.registerQueue({ name: JOB.VISITOR.NAME }),
    ],
    controllers: [VisitorController],
    providers: [VisitorService, VisitorRepository, VisitorProcessor],
    exports: [VisitorService],
})
export class VisitorModule {}
