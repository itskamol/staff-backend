import { Type } from '@nestjs/common';
import { ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiPaginatedResponse, ApiSuccessResponse } from '../dto/api-response.dto';

export const ApiOkResponseData = <DataDto extends Type<unknown>>(dataDto: DataDto) =>
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
    });

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
