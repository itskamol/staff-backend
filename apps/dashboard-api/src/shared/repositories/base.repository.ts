import { PrismaClient } from '@prisma/client';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataScope } from '../interfaces';
import { PaginationDto, PaginationResponseDto } from '../dto';

/**
 * Generic base repository providing common CRUD operations
 * Follows best practices for database operations with Prisma
 */
@Injectable()
export abstract class BaseRepository<
    TEntity extends { id: number; createdAt?: Date; isActive?: boolean },
    TCreateInput extends Record<string, unknown>,
    TUpdateInput extends Record<string, unknown>,
    TWhereInput extends Record<string, unknown> = Record<string, unknown>,
    TWhereUniqueInput extends Record<string, unknown> = { id: number },
    TOrderByInput extends Record<string, unknown> = Record<string, unknown>,
    TInclude extends Record<string, unknown> = Record<string, unknown>,
    TSelect extends Record<string, unknown> = Record<string, unknown>
> {
    protected readonly logger = new Logger(this.constructor.name);
    protected abstract readonly modelName: string;

    constructor(protected readonly prisma: PrismaClient) {}

    /**
     * Get the Prisma delegate for the model
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected abstract getDelegate(): any;

    /**
     * Apply data scope filters to where conditions
     */
    protected applyDataScope(
        where: Record<string, unknown>,
        scope?: DataScope
    ): Record<string, unknown> {
        if (!scope) return where;

        const scopedWhere = { ...where };

        if (scope?.organizationId) {
            scopedWhere.organizationId = scope.organizationId;
        }

        if (scope?.departments?.length) {
            scopedWhere.departments = scope?.departments;
        }

        return scopedWhere;
    }

    /**
     * Apply data scope to create input (override in child classes if needed)
     */
    protected applyDataScopeToCreate(data: TCreateInput, scope: DataScope): TCreateInput {
        const scopedData = { ...data };

        if (scope?.organizationId && 'organizationId' in scopedData) {
            (scopedData as Record<string, unknown>).organizationId = scope.organizationId;
        }

        if (scope?.departments?.length && 'departments' in scopedData) {
            (scopedData as Record<string, unknown>).departments = scope.departments;
        }

        return scopedData;
    }

    /**
     * Create a new record
     */
    async create(data: TCreateInput, include?: TInclude, scope?: DataScope): Promise<TEntity> {
        this.logger.debug(`Creating ${this.modelName} with data:`, data);

        const createData = scope ? this.applyDataScopeToCreate(data, scope) : data;

        const result = await this.getDelegate().create({
            data: createData,
            include,
        });

        this.logger.debug(`Created ${this.modelName} with ID: ${result.id}`);
        return result;
    }

    /**
     * Find a record by unique identifier
     */
    async findById(
        id: number,
        include?: TInclude,
        scope?: DataScope,
        select?: TSelect
    ): Promise<TEntity | null> {
        this.logger.debug(`Finding ${this.modelName} by ID: ${id}`);

        const where: Record<string, unknown> = { id };
        const scopedWhere = this.applyDataScope(where, scope);

        const result = await this.getDelegate().findFirst({
            where: scopedWhere,
            select,
            include,
        });

        if (!result) {
            this.logger.debug(`${this.modelName} with ID ${id} not found`);
        }

        return result;
    }

    /**
     * Find a record by unique identifier or throw NotFoundException
     */
    async findByIdOrThrow(
        id: number,
        include?: TInclude,
        scope?: DataScope
    ): Promise<TEntity> {
        if (!id) {
            throw new BadRequestException('ID is required');
        }

        const result = await this.findById(id, include, scope);

        if (!result) {
            throw new NotFoundException(`${this.modelName} with ID ${id} not found`);
        }

        return result;
    }

    /**
     * Find a single record by conditions
     */
    async findUnique(
        where: TWhereUniqueInput,
        include?: TInclude,
        scope?: DataScope
    ): Promise<TEntity | null> {
        this.logger.debug(`Finding unique ${this.modelName} with conditions:`, where);

        const scopedWhere = this.applyDataScope(where, scope);

        return await this.getDelegate().findUnique({
            where: scopedWhere,
            include,
        });
    }

    /**
     * Find first record matching conditions
     */
    async findFirst(
        where?: TWhereInput,
        orderBy?: TOrderByInput,
        include?: TInclude,
        scope?: DataScope
    ): Promise<TEntity | null> {
        this.logger.debug(`Finding first ${this.modelName} with conditions:`, where);

        const scopedWhere = this.applyDataScope(where || {}, scope);

        return await this.getDelegate().findFirst({
            where: scopedWhere,
            orderBy,
            include,
        });
    }

    /**
     * Find many records with optional filtering, sorting, and pagination
     */
    async findMany(
        where?: TWhereInput,
        orderBy?: TOrderByInput,
        include?: TInclude,
        pagination?: PaginationDto,
        select?: TSelect,
        scope?: DataScope
    ): Promise<TEntity[]> {
        this.logger.debug(`Finding many ${this.modelName} with conditions:`, where);

        const scopedWhere = this.applyDataScope(where || {}, scope);

        const options: {
            where: Record<string, unknown>;
            orderBy?: TOrderByInput;
            include?: TInclude;
            skip?: number;
            take?: number;
        } = {
            where: scopedWhere,
            orderBy: orderBy || ({ createdAt: 'desc' } as unknown as TOrderByInput),
            include,
        };

        if (pagination) {
            const skip = (pagination.page - 1) * pagination.limit;
            options.skip = skip;
            options.take = pagination.limit;
        }

        const results = await this.getDelegate().findMany(options);

        this.logger.debug(`Found ${results.length} ${this.modelName} records`);
        return results;
    }

    /**
     * Find many records with pagination response
     */
    async findManyWithPagination(
        where?: TWhereInput,
        orderBy?: TOrderByInput,
        include?: TInclude,
        pagination: PaginationDto = { page: 1, limit: 10 },
        scope?: DataScope,
        select?: TSelect
    ): Promise<PaginationResponseDto<TEntity>> {
        this.logger.debug(`Finding paginated ${this.modelName} with conditions:`, where);

        const [data, total] = await Promise.all([
            this.findMany(where, orderBy, include, pagination, select, scope),
            this.count(where, scope),
        ]);

        return new PaginationResponseDto(data, total, pagination.page, pagination.limit);
    }

    /**
     * Update a record by ID
     */
    async update(
        id: number,
        data: TUpdateInput,
        include?: TInclude,
        scope?: DataScope
    ): Promise<TEntity> {
        this.logger.debug(`Updating ${this.modelName} with ID ${id}:`, data);

        // First verify the record exists and is accessible with scope
        await this.findByIdOrThrow(id, undefined, scope);

        const result = await this.getDelegate().update({
            where: { id },
            data,
            include,
        });

        this.logger.debug(`Updated ${this.modelName} with ID: ${id}`);
        return result;
    }

    /**
     * Update many records
     */
    async updateMany(
        where: TWhereInput,
        data: TUpdateInput,
        scope?: DataScope
    ): Promise<{ count: number }> {
        this.logger.debug(`Updating many ${this.modelName} with conditions:`, where);

        const scopedWhere = this.applyDataScope(where, scope);

        const result = await this.getDelegate().updateMany({
            where: scopedWhere,
            data,
        });

        this.logger.debug(`Updated ${result.count} ${this.modelName} records`);
        return result;
    }

    /**
     * Delete a record by ID
     */
    async delete(id: number, scope?: DataScope): Promise<TEntity> {
        this.logger.debug(`Deleting ${this.modelName} with ID: ${id}`);

        // First verify the record exists and is accessible with scope
        await this.findByIdOrThrow(id, undefined, scope);

        const result = await this.getDelegate().delete({
            where: { id },
        });

        this.logger.debug(`Deleted ${this.modelName} with ID: ${id}`);
        return result;
    }

    /**
     * Soft delete a record (if the model supports isActive field)
     */
    async softDelete(id: number, scope?: DataScope): Promise<TEntity> {
        this.logger.debug(`Soft deleting ${this.modelName} with ID: ${id}`);

        const result = await this.update(
            id,
            { isActive: false } as unknown as TUpdateInput,
            undefined,
            scope
        );

        this.logger.debug(`Soft deleted ${this.modelName} with ID: ${id}`);
        return result;
    }

    /**
     * Delete many records
     */
    async deleteMany(where: TWhereInput, scope?: DataScope): Promise<{ count: number }> {
        this.logger.debug(`Deleting many ${this.modelName} with conditions:`, where);

        const scopedWhere = this.applyDataScope(where, scope);

        const result = await this.getDelegate().deleteMany({
            where: scopedWhere,
        });

        this.logger.debug(`Deleted ${result.count} ${this.modelName} records`);
        return result;
    }

    /**
     * Count records matching conditions
     */
    async count(where?: TWhereInput, scope?: DataScope): Promise<number> {
        this.logger.debug(`Counting ${this.modelName} with conditions:`, where);

        const scopedWhere = this.applyDataScope(where || {}, scope);

        const count = await this.getDelegate().count({
            where: scopedWhere,
        });

        this.logger.debug(`Found ${count} ${this.modelName} records matching conditions`);
        return count;
    }

    /**
     * Check if a record exists
     */
    async exists(where: TWhereInput, scope?: DataScope): Promise<boolean> {
        const count = await this.count(where, scope);
        return count > 0;
    }

    /**
     * Upsert a record (create or update)
     */
    async upsert(
        where: TWhereUniqueInput,
        create: TCreateInput,
        update: TUpdateInput,
        include?: TInclude,
        scope?: DataScope
    ): Promise<TEntity> {
        this.logger.debug(`Upserting ${this.modelName} with conditions:`, where);

        const scopedWhere = this.applyDataScope(where, scope);
        const createData = scope ? this.applyDataScopeToCreate(create, scope) : create;

        const result = await this.getDelegate().upsert({
            where: scopedWhere,
            create: createData,
            update,
            include,
        });

        this.logger.debug(`Upserted ${this.modelName} with ID: ${result.id}`);
        return result;
    }

    /**
     * Execute a transaction
     */
    async transaction<R>(fn: (prisma: PrismaClient) => Promise<R>): Promise<R> {
        this.logger.debug(`Executing transaction`);
        return await this.prisma.$transaction(fn);
    }

    /**
     * Get active records only (if the model supports isActive field)
     */
    async findManyActive(
        where?: TWhereInput,
        orderBy?: TOrderByInput,
        include?: TInclude,
        pagination?: PaginationDto,
        scope?: DataScope,
        select?: TSelect
    ): Promise<TEntity[]> {
        const activeWhere = { ...where, isActive: true } as TWhereInput;
        return this.findMany(activeWhere, orderBy, include, pagination, select, scope);
    }

    /**
     * Find many active records with pagination
     */
    async findManyActiveWithPagination(
        where?: TWhereInput,
        orderBy?: TOrderByInput,
        include?: TInclude,
        pagination: PaginationDto = { page: 1, limit: 10 },
        scope?: DataScope
    ): Promise<PaginationResponseDto<TEntity>> {
        const activeWhere = { ...where, isActive: true } as TWhereInput;
        return this.findManyWithPagination(activeWhere, orderBy, include, pagination, scope);
    }
}
