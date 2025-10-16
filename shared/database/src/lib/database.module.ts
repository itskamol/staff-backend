import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';
import { DualPrismaService } from './dual-prisma.service';
import { QueryRoutingService } from './query-routing.service';
import { DatasourceHealthService } from './datasource-health.service';
import { FallbackRecoveryService } from './fallback-recovery.service';
import { BufferedSyncService } from './buffered-sync.service';
import { TimescaleIntegrationService } from './timescale-integration.service';
import { DataMigrationService } from './data-migration.service';
import { MigrationMonitoringService } from './migration-monitoring.service';
import { TimescaleTestingService } from './timescale-testing.service';
import { RlsSessionService } from './rls-session.service';
import { RlsAwarePrismaService } from './rls-aware-prisma.service';

@Global()
@Module({
    imports: [ConfigModule, ScheduleModule.forRoot()],
    providers: [
        PrismaService,
        DualPrismaService,
        QueryRoutingService,
        DatasourceHealthService,
        FallbackRecoveryService,
        BufferedSyncService,
        TimescaleIntegrationService,
        DataMigrationService,
        MigrationMonitoringService,
        TimescaleTestingService,
        RlsSessionService,
        RlsAwarePrismaService,
    ],
    exports: [
        PrismaService,
        DualPrismaService,
        QueryRoutingService,
        DatasourceHealthService,
        FallbackRecoveryService,
        BufferedSyncService,
        TimescaleIntegrationService,
        DataMigrationService,
        MigrationMonitoringService,
        TimescaleTestingService,
        RlsSessionService,
        RlsAwarePrismaService,
    ],
})
export class SharedDatabaseModule {}
