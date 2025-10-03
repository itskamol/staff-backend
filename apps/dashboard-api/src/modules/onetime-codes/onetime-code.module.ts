import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { OnetimeCodeService } from './services/onetime-code.service';
import { OnetimeCodeController } from './controllers/onetime-code.controller';
import { OnetimeCodeRepository } from './repositories/onetime-code.repository';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [OnetimeCodeController],
    providers: [OnetimeCodeService, OnetimeCodeRepository],
    exports: [OnetimeCodeService],
})
export class OnetimeCodeModule {}