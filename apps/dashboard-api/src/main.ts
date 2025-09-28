import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);

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
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 3000;
    await app.listen(port);
    Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
    Logger.log(`📄 Swagger documentation is available at: http://localhost:${port}/api/docs`);
}

bootstrap();
