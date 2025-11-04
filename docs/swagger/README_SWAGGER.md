# Swagger Documentation Guide

This document provides an overview of the centralized Swagger setup in the monorepo and instructions on how to use it.

## 1. API Overview

Our monorepo contains multiple NestJS applications, each with its own API. To maintain consistency and reduce code duplication, we use a shared, reusable Swagger setup module. This module allows us to generate standardized API documentation for all services from a single, configurable source.

The primary goals of this setup are:
- **Consistency:** Ensure all API documentation has a similar look, feel, and structure.
- **Reusability:** Avoid duplicating Swagger setup code across multiple applications.
- **Maintainability:** Simplify updates to the documentation setup by managing it in one place.

## 2. Swagger UI URLs

The generated Swagger documentation for each service is available at the following URLs:

- **Dashboard API:** [/dashboard/docs](/dashboard/docs)
- **Agent API:** [/agent/docs](/agent/docs)
- **Agent Gateway:** [/gateway/docs](/gateway/docs)

## 3. How to Add Swagger to a New Application

To enable Swagger documentation for a new or existing NestJS application, follow these steps:

1.  **Import `setupSwagger`**: In your application's `main.ts` file, import the setup function:

    ```ts
    import { setupSwagger } from '@app/shared/common';
    ```

2.  **Call `setupSwagger`**: After creating the NestJS application instance, call the `setupSwagger` function with the desired path and options.

    ```ts
    async function bootstrap() {
        const app = await NestFactory.create(AppModule);

        // ... other application setup (pipes, prefixes, etc.)

        setupSwagger(app, 'my-api/docs', {
            title: 'My New API',
            description: 'A description of my new API.',
            version: '1.0',
            useBearerAuth: true,
            tags: ['Users', 'Products'],
        });

        // ... start the application
        await app.listen(3000);
    }
    bootstrap();
    ```

## 4. Common Best Practices

- **Use `@ApiTags`**: Group related endpoints within a controller under a common tag.
- **Use `@ApiOperation`**: Provide a clear and concise summary for each endpoint.
- **Use `@ApiResponse`**: Document all possible responses (success and error) with their status codes and DTOs.
- **Use `@ApiProperty`**: Annotate all properties in your DTOs with descriptions and examples.
- **Use `@ApiBearerAuth`**: Secure endpoints that require JWT authentication.
- **Keep DTOs specific**: Create specific DTOs for request bodies and responses to ensure clear contracts.
- **Leverage `ApiCrudOperation`**: For standard CRUD operations, use the custom `@ApiCrudOperation` decorator to reduce boilerplate.