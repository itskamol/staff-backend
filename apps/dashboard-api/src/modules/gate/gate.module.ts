import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { GateService } from './services/gate.service';
import { GateController } from './controllers/gate.controller';
import { GateRepository } from './repositories/gate.repository';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [GateController],
    providers: [GateService, GateRepository],
    exports: [GateService],
})
export class GateModule {}