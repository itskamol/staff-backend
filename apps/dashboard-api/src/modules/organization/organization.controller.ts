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
import { ApiBearerAuth, ApiExtraModels, ApiTags } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import {
    ApiSuccessResponse,
    CreateOrganizationDto,
    OrganizationResponseDto,
    UpdateOrganizationDto,
} from '../../shared/dto';
import { DataScope, NoScoping, Role, Roles } from '@app/shared/auth';
import { ApiCrudOperation } from '../../shared/utils';
import { Scope } from '../../shared/decorators';
import { QueryDto } from '@app/shared/utils';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
@ApiExtraModels(ApiSuccessResponse, OrganizationResponseDto)
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) {}

    @Roles(Role.ADMIN)
    @Post()
    @NoScoping()
    @ApiCrudOperation(OrganizationResponseDto, 'create', {
        body: CreateOrganizationDto,
        summary: 'Create a new organization',
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
            filters: { isActive: Boolean },
        },
    })
    async getAllOrganizations(@Query() query: QueryDto) {
        return this.organizationService.getOrganizations(query);
    }

    @Get('self')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiCrudOperation(OrganizationResponseDto, 'get', {
        summary: "Get the current authenticated user's organization",
    })
    async getCurrentOrganization(@Scope() scope: DataScope) {
        return this.organizationService.getOrganizationsByScope(scope);
    }

    @Get(':id')
    @Roles(Role.ADMIN)
    @NoScoping()
    @ApiCrudOperation(OrganizationResponseDto, 'get', {
        summary: 'Get an organization by ID',
    })
    async getOrganizationById(@Param('id') id: number) {
        const organization = await this.organizationService.getOrganizationById(id);
        if (!organization) {
            throw new NotFoundException('Organization not found.');
        }
        return organization;
    }

    @Put(':id')
    @Roles(Role.ADMIN)
    @NoScoping()
    @ApiCrudOperation(OrganizationResponseDto, 'update', {
        body: UpdateOrganizationDto,
        summary: 'Update an organization by ID',
    })
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
    @ApiCrudOperation(OrganizationResponseDto, 'delete', {
        summary: 'Delete an organization by ID',
    })
    async deleteOrganization(@Param('id') id: number) {
        await this.organizationService.deleteOrganization(id);
        return { message: 'Organization deleted successfully.' };
    }
}
