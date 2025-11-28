import { Module } from '@nestjs/common';
import { SharedCommonModule } from '@app/shared/common';
import { ReasonRepository } from './repositories/reason.repository';
import { ReasonController } from './controller/reason.controller';
import { ReasonService } from './service/reason.service';

@Module({
    imports: [SharedCommonModule],
    controllers: [ReasonController],
    providers: [ReasonService, ReasonRepository],
    exports: [ReasonService, ReasonRepository],
})
export class ReasonModule {}
