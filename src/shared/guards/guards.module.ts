import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { DataScopeGuard } from './data-scope.guard';
import { RolesGuard } from './roles.guard';
import { DeviceAuthGuard } from './device-auth.guard';

@Module({
    providers: [JwtAuthGuard, DataScopeGuard, RolesGuard, DeviceAuthGuard],
    exports: [JwtAuthGuard, DataScopeGuard, RolesGuard, DeviceAuthGuard],
})
export class GuardsModule {}
