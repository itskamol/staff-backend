import {
    Body,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Param,
    Put,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiExtraModels,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
    getSchemaPath,
} from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
    CreateOrganizationDto,
    OrganizationResponseDto,
    UpdateOrganizationDto,
} from '@/shared/dto';
import { NoScoping, Roles, Scope } from '@/shared/decorators';
import { Prisma, Role } from '@prisma/client';
import { ApiOkResponseData, ApiOkResponsePaginated, ApiCrudOperation, ApiErrorResponses, ApiQueries } from '@/shared/utils';
import { DataScope } from '@/shared/interfaces';
import { QueryDto } from '@/shared/dto/query.dto';

@ApiTags('Organization')
@ApiBearerAuth()
@Controller('organization')
@ApiExtraModels(ApiSuccessResponse, OrganizationResponseDto)
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) {}

    @Roles(Role.ADMIN)
    @Post()
    @NoScoping()
    @ApiCrudOperation(OrganizationResponseDto, 'create', {
        body: CreateOrganizationDto,
        summary: 'Create a new organization'
    })
    async createOrganization(@Body() dto: CreateOrganizationDto) {
        return this.organizationService.createOrganization(dto);
    }

    @Get()
    @Roles(Role.ADMIN)
    @NoScoping()
    @ApiCrudOperation(OrganizationResponseDto, 'list', {
        summary: 'Get all organizations with pagination',
        includeQueries: { 
            pagination: true, 
            search: true, 
            sort: true, 
            filters: ['isActive'] 
        }
    })
    async getAllOrganizations(
        @Query() query: QueryDto,
    ) {
        return this.organizationService.getOrganizations(query);
    }

    @Get(':id')
    @Roles(Role.ADMIN)
    @NoScoping()
    @ApiCrudOperation(OrganizationResponseDto, 'get', {
        summary: 'Get an organization by ID'
    })
    async getOrganizationById(@Param('id') id: number) {
        const organization = await this.organizationService.getOrganizationById(id);
        if (!organization) {
            throw new NotFoundException('Organization not found.');
        }
        return organization;
    }

    @Get('self')
    @ApiOperation({ summary: 'Get the current authenticated user’s organization' })
    @ApiOkResponseData(OrganizationResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Organization not found.', type: ApiErrorResponse })
    async getCurrentOrganization(@Scope() scope: DataScope) {
        const organization = await this.organizationService.getOrganizationById(
            scope.organizationId
        );
        if (!organization) {
            throw new NotFoundException('Organization not found.');
        }
        return organization;
    }

    @Put(':id')
    @Roles(Role.ADMIN)
    @NoScoping()
    @ApiOperation({ summary: 'Update an organization by ID' })
    @ApiBody({ type: UpdateOrganizationDto })
    @ApiResponse({
        status: 200,
        description: 'The organization has been successfully updated.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(OrganizationResponseDto) },
                    },
                },
            ],
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Organization not found.', type: ApiErrorResponse })
    async updateOrganization(
        @Param('id') id: number,
        @Body() dto: UpdateOrganizationDto,
        @Scope() scope: DataScope
    ) {
        return this.organizationService.updateOrganization(id, dto, scope);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    @NoScoping()
    @ApiOperation({ summary: 'Delete an organization by ID' })
    @ApiResponse({
        status: 200,
        description: 'The organization has been successfully deleted.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'Organization deleted successfully.',
                                },
                            },
                        },
                    },
                },
            ],
        },
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Organization not found.', type: ApiErrorResponse })
    async deleteOrganization(@Param('id') id: number) {
        await this.organizationService.deleteOrganization(id);
        return { message: 'Organization deleted successfully.' };
    }
}
