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
import { PolicyService } from './policy.service';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/policy.dto';
import { UserContext } from '../../shared/interfaces';

@ApiTags('Policies')
@Controller('policies')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.HR)
export class PolicyController {
    constructor(private readonly policyService: PolicyService) {}

    @Get()
    @ApiOperation({ summary: 'Get all policies' })
    @ApiResponse({ status: 200, description: 'Policies retrieved successfully' })
    async findAll(
        @Query() paginationDto: PaginationDto,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        const result = await this.policyService.findAll(paginationDto, user);
        return ApiResponseDto.success(result, 'Policies retrieved successfully');
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get policy by ID' })
    @ApiResponse({ status: 200, description: 'Policy retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Policy not found' })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        const policy = await this.policyService.findOne(id, user);
        return ApiResponseDto.success(policy, 'Policy retrieved successfully');
    }

    @Post()
    @ApiOperation({ summary: 'Create new policy' })
    @ApiResponse({ status: 201, description: 'Policy created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    async create(
        @Body() createPolicyDto: CreatePolicyDto,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        const policy = await this.policyService.create(createPolicyDto, user);
        return ApiResponseDto.success(policy, 'Policy created successfully');
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update policy' })
    @ApiResponse({ status: 200, description: 'Policy updated successfully' })
    @ApiResponse({ status: 404, description: 'Policy not found' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updatePolicyDto: UpdatePolicyDto,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        const policy = await this.policyService.update(id, updatePolicyDto, user);
        return ApiResponseDto.success(policy, 'Policy updated successfully');
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete policy' })
    @ApiResponse({ status: 200, description: 'Policy deleted successfully' })
    @ApiResponse({ status: 404, description: 'Policy not found' })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        await this.policyService.remove(id, user);
        return ApiResponseDto.success(null, 'Policy deleted successfully');
    }
}
