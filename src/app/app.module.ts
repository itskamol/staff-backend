import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';

import { ConfigModule } from '@/core/config/config.module';
import { DatabaseModule } from '@/core/database/database.module';
import { LoggerModule } from '@/core/logger/logger.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { UserModule } from '@/modules/user/user.module';

import { GlobalExceptionFilter } from '@/shared/filters';
import { DataScopeGuard, JwtAuthGuard, RolesGuard } from '@/shared/guards';
import { MorganLoggerMiddleware } from '@/shared/middleware';
import { XmlJsonService } from '@/shared/services/xml-json.service';
import { OrganizationModule } from '@/modules/organization/organization.module';
import { ResponseInterceptor } from '@/shared/interceptors/response.interceptor';
import { DepartmentModule } from '@/modules/department/department.module';
@Module({
    imports: [
        ConfigModule,
        DatabaseModule,
        LoggerModule,
        HealthModule,
        AuthModule,
        UserModule,
        OrganizationModule,
        DepartmentModule
    ],
    controllers: [AppController],
    providers: [
        AppService,
        XmlJsonService,
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
            useClass: DataScopeGuard,
        },
        {
            provide: APP_GUARD,
            useClass: RolesGuard,
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
