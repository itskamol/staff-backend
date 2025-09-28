import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser } from '@app/shared/auth';
import { ApiResponseDto, PaginationDto } from '@app/shared/utils';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) {}

    @Get()
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Get all organizations' })
    @ApiResponse({ status: 200, description: 'Organizations retrieved successfully' })
    async findAll(
        @Query() paginationDto: PaginationDto,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const result = await this.organizationService.findAll(paginationDto, user);
        return ApiResponseDto.success(result, 'Organizations retrieved successfully');
    }

    @Get(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Get organization by ID' })
    @ApiResponse({ status: 200, description: 'Organization retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Organization not found' })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const organization = await this.organizationService.findOne(id, user);
        return ApiResponseDto.success(organization, 'Organization retrieved successfully');
    }

    @Post()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Create new organization' })
    @ApiResponse({ status: 201, description: 'Organization created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    async create(@Body() createOrganizationDto: CreateOrganizationDto): Promise<ApiResponseDto> {
        const organization = await this.organizationService.create(createOrganizationDto);
        return ApiResponseDto.success(organization, 'Organization created successfully');
    }

    @Put(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update organization' })
    @ApiResponse({ status: 200, description: 'Organization updated successfully' })
    @ApiResponse({ status: 404, description: 'Organization not found' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateOrganizationDto: UpdateOrganizationDto
    ): Promise<ApiResponseDto> {
        const organization = await this.organizationService.update(id, updateOrganizationDto);
        return ApiResponseDto.success(organization, 'Organization updated successfully');
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Delete organization' })
    @ApiResponse({ status: 200, description: 'Organization deleted successfully' })
    @ApiResponse({ status: 404, description: 'Organization not found' })
    async remove(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto> {
        await this.organizationService.remove(id);
        return ApiResponseDto.success(null, 'Organization deleted successfully');
    }

    @Get(':id/departments')
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Get organization departments' })
    @ApiResponse({ status: 200, description: 'Departments retrieved successfully' })
    async getDepartments(
        @Param('id', ParseIntPipe) id: number,
        @Query() paginationDto: PaginationDto,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const result = await this.organizationService.getDepartments(id, paginationDto, user);
        return ApiResponseDto.success(result, 'Departments retrieved successfully');
    }
}
