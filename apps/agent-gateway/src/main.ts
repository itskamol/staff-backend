import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
        })
    );

    const port = Number(process.env.PORT) || 4100;
    await app.listen(port, '0.0.0.0');
    Logger.log(`Agent Gateway listening on http://localhost:${port}/v1/health`, 'Bootstrap');
}

bootstrap().catch(error => {
    Logger.error(`Failed to bootstrap Agent Gateway: ${(error as Error).message}`, error?.stack);
    process.exit(1);
});
