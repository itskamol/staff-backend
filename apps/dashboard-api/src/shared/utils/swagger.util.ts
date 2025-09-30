import { applyDecorators, Type } from '@nestjs/common';
import {
    ApiBody,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiQueryOptions,
    ApiResponse,
    ApiResponseOptions,
    getSchemaPath,
} from '@nestjs/swagger';
import {
    ApiErrorResponse,
    ApiPaginatedResponse,
    ApiSuccessResponse,
} from '../dto/api-response.dto';

export const ApiOkResponseData = <DataDto extends Type<unknown>>(
    dataDto: DataDto,
    options?: { body?: Type; summary?: string }
) =>
    applyDecorators(
        ...(options?.body ? [ApiBody({ type: options.body })] : []),
        ApiOperation({ summary: options?.summary || 'Successful Operation' }),
        ApiOkResponse({
            schema: {
                allOf: [
                    { $ref: getSchemaPath(ApiSuccessResponse) },
                    {
                        properties: {
                            data: { $ref: getSchemaPath(dataDto) },
                        },
                    },
                ],
            },
        })
    );

export const ApiOkResponsePaginated = <DataDto extends Type<unknown>>(
    dataDto: DataDto,
    options?: { summary?: string }
) =>
    applyDecorators(
        ApiOperation({ summary: options?.summary || 'Get paginated list' }),
        ApiOkResponse({
            schema: {
                allOf: [
                    { $ref: getSchemaPath(ApiPaginatedResponse) },
                    {
                        properties: {
                            data: {
                                type: 'array',
                                items: { $ref: getSchemaPath(dataDto) },
                            },
                        },
                    },
                ],
            },
        })
    );

type ErrorResponseTypes = {
    forbidden?: boolean;
    notFound?: boolean;
    badRequest?: boolean;
    conflict?: boolean;
    unauthorized?: boolean;
};

export const ApiErrorResponses = (
    options: ErrorResponseTypes = {
        forbidden: true,
        notFound: false,
        badRequest: false,
        conflict: false,
        unauthorized: true,
    },
    customResponses: ApiResponseOptions[] = []
) => {
    const defaultResponsesMap: Record<keyof ErrorResponseTypes, ApiResponseOptions> = {
        unauthorized: { status: 401, description: 'Unauthorized', type: ApiErrorResponse },
        badRequest: { status: 400, description: 'Bad Request', type: ApiErrorResponse },
        forbidden: { status: 403, description: 'Forbidden', type: ApiErrorResponse },
        notFound: { status: 404, description: 'Not Found', type: ApiErrorResponse },
        conflict: { status: 409, description: 'Conflict', type: ApiErrorResponse },
    };

    const selectedDefaults = Object.keys(options)
        .filter(key => options[key as keyof ErrorResponseTypes])
        .map(key => defaultResponsesMap[key as keyof ErrorResponseTypes]);

    const allResponses = [...selectedDefaults, ...customResponses];

    return applyDecorators(...allResponses.map(response => ApiResponse(response)));
};

type ApiQueriesOptions = {
    pagination?: boolean;
    search?: boolean;
    sort?: boolean;
    filters?: Record<string, Type<unknown>>;
};

export const ApiQueries = (
    { pagination = true, search = false, sort = false, filters = {} }: ApiQueriesOptions = {},
    customQueries?: ApiQueryOptions[]
) => {
    const queries: any[] = [];

    if (pagination) {
        queries.push(
            ApiQuery({
                name: 'page',
                required: false,
                type: Number,
                description: 'Page number for pagination (default: 1)',
                example: 1,
            }),
            ApiQuery({
                name: 'limit',
                required: false,
                type: Number,
                description: 'Number of items per page (default: 10, max: 100)',
                example: 10,
            })
        );
    }

    if (search) {
        queries.push(
            ApiQuery({
                name: 'search',
                required: false,
                type: String,
                description: 'Search term (at least 2 characters)',
                minLength: 2,
            })
        );
    }

    if (sort) {
        queries.push(
            ApiQuery({
                name: 'sort',
                required: false,
                type: String,
                description: 'Field to sort by',
                example: 'createdAt',
            }),
            ApiQuery({
                name: 'order',
                required: false,
                type: String,
                description: 'Sort order (asc or desc)',
                enum: ['asc', 'desc'],
                example: 'desc',
            })
        );
    }

    // Add filter queries
    if (filters && Object.keys(filters).length) {
        Object.entries(filters).forEach(([field, type]) => {
            queries.push(
                ApiQuery({
                    name: field,
                    required: false,
                    type: type,
                    description: `Filter by ${field}`,
                })
            );
        });
    }

    // Add custom queries
    if (customQueries?.length) {
        queries.push(...customQueries.map(query => ApiQuery(query)));
    }

    return applyDecorators(...queries);
};

