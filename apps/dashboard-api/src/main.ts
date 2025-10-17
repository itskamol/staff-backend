import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { ConfigService } from './core/config/config.service';
import { CustomValidationException } from './shared/exceptions/validation.exception';
import { LoggerService } from './core/logger';
import { ApiErrorResponse, ApiPaginatedResponse, ApiSuccessResponse } from './shared/dto';
import { setupSwagger, TenantContextInterceptor } from '@app/shared/common';
import { PrismaService } from '@app/shared/database';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Setup RLS Tenant Context Interceptor
    const prismaService = app.get(PrismaService);
    app.useGlobalInterceptors(new TenantContextInterceptor(prismaService));

    const logger = app.get(LoggerService);
    app.useLogger(logger);

    const configService = app.get(ConfigService);
    const port = configService.port;

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: errors => new CustomValidationException(errors),
        })
    );

    app.setGlobalPrefix('api/v1');

    setupSwagger(app, 'dashboard/docs', {
        title: 'Staff Control System - Dashboard API',
        description: 'Comprehensive API for staff management, monitoring, and reporting',
        version: '1.0',
        useBearerAuth: true,
        tags: [
            'Authentication',
            'Users',
            'Organizations',
            'Departments',
            'Employees',
            'Visitors',
            'Policies',
        ],
        extraModels: [ApiSuccessResponse, ApiErrorResponse, ApiPaginatedResponse],
    });

    app.enableCors();

    await app.listen(port, '0.0.0.0');

    logger.log(`Application started successfully`, {
        port,
        environment: configService.nodeEnv,
        module: 'bootstrap',
    });

    logger.log(`Application is running on: http://localhost:${port}/api/v1`);
}

bootstrap().catch(error => {
    // eslint-disable-next-line no-console
    console.error('Failed to start application:', error);
    process.exit(1);
});
