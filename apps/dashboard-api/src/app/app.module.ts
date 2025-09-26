import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { SharedDatabaseModule } from '@app/shared/database';
import { SharedAuthModule, JwtAuthGuard, RolesGuard, DataScopeGuard } from '@app/shared/auth';
import { SharedUtilsModule, ResponseInterceptor, GlobalExceptionFilter } from '@app/shared/utils';
import { CoreModule } from '../core/core.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../modules/auth/auth.module';
import { UserModule } from '../modules/user/user.module';
import { OrganizationModule } from '../modules/organization/organization.module';
import { DepartmentModule } from '../modules/department/department.module';
import { EmployeeModule } from '../modules/employee/employee.module';
import { VisitorModule } from '../modules/visitor/visitor.module';
import { ReportsModule } from '../modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    CoreModule,
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
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
export class AppModule {}
