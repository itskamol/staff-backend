import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { OnetimeCodeService } from './services/onetime-code.service';
import { OnetimeCodeController } from './controllers/onetime-code.controller';
import { OnetimeCodeRepository } from './repositories/onetime-code.repository';
import { JOB } from '../../shared/constants';
import { BullModule } from '@nestjs/bullmq';

@Module({
    imports: [
        SharedDatabaseModule,
        BullModule.registerQueue({
            name: JOB.VISITOR.NAME,
        }),
    ],
    controllers: [OnetimeCodeController],
    providers: [OnetimeCodeService, OnetimeCodeRepository],
    exports: [OnetimeCodeService],
})
export class OnetimeCodeModule {}
