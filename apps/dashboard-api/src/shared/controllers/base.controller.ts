import { Body, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Type } from '@nestjs/common';
import { PaginationDto, PaginationResponseDto } from '../dto';
import { BaseCrudService } from '../services/base.service';
import { ApiCrudOperation, ApiErrorResponses, ApiQueries } from '../utils';
import { QueryDto } from '@app/shared/utils';

/**
 * Generic base controller providing common CRUD endpoints
 * All child controllers should extend this class
 *
 * @example
 * @ApiTags('users')
 * @Controller('users')
 * export class UserController extends BaseCrudController<
 *   User,
 *   CreateUserDto,
 *   UpdateUserDto,
 *   typeof UserResponseDto,
 *   UserService
 * > {
 *   protected readonly entityName = 'User';
 *   protected readonly responseDto = UserResponseDto;
 *
 *   constructor(service: UserService) {
 *     super(service);
 *   }
 * }
 */
export abstract class BaseCrudController<
    TEntity extends { id: number | number; createdAt?: Date; isActive?: boolean },
    TCreateDto,
    TUpdateDto,
    TResponseDto extends Type<unknown>,
    TService extends BaseCrudService<TEntity, TCreateDto, TUpdateDto, any>
> {
    protected abstract readonly entityName: string;
    protected abstract readonly responseDto: TResponseDto;

    constructor(protected readonly service: TService) {}

    /**
     * Get query filters from request (override in child classes)
     * @example
     * protected getQueryFilters(query: any): any {
     *   const filters = super.getQueryFilters(query);
     *   if (query.search) {
     *     filters.OR = [
     *       { name: { contains: query.search } },
     *       { email: { contains: query.search } }
     *     ];
     *   }
     *   return filters;
     * }
     */
    protected getQueryFilters(query: QueryDto): any {
        const { page, limit, sort, order, search, ...filters } = query;
        return filters;
    }

    /**
     * Get order by clause from request (override in child classes)
     */
    protected getOrderBy(query: any): any {
        const { sort, order } = query;
        if (sort) {
            return { [sort]: order || 'desc' };
        }
        return { createdAt: 'desc' };
    }

    /**
     * Get pagination parameters from request
     */
    protected getPagination(query: QueryDto): PaginationDto {
        return {
            page: query.page,
            limit: query.limit,
        };
    }

    /**
     * Transform entity to response DTO (override in child classes if needed)
     */
    protected toResponseDto(entity: TEntity): any {
        return entity;
    }

    /**
     * Get include relations (override in child classes if needed)
     */
    protected getInclude(): any {
        return undefined;
    }

    /**
     * CREATE - Create new entity
     * POST /resource
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiCrudOperation('create' as any, 'create')
    async create(@Body() createDto: TCreateDto): Promise<TEntity> {
        const include = this.getInclude();
        const entity = await this.service.create(createDto, include);
        return this.toResponseDto(entity);
    }

    /**
     * READ - Get all entities with pagination
     * GET /resource?page=1&limit=10&sort=createdAt&order=desc
     */
    @Get()
    @ApiCrudOperation('list' as any, 'list', {
        summary: 'Get all entities',
        includeQueries: { pagination: true, search: false, sort: true },
    })
    async findAll(@Query() query: QueryDto): Promise<PaginationResponseDto<any>> {
        const filters = this.getQueryFilters(query);
        const orderBy = this.getOrderBy(query);
        const pagination = this.getPagination(query);
        const include = this.getInclude();

        const result = await this.service.findAllWithPagination(
            filters,
            orderBy,
            include,
            pagination
        );

        return {
            ...result,
            data: result.data.map(entity => this.toResponseDto(entity)),
        };
    }

    /**
     * READ - Get entity by ID
     * GET /resource/:id
     */
    @Get(':id')
    @ApiCrudOperation('get' as any, 'get', {
        summary: 'Get entity by ID',
    })
    async findOne(@Param('id') id: number): Promise<TEntity> {
        const include = this.getInclude();
        const entity = await this.service.findByIdOrThrow(id, include);
        return this.toResponseDto(entity);
    }

    /**
     * UPDATE - Update entity by ID
     * PUT /resource/:id
     */
    @Put(':id')
    @ApiCrudOperation('update' as any, 'update', {
        summary: 'Update entity',
    })
    async update(@Param('id') id: number, @Body() updateDto: TUpdateDto): Promise<TEntity> {
        const include = this.getInclude();
        const entity = await this.service.update(id, updateDto, include);
        return this.toResponseDto(entity);
    }

    /**
     * DELETE - Delete entity by ID (hard delete)
     * DELETE /resource/:id
     */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiCrudOperation('delete' as any, 'delete', {
        summary: 'Delete entity',
    })
    async remove(@Param('id') id: number): Promise<void> {
        await this.service.delete(id);
    }

    /**
     * SOFT DELETE - Soft delete entity by ID
     * PUT /resource/:id/soft-delete
     */
    @Put(':id/soft-delete')
    @ApiCrudOperation('update' as any, 'update', {
        summary: 'Soft delete entity',
    })
    async softDelete(@Param('id') id: number): Promise<TEntity> {
        const entity = await this.service.softDelete(id);
        return this.toResponseDto(entity);
    }

    /**
     * READ - Get active entities only
     * GET /resource/active/list?page=1&limit=10
     */
    @Get('active/list')
    @ApiCrudOperation('list' as any, 'list', {
        summary: 'Get active entities',
        includeQueries: { pagination: true, sort: true },
    })
    async findAllActive(@Query() query: any): Promise<PaginationResponseDto<any>> {
        const filters = this.getQueryFilters(query);
        const orderBy = this.getOrderBy(query);
        const pagination = this.getPagination(query);
        const include = this.getInclude();

        const result = await this.service.findAllActiveWithPagination(
            filters,
            orderBy,
            include,
            pagination
        );

        return {
            ...result,
            data: result.data.map(entity => this.toResponseDto(entity)),
        };
    }

    /**
     * COUNT - Count entities matching filters
     * GET /resource/count/total?status=active
     */
    @Get('count/total')
    @ApiQueries({ pagination: false })
    @ApiErrorResponses()
    async count(@Query() query: any): Promise<{ count: number }> {
        const filters = this.getQueryFilters(query);
        const count = await this.service.count(filters);
        return { count };
    }

    /**
     * CHECK - Check if entity exists
     * GET /resource/exists?email=test@example.com
     */
    @Get('exists/check')
    @ApiQueries({ pagination: false })
    @ApiErrorResponses()
    async exists(@Query() query: any): Promise<{ exists: boolean }> {
        const filters = this.getQueryFilters(query);
        const exists = await this.service.exists(filters);
        return { exists };
    }
}
