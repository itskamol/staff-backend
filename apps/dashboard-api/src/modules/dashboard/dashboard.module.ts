import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [DashboardController],
    providers: [DashboardService],
    exports: [DashboardService],
})
export class DashboardModule {}
