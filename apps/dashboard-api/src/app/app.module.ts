import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { SharedDatabaseModule } from '@app/shared/database';
import { GlobalExceptionFilter, SharedUtilsModule } from '@app/shared/utils';

import { AuthModule } from '../modules/auth/auth.module';
import { UserModule } from '../modules/user/user.module';
import { OrganizationModule } from '../modules/organization/organization.module';
import { DepartmentModule } from '../modules/department/department.module';
import { EmployeeModule } from '../modules/employee/employee.module';
import { VisitorModule } from '../modules/visitor/visitor.module';
import { PolicyModule } from '../modules/policy/policy.module';
import { LoggerModule } from '../core/logger';
import { MorganLoggerMiddleware } from '../shared/middleware';
import { TenantContextInterceptor } from '@app/shared/common';
import { DeviceModule } from '../modules/devices/device.module';
import { GateModule } from '../modules/gate/gate.module';
import { CredentialModule } from '../modules/credential/credential.module';
import { HikvisionModule } from '../modules/hikvision/hikvision.module';
import { EmployeeSyncModule } from '../modules/employeeSync/employee-sync.module';
import { ActionModule } from '../modules/action/action.module';
import { EmployeePlanModule } from '../modules/employeePlan/employee-plan.module';
import { AttendanceModule } from '../modules/attendance/attendance.module';
import { ConfigModule } from '../core/config/config.module';
import { QueueModule } from '../modules/queue/queue.module';
import { ReasonModule } from '../modules/reasons/reason.module';
import { SharedAuthModule } from '@app/shared/auth';
import { DataScopeGuard, JwtAuthGuard, RolesGuard } from '../shared/guards';
import { JobModule } from '../modules/jobs/job.module';
import { ReportsModule } from '../modules/reports/reports.module';

@Module({
    imports: [
        ConfigModule,
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
        HikvisionModule,
        EmployeeSyncModule,
        ActionModule,
        EmployeePlanModule,
        AttendanceModule,
        QueueModule,
        ReasonModule,
        JobModule,
        ReportsModule,
    ],
    providers: [
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
