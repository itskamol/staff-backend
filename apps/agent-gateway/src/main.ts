import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { setupSwagger, TenantContextInterceptor } from '@app/shared/common';
import { PrismaService } from '@app/shared/database';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });

    // Setup RLS Tenant Context Interceptor
    const prismaService = app.get(PrismaService);
    app.useGlobalInterceptors(new TenantContextInterceptor(prismaService));

    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
        })
    );

    setupSwagger(app, 'gateway/docs', {
        title: 'Staff Control System - Agent Gateway',
        description: 'API Gateway for agent communication',
        version: '1.0',
    });

    const port = Number(process.env.PORT) || 4100;
    await app.listen(port, '0.0.0.0');
    Logger.log(`Agent Gateway listening on http://localhost:${port}/v1/health`, 'Bootstrap');
}

bootstrap().catch(error => {
    Logger.error(`Failed to bootstrap Agent Gateway: ${(error as Error).message}`, error?.stack);
    process.exit(1);
});
