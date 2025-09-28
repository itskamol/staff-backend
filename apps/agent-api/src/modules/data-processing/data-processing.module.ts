import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SharedDatabaseModule } from '@app/shared/database';
import { DataProcessingController } from './data-processing.controller';
import { DataProcessingService } from './data-processing.service';

@Module({
    imports: [SharedDatabaseModule, ScheduleModule.forRoot()],
    controllers: [DataProcessingController],
    providers: [DataProcessingService],
    exports: [DataProcessingService],
})
export class DataProcessingModule {}
