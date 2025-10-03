import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser, DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { OnetimeCodeService } from '../services/onetime-code.service';
import { UserContext } from 'apps/dashboard-api/src/shared/interfaces';
import { CreateOnetimeCodeDto, OnetimeCodeWithRelationsDto, UpdateOnetimeCodeDto, ActivateCodeDto } from '../dto/onetime-code.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';
import { Scope } from 'apps/dashboard-api/src/shared/decorators';

@ApiTags('Onetime Codes')
@Controller('onetime-codes')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.HR, Role.GUARD)
export class OnetimeCodeController {
    constructor(private readonly onetimeCodeService: OnetimeCodeService) {}

    @Get()
    @ApiCrudOperation(OnetimeCodeWithRelationsDto, 'list', {
        summary: 'Get all onetime codes with pagination',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
            filters: {
                visitorId: Number,
                codeType: String,
                isActive: Boolean,
            },
        },
    })
    async findAll(
        @Query() query: QueryDto,
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.onetimeCodeService.findAll(query, scope, user);
    }

    @Get('active')
    @ApiCrudOperation(OnetimeCodeWithRelationsDto, 'list', {
        summary: 'Get active onetime codes',
    })
    async findActiveCodes() {
        return await this.onetimeCodeService.findActiveCodes();
    }

    @Get('expired')
    @ApiCrudOperation(OnetimeCodeWithRelationsDto, 'list', {
        summary: 'Get expired onetime codes',
    })
    async findExpiredCodes() {
        return await this.onetimeCodeService.findExpiredCodes();
    }

    @Get('validate/:code')
    @ApiCrudOperation(null, 'get', {
        summary: 'Validate onetime code',
        errorResponses: { badRequest: true },
    })
    async validateCode(@Param('code') code: string) {
        return await this.onetimeCodeService.validateCode(code);
    }

    @Get('visitor/:visitorId')
    @ApiCrudOperation(OnetimeCodeWithRelationsDto, 'list', {
        summary: 'Get onetime codes by visitor ID',
    })
    async findByVisitorId(@Param('visitorId') visitorId: number) {
        return await this.onetimeCodeService.findByVisitorId(visitorId);
    }

    @Get(':id')
    @ApiCrudOperation(OnetimeCodeWithRelationsDto, 'get', { summary: 'Get onetime code by ID' })
    async findOne(@Param('id') id: number, @CurrentUser() user: UserContext) {
        return await this.onetimeCodeService.findOne(id, user);
    }

    @Post()
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(OnetimeCodeWithRelationsDto, 'create', {
        body: CreateOnetimeCodeDto,
        summary: 'Create new onetime code',
    })
    async create(@Body() createOnetimeCodeDto: CreateOnetimeCodeDto, @Scope() scope: DataScope) {
        return await this.onetimeCodeService.create(createOnetimeCodeDto, scope);
    }

    @Put(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(OnetimeCodeWithRelationsDto, 'update', {
        body: UpdateOnetimeCodeDto,
        summary: 'Update existing onetime code',
        errorResponses: { notFound: true, forbidden: true },
    })
    async update(
        @Param('id') id: number,
        @Body() updateOnetimeCodeDto: UpdateOnetimeCodeDto,
        @CurrentUser() user: UserContext
    ) {
        return await this.onetimeCodeService.update(id, updateOnetimeCodeDto, user);
    }

    @Delete(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(null, 'delete', {
        summary: 'Delete onetime code by ID',
        errorResponses: { notFound: true, forbidden: true },
    })
    async remove(
        @Param('id') id: number,
        @Scope() scope: DataScope,
        @CurrentUser() user: UserContext
    ) {
        await this.onetimeCodeService.remove(id, scope, user);
    }

    @Post(':id/activate')
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(OnetimeCodeWithRelationsDto, 'create', {
        summary: 'Activate onetime code',
        errorResponses: { notFound: true },
    })
    async activate(
        @Param('id') id: number,
        @CurrentUser() user: UserContext
    ) {
        return await this.onetimeCodeService.activate(id, user);
    }

    @Post(':id/deactivate')
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(OnetimeCodeWithRelationsDto, 'create', {
        summary: 'Deactivate onetime code',
        errorResponses: { notFound: true },
    })
    async deactivate(
        @Param('id') id: number,
        @CurrentUser() user: UserContext
    ) {
        return await this.onetimeCodeService.deactivate(id, user);
    }
}