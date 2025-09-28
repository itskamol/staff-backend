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
        .setTitle('Staff Control System - Agent API')
        .setDescription('Data collection API for computer monitoring and access control systems')
        .setVersion('1.0')
        .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
        .addBearerAuth()
        .addTag('Agent', 'Computer monitoring data collection')
        .addTag('HIKVision', 'HIKVision access control integration')
        .addTag('Data Processing', 'Asynchronous data processing')
        .addTag('Security', 'API security management')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.AGENT_API_PORT || 3001;
    await app.listen(port);
    Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
    Logger.log(`📄 Swagger documentation is available at: http://localhost:${port}/api/docs`);
}

bootstrap();
