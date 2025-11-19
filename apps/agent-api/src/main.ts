import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { setupSwagger } from '@app/shared/common';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.useWebSocketAdapter(new WsAdapter(app));

    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);

    setupSwagger(app, 'agent/docs', {
        title: 'Staff Control System - Agent API',
        description: 'Data collection API for computer monitoring and access control systems',
        version: '1.0',
        useApiKeyAuth: true,
        useBearerAuth: true,
        tags: ['Agent', 'HIKVision', 'Data Processing', 'Security'],
    });

    const port = process.env.AGENT_API_PORT || 3001;
    await app.listen(port);
    Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
    Logger.log(`📄 Swagger documentation is available at: http://localhost:${port}/api/docs`);
}

bootstrap();
