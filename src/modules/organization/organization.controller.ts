import { Body, Controller, Get, NotFoundException, Post, Query } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
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
    PaginationDto,
} from '@/shared/dto';
import { NoScoping, Roles, Scope } from '@/shared/decorators';
import { Role } from '@prisma/client';
import { ApiOkResponseData, ApiOkResponsePaginated } from '@/shared/utils';
import { DataScope } from '@/shared/interfaces';

@ApiTags('Organization')
@ApiBearerAuth()
@Controller('organization')
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) {}

    @Roles(Role.ADMIN)
    @Post()
    @NoScoping()
    @ApiOperation({ summary: 'Create a new organization' })
    @ApiBody({ type: CreateOrganizationDto })
    @ApiResponse({
        status: 201,
        description: 'The organization has been successfully created.',
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
    async createOrganization(@Body() dto: CreateOrganizationDto) {
        return this.organizationService.createOrganization(dto);
    }

    @Get()
    @NoScoping()
    @ApiOperation({ summary: 'Get all organizations with pagination' })
    @ApiOkResponsePaginated(OrganizationResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getAllOrganizations(@Query() paginationDto: PaginationDto) {
        return this.organizationService.getOrganizations({}, paginationDto);
    }

    @Get('search')
    @NoScoping()
    @ApiOperation({ summary: 'Search for organizations' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiOkResponsePaginated(OrganizationResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async searchOrganizations(
        @Query('q') searchTerm: string,
        @Query() paginationDto: PaginationDto
    ) {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }
        return this.organizationService.searchOrganizations(searchTerm.trim(), paginationDto);
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
}
