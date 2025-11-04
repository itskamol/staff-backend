import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Interface for defining Swagger documentation options.
 */
export interface SwaggerOptions {
    /** The title of the API. */
    title: string;
    /** A description of the API. */
    description: string;
    /** The version of the API. Defaults to '1.0'. */
    version?: string;
    /** A list of tags to display in Swagger UI. */
    tags?: string[];
    /** A list of extra models to include in the Swagger definition. */
    extraModels?: Function[];
    /** Whether to enable API Key authentication. */
    useApiKeyAuth?: boolean;
    /** Whether to enable Bearer Token authentication. */
    useBearerAuth?: boolean;
}

/**
 * Sets up Swagger documentation for a NestJS application.
 *
 * @param app The NestJS application instance.
 * @param options The configuration options for Swagger.
 */
export function setupSwagger(app: INestApplication, path: string, options: SwaggerOptions) {
    const builder = new DocumentBuilder()
        .setTitle(options.title)
        .setDescription(options.description)
        .setVersion(options.version || '1.0');

    if (options.tags) {
        options.tags.forEach(tag => builder.addTag(tag));
    }

    if (options.useBearerAuth) {
        builder.addBearerAuth();
    }

    if (options.useApiKeyAuth) {
        builder.addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key');
    }

    const config = builder.build();

    const document = SwaggerModule.createDocument(app, config, {
        extraModels: options.extraModels || [],
    });

    SwaggerModule.setup(path, app, document, {
        jsonDocumentUrl: `${path}-json`,
        customSiteTitle: `${options.title} Docs`,
    });
}