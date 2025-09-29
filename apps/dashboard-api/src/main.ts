import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from './core/config/config.service';
import { CustomValidationException } from './shared/exceptions/validation.exception';
import { LoggerService } from './core/logger';
import { ApiErrorResponse, ApiPaginatedResponse, ApiSuccessResponse } from './shared/dto';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

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

    const config = new DocumentBuilder()
        .setTitle('Staff Control System - Dashboard API')
        .setDescription('Comprehensive API for staff management, monitoring, and reporting')
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('Authentication', 'User authentication and authorization')
        .addTag('Users', 'User management operations')
        .addTag('Organizations', 'Organization management')
        .addTag('Departments', 'Department management')
        .addTag('Employees', 'Employee management')
        .addTag('Visitors', 'Visitor management and access control')
        .addTag('Reports', 'Analytics and reporting')
        .addTag('Policies', 'Security and monitoring policies')
        .build();
    const document = SwaggerModule.createDocument(app, config, {
        extraModels: [ApiSuccessResponse, ApiErrorResponse, ApiPaginatedResponse],
    });

    SwaggerModule.setup('api/docs', app, document, {
        jsonDocumentUrl: 'api/docs-json',
        customSiteTitle: 'Sector Staff API Docs',
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
