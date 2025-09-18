import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ConfigModule } from '@/core/config/config.module';

@Module({
    imports: [ConfigModule],
    controllers: [HealthController],
    providers: [HealthService],
})
export class HealthModule {}
