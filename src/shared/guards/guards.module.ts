import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { DataScopeGuard } from './data-scope.guard';
import { RolesGuard } from './roles.guard';

@Module({
    providers: [JwtAuthGuard, DataScopeGuard, RolesGuard],
    exports: [JwtAuthGuard, DataScopeGuard, RolesGuard],
})
export class GuardsModule {}
