import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { SharedDatabaseModule } from '@app/shared/database';
import { SharedAuthModule, JwtAuthGuard, RolesGuard, DataScopeGuard } from '@app/shared/auth';
import { SharedUtilsModule, ResponseInterceptor, GlobalExceptionFilter } from '@app/shared/utils';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../modules/auth/auth.module';
import { UserModule } from '../modules/user/user.module';
import { OrganizationModule } from '../modules/organization/organization.module';
import { DepartmentModule } from '../modules/department/department.module';
import { EmployeeModule } from '../modules/employee/employee.module';
import { VisitorModule } from '../modules/visitor/visitor.module';
import { ReportsModule } from '../modules/reports/reports.module';
import { PolicyModule } from '../modules/policy/policy.module';
import { LoggerModule } from '../core/logger';
import { MorganLoggerMiddleware } from '../shared/middleware';

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
        ReportsModule,
        PolicyModule,
        LoggerModule
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
