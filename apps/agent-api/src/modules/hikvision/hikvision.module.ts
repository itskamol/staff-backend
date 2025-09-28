import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { HIKVisionController } from './hikvision.controller';
import { HIKVisionService } from './hikvision.service';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [HIKVisionController],
    providers: [HIKVisionService],
    exports: [HIKVisionService],
})
export class HIKVisionModule {}