export const ApiOkResponseArray = (
    itemType: 'string' | 'number' | 'boolean' | Type<unknown>,
    options?: { summary?: string }
) =>
    applyDecorators(
        ApiOperation({ summary: options?.summary || 'Successful Operation' }),
        ApiOkResponse({
            schema: {
                allOf: [
                    { $ref: getSchemaPath(ApiSuccessResponse) },
                    {
                        properties: {
                            data: {
                                type: 'array',
                                items:
                                    typeof itemType === 'string'
                                        ? { type: itemType }
                                        : { $ref: getSchemaPath(itemType) },
                            },
                        },
                    },
                ],
            },
        })
    );

// Combined decorator for common CRUD operations
export const ApiCrudOperation = <DataDto extends Type<unknown>>(
    dataDto: DataDto,
    operation: 'create' | 'update' | 'delete' | 'get' | 'list',
    options?: {
        summary?: string;
        body?: Type;
        includeQueries?: ApiQueriesOptions;
        errorResponses?: ErrorResponseTypes;
        arrayItemType?: 'string' | 'number' | 'boolean';
    }
) => {
    const decorators: any[] = [];

    // Add operation-specific responses
    switch (operation) {
        case 'create':
            decorators.push(
                ApiOkResponseData(dataDto, {
                    body: options?.body,
                    summary: options?.summary || `Create new ${dataDto.name.toLowerCase()}`,
                }),
                ApiErrorResponses({
                    badRequest: true,
                    unauthorized: true,
                    forbidden: true,
                    conflict: true,
                    ...options?.errorResponses,
                })
            );
            break;
        case 'update':
            decorators.push(
                ApiOkResponseData(dataDto, {
                    body: options?.body,
                    summary: options?.summary || `Update ${dataDto.name.toLowerCase()}`,
                }),
                ApiErrorResponses({
                    badRequest: true,
                    unauthorized: true,
                    forbidden: true,
                    notFound: true,
                    ...options?.errorResponses,
                })
            );
            break;
        case 'delete':
            decorators.push(
                ApiOperation({
                    summary: options?.summary || `Delete ${dataDto.name.toLowerCase()}`,
                }),
                ApiOkResponse({ description: 'Successfully deleted' }),
                ApiErrorResponses({
                    unauthorized: true,
                    forbidden: true,
                    notFound: true,
                    ...options?.errorResponses,
                })
            );
            break;
        case 'get':
            decorators.push(
                ApiOkResponseData(dataDto, {
                    summary: options?.summary || `Get ${dataDto.name.toLowerCase()} by ID`,
                }),
                ApiErrorResponses({
                    unauthorized: true,
                    forbidden: true,
                    notFound: true,
                    ...options?.errorResponses,
                })
            );
            break;
        case 'list':
            if (options?.arrayItemType) {
                decorators.push(
                    ApiOkResponseArray(options.arrayItemType, {
                        summary: options?.summary || `Get list`,
                    })
                );
            } else {
                decorators.push(
                    ...(options?.includeQueries?.pagination
                        ? [
                              ApiOkResponsePaginated(dataDto, {
                                  summary:
                                      options?.summary || `Get ${dataDto.name.toLowerCase()} list`,
                              }),
                          ]
                        : [
                              ApiOkResponseData(dataDto, {
                                  summary:
                                      options?.summary || `Get ${dataDto.name.toLowerCase()} list`,
                              }),
                          ])
                );
            }

            decorators.push(
                ApiQueries(options?.includeQueries || { pagination: true }),
                ApiErrorResponses({
                    unauthorized: true,
                    forbidden: true,
                    ...options?.errorResponses,
                })
            );
            break;
    }

    return applyDecorators(...decorators);
};
