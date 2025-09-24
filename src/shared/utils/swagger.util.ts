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

export const ApiOkResponseData = <DataDto extends Type<unknown>>(dataDto: DataDto, body?: Type) =>
    applyDecorators(
        ...(body ? [ApiBody({ type: body })] : []),
        ApiOperation({ summary: 'Successful Operation' }),
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

export const ApiOkResponsePaginated = <DataDto extends Type<unknown>>(dataDto: DataDto) =>
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
    });

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
};

export const ApiQueries = (
    { pagination = true, search = false, sort = false }: ApiQueriesOptions,
    options?: ApiQueryOptions[]
) => {
    return applyDecorators(
        ...(pagination
            ? [
                  ApiQuery({
                      name: 'page',
                      required: false,
                      type: Number,
                      description: 'Page number for pagination (default: 1)',
                  }),
                  ApiQuery({
                      name: 'limit',
                      required: false,
                      type: Number,
                      description: 'Number of items per page (default: 10)',
                  }),
              ]
            : []),
        ...(search
            ? [
                  ApiQuery({
                      name: 'search',
                      required: false,
                      type: String,
                      description: 'Search term (at least 2 characters)',
                      minLength: 2,
                  }),
              ]
            : []),
        ...(sort
            ? [
                  ApiQuery({
                      name: 'sort',
                      required: false,
                      type: String,
                      description: 'Field to sort by',
                  }),
                  ApiQuery({
                      name: 'order',
                      required: false,
                      type: String,
                      description: 'Sort order (asc or desc)',
                      enum: ['asc', 'desc'],
                  }),
              ]
            : [])
    );
};
