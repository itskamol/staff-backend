import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { SharedDatabaseModule } from '@app/shared/database';
import { SharedAuthModule, JwtAuthGuard, RolesGuard, DataScopeGuard } from '@app/shared/auth';
import { SharedUtilsModule, GlobalExceptionFilter } from '@app/shared/utils';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../modules/auth/auth.module';
import { UserModule } from '../modules/user/user.module';
import { OrganizationModule } from '../modules/organization/organization.module';
import { DepartmentModule } from '../modules/department/department.module';
import { EmployeeModule } from '../modules/employee/employee.module';
import { VisitorModule } from '../modules/visitor/visitor.module';
import { PolicyModule } from '../modules/policy/policy.module';
import { LoggerModule } from '../core/logger';
import { MorganLoggerMiddleware } from '../shared/middleware';
import { TenantContextInterceptor } from '../shared/interceptors';
import { DeviceModule } from '../modules/devices/device.module';
import { GateModule } from '../modules/gate/gate.module';
import { CredentialModule } from '../modules/credential/credential.module';
import { HikvisionModule } from '../modules/hikvision/hikvision.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', '.env.local'],
        }),
        SharedDatabaseModule,
        SharedAuthModule,
        SharedUtilsModule,
        AuthModule,
        UserModule,
        OrganizationModule,
        DepartmentModule,
        EmployeeModule,
        VisitorModule,
        DeviceModule,
        PolicyModule,
        LoggerModule,
        GateModule,
        CredentialModule,
        HikvisionModule
    ],
    controllers: [AppController],
    providers: [
        AppService,
        {
            provide: APP_FILTER,
            useClass: GlobalExceptionFilter,
        },
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: RolesGuard,
        },
        {
            provide: APP_GUARD,
            useClass: DataScopeGuard,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: TenantContextInterceptor,
        },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(MorganLoggerMiddleware)
            .exclude('health', 'favicon.ico')
            .forRoutes({ path: '*path', method: RequestMethod.ALL });

    }
}
