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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser, DataScope } from '@app/shared/auth';
import { ApiResponseDto, PaginationDto } from '@app/shared/utils';
import { VisitorService } from './visitor.service';
import { CreateVisitorDto, UpdateVisitorDto, GenerateCodeDto } from './dto/visitor.dto';
import { ApiCrudOperation } from '../../shared/utils';
import { UserContext } from '../../shared/interfaces';
import { Action, OnetimeCode } from '@prisma/client';
import { Scope } from '../../shared/decorators';

@ApiTags('Visitors')
@ApiBearerAuth()
@Controller('visitors')
export class VisitorController {
    constructor(private readonly visitorService: VisitorService) {}

    @Get()
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiCrudOperation(ApiResponseDto, 'list', {
        summary: 'Get all visitors with pagination',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
            filters: { isActive: Boolean },
        },
    })
    async findAll(
        @Query() paginationDto: PaginationDto,
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.visitorService.findAll(paginationDto, scope, user);
    }

    @Get(':id')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiCrudOperation(ApiResponseDto, 'get', {
        summary: 'Get visitor by ID',
        errorResponses: { notFound: true },
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        const visitor = await this.visitorService.findOne(id, user);
        return ApiResponseDto.success(visitor, 'Visitor retrieved successfully');
    }

    @Post()
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(ApiResponseDto, 'create', {
        body: CreateVisitorDto,
        summary: 'Create a new visitor',
        errorResponses: { badRequest: true, conflict: true },
    })
    async create(
        @Body() createVisitorDto: CreateVisitorDto,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        console.log('Current User:', user);
        const visitor = await this.visitorService.create(createVisitorDto, user);
        return ApiResponseDto.success(visitor, 'Visitor created successfully');
    }

    @Put(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(ApiResponseDto, 'update', {
        body: UpdateVisitorDto,
        summary: 'Update visitor details',
        errorResponses: { badRequest: true, notFound: true, conflict: true },
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateVisitorDto: UpdateVisitorDto,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        const visitor = await this.visitorService.update(id, updateVisitorDto, user);
        return ApiResponseDto.success(visitor, 'Visitor updated successfully');
    }

    @Delete(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(ApiResponseDto, 'delete', {
        summary: 'Delete a visitor',
        errorResponses: { notFound: true },
    })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        await this.visitorService.remove(id, user);
        return ApiResponseDto.success(null, 'Visitor deleted successfully');
    }

    @Post(':id/generate-code')
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(ApiResponseDto, 'create', {
        body: GenerateCodeDto,
        summary: 'Generate a visitor code',
        errorResponses: { badRequest: true, notFound: true },
    })
    async generateCode(
        @Param('id', ParseIntPipe) id: number,
        @Body() generateCodeDto: GenerateCodeDto,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        const code = await this.visitorService.generateCode(id, generateCodeDto, user);
        return ApiResponseDto.success(code, 'Code generated successfully');
    }

    @Get(':id/entry-logs')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiCrudOperation(ApiResponseDto<Action>, 'list', {
        summary: 'Get entry logs for a visitor with pagination',
        includeQueries: {
            pagination: true,
            sort: true,
        },
        errorResponses: { notFound: true },
    })
    async getEntryLogs(
        @Param('id', ParseIntPipe) id: number,
        @Query() paginationDto: PaginationDto,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        const result = await this.visitorService.getEntryLogs(id, paginationDto, user);
        return ApiResponseDto.success(result, 'Entry logs retrieved successfully');
    }

    @Get('validate-code/:code')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiCrudOperation(ApiResponseDto<OnetimeCode>, 'get', {
        summary: 'Validate a visitor code',
        errorResponses: { notFound: true, badRequest: true },
    })
    async validateCode(@Param('code') code: string): Promise<ApiResponseDto> {
        const result = await this.visitorService.validateCode(code);
        return ApiResponseDto.success(result, 'Code validated successfully');
    }

    @Put('codes/:codeId/deactivate')
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(ApiResponseDto<OnetimeCode>, 'update', {
        summary: 'Deactivate a visitor code',
        errorResponses: { notFound: true, badRequest: true },
    })
    async deactivateCode(
        @Param('codeId', ParseIntPipe) codeId: number,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        const result = await this.visitorService.deactivateCode(codeId, user);
        return ApiResponseDto.success(result, 'Code deactivated successfully');
    }
}
