import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser, DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { ComputerUserService } from '../services/computer-user.service';
import { UserContext } from 'apps/dashboard-api/src/shared/interfaces';
import { CreateComputerUserDto, ComputerUserDto, UpdateComputerUserDto, LinkEmployeeDto } from '../dto/computer-user.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';
import { Scope } from 'apps/dashboard-api/src/shared/decorators';

@ApiTags('Computer Users')
@Controller('computer-users')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.HR)
export class ComputerUserController {
    constructor(private readonly computerUserService: ComputerUserService) {}

    @Get()
    @ApiCrudOperation(ComputerUserDto, 'list', {
        summary: 'Get all computer users with pagination',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
            filters: {
                linked: String,
                computer_id: Number,
                is_active: Boolean,
            },
        },
    })
    async findAll(
        @Query() query: QueryDto,
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.computerUserService.findAll(query, scope, user);
    }

    @Get('unlinked')
    @ApiCrudOperation(ComputerUserDto, 'list', {
        summary: 'Get unlinked computer users',
    })
    async findUnlinked(@Scope() scope: DataScope) {
        return await this.computerUserService.findUnlinked(scope);
    }

    @Get(':id')
    @ApiCrudOperation(ComputerUserDto, 'get', { summary: 'Get computer user by ID' })
    async findOne(@Param('id') id: number, @CurrentUser() user: UserContext) {
        return await this.computerUserService.findOne(id, user);
    }

    @Put(':id')
    @ApiCrudOperation(ComputerUserDto, 'update', {
        body: UpdateComputerUserDto,
        summary: 'Update existing computer user',
        errorResponses: { notFound: true, forbidden: true },
    })
    async update(
        @Param('id') id: number,
        @Body() updateComputerUserDto: UpdateComputerUserDto,
        @CurrentUser() user: UserContext
    ) {
        return await this.computerUserService.update(id, updateComputerUserDto, user);
    }

    @Delete(':id')
    @ApiCrudOperation(null, 'delete', {
        summary: 'Delete computer user by ID',
        errorResponses: { notFound: true, forbidden: true },
    })
    async remove(
        @Param('id') id: number,
        @Scope() scope: DataScope,
        @CurrentUser() user: UserContext
    ) {
        await this.computerUserService.remove(id, scope, user);
    }

    @Post(':id/link-employee')
    @ApiCrudOperation(ComputerUserDto, 'create', {
        body: LinkEmployeeDto,
        summary: 'Link computer user to employee',
        errorResponses: { notFound: true, badRequest: true },
    })
    async linkEmployee(
        @Param('id') id: number,
        @Body() linkEmployeeDto: LinkEmployeeDto,
        @CurrentUser() user: UserContext
    ) {
        return await this.computerUserService.linkEmployee(id, linkEmployeeDto.employee_id, user);
    }

    @Delete(':id/unlink-employee')
    @ApiCrudOperation(ComputerUserDto, 'delete', {
        summary: 'Unlink computer user from employee',
        errorResponses: { notFound: true, badRequest: true },
    })
    async unlinkEmployee(
        @Param('id') id: number,
        @CurrentUser() user: UserContext
    ) {
        return await this.computerUserService.unlinkEmployee(id, user);
    }
}