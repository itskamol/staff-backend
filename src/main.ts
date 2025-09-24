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
        .setTitle('Sector Staff API')
        .setDescription('API documentation for the Sector Staff application')
        .setVersion('2.1.0')
        .addTag('API')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config, {
        extraModels: [ApiSuccessResponse, ApiErrorResponse, ApiPaginatedResponse],
    });

    SwaggerModule.setup('api/v1', app, document, {
        jsonDocumentUrl: 'api/v1/json',
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
