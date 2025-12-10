import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { ConfigService } from './core/config/config.service';
import { CustomValidationException } from './shared/exceptions/validation.exception';
import { LoggerService } from './core/logger';
import { ApiErrorResponse, ApiPaginatedResponse, ApiSuccessResponse } from './shared/dto';
import { setupSwagger } from '@app/shared/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as bodyParser from 'body-parser';
import { rawBodyMiddleware } from './modules/hikvision/core/middleware';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    const prefix = '/api/v1';
    const logger = app.get(LoggerService);
    app.useLogger(logger);

    app.useStaticAssets(join(process.cwd(), 'storage'), { prefix: '/api/storage' });

    app.use(bodyParser.raw({ type: ['application/xml', 'text/xml'], limit: '1mb' }));

    app.use(`${prefix}/hikvision/event`, rawBodyMiddleware);
    app.use(`${prefix}/hikvision/anpr-event`, rawBodyMiddleware);

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

    app.setGlobalPrefix(prefix);

    setupSwagger(app, prefix, {
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
            'Gates',
            'Devices',
            'Credentials',
            'Hikvisions',
            'Employee-sync',
            'Actions',
            'Schedule',
            'Attendance',
            'Reasons',
            'Jobs',
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
