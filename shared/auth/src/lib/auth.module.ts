import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from './jwt.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { DataScopeGuard } from './guards/data-scope.guard';

@Module({
    imports: [
        PassportModule,
        JwtModule.register({
            secret: process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-here-32-chars',
            signOptions: { expiresIn: '15m' },
        }),
    ],
    providers: [JwtService, JwtStrategy, JwtAuthGuard, RolesGuard, DataScopeGuard],
    exports: [JwtService, JwtAuthGuard, RolesGuard, DataScopeGuard, JwtModule, PassportModule],
})
export class SharedAuthModule {}
