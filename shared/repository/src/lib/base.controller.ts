import { Body, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Type } from '@nestjs/common';
import { PaginationDto, PaginationResponseDto, QueryDto } from '@app/shared/utils';
import { BaseCrudService } from './base.service';

/**
 * Generic base controller providing common CRUD endpoints
 * All child controllers should extend this class
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
            data: result.data.map((entity: TEntity) => this.toResponseDto(entity)),
        };
    }

    /**
     * READ - Get entity by ID
     * GET /resource/:id
     */
    @Get(':id')
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
    async remove(@Param('id') id: number): Promise<void> {
        await this.service.delete(id);
    }

    /**
     * COUNT - Count entities matching filters
     * GET /resource/count/total?status=active
     */
    @Get('count/total')
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
    async exists(@Query() query: any): Promise<{ exists: boolean }> {
        const filters = this.getQueryFilters(query);
        const exists = await this.service.exists(filters);
        return { exists };
    }
}