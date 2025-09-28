import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [ReportsController],
    providers: [ReportsService],
    exports: [ReportsService],
})
export class ReportsModule {}
