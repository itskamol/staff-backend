import { Injectable, Logger } from '@nestjs/common';
import { PaginationDto, PaginationResponseDto } from '@app/shared/utils';
import { DataScope } from '@app/shared/auth';
import { BaseRepository } from './base.repository';

/**
 * Generic base service providing common CRUD business logic
 * Extends repository functionality with service-level operations
 */
@Injectable()
export abstract class BaseCrudService<
    TEntity extends { id: number; createdAt?: Date; isActive?: boolean },
    TCreateDto,
    TUpdateDto,
    TRepository extends BaseRepository<any, any, any, any, any, any, any, any>
> {
    protected abstract readonly entityName: string;
    protected readonly logger = new Logger(this.constructor.name);

    constructor(protected readonly repository: TRepository) {}

    /**
     * Get data scope for the current request (override in child classes)
     */
    protected getDataScope(): DataScope | undefined {
        return undefined;
    }

    /**
     * Validate create data (override in child classes for custom validation)
     */
    protected async validateCreate(data: TCreateDto): Promise<void> {
        // Override in child classes for custom validation
    }

    /**
     * Validate update data (override in child classes for custom validation)
     */
    protected async validateUpdate(id: number, data: TUpdateDto): Promise<void> {
        // Override in child classes for custom validation
    }

    /**
     * Transform entity before returning (override in child classes)
     */
    protected transformEntity(entity: TEntity): TEntity {
        return entity;
    }

    /**
     * Hook called after entity creation (override in child classes)
     */
    protected async afterCreate(entity: TEntity): Promise<void> {
        // Override in child classes for post-creation operations
    }

    /**
     * Hook called after entity update (override in child classes)
     */
    protected async afterUpdate(entity: TEntity): Promise<void> {
        // Override in child classes for post-update operations
    }

    /**
     * Hook called after entity deletion (override in child classes)
     */
    protected async afterDelete(id: number): Promise<void> {
        // Override in child classes for post-deletion operations
    }

    /**
     * Create a new entity
     */
    async create(data: TCreateDto, include?: any): Promise<TEntity> {
        this.logger.log(`Creating ${this.entityName}`);

        await this.validateCreate(data);

        const scope = this.getDataScope();
        const entity = await this.repository.create(data as any, include, scope);

        await this.afterCreate(entity);

        return this.transformEntity(entity);
    }

    /**
     * Find entity by ID
     */
    async findById(id: number, include?: any, select?: any): Promise<TEntity | null> {
        this.logger.log(`Finding ${this.entityName} by ID: ${id}`);

        const scope = this.getDataScope();
        const entity = await this.repository.findById(id, include, scope, select);

        return entity ? this.transformEntity(entity) : null;
    }

    /**
     * Find entity by ID or throw exception
     */
    async findByIdOrThrow(id: number, include?: any): Promise<TEntity> {
        this.logger.log(`Finding ${this.entityName} by ID or throw: ${id}`);

        const scope = this.getDataScope();
        const entity = await this.repository.findByIdOrThrow(id, include, scope);

        return this.transformEntity(entity);
    }

    /**
     * Find all entities with optional filters
     */
    async findAll(
        where?: any,
        orderBy?: any,
        include?: any,
        pagination?: PaginationDto,
        select?: any
    ): Promise<TEntity[]> {
        this.logger.log(`Finding all ${this.entityName}`);

        const scope = this.getDataScope();
        const entities = await this.repository.findMany(
            where,
            orderBy,
            include,
            pagination,
            select,
            scope
        );

        return entities.map(entity => this.transformEntity(entity));
    }

    /**
     * Find entities with pagination
     */
    async findAllWithPagination(
        where?: any,
        orderBy?: any,
        include?: any,
        pagination: PaginationDto = { page: 1, limit: 10 },
        select?: any
    ): Promise<PaginationResponseDto<TEntity>> {
        this.logger.log(`Finding paginated ${this.entityName}`);

        const scope = this.getDataScope();
        const result = await this.repository.findManyWithPagination(
            where,
            orderBy,
            include,
            pagination,
            scope,
            select
        );

        return {
            ...result,
            data: result.data.map((entity: TEntity) => this.transformEntity(entity)),
        };
    }

    /**
     * Update entity by ID
     */
    async update(id: number, data: TUpdateDto, include?: any): Promise<TEntity> {
        this.logger.log(`Updating ${this.entityName} with ID: ${id}`);

        await this.validateUpdate(id, data);

        const scope = this.getDataScope();
        const entity = await this.repository.update(id, data as any, include, scope);

        await this.afterUpdate(entity);

        return this.transformEntity(entity);
    }

    /**
     * Delete entity by ID
     */
    async delete(id: number): Promise<TEntity> {
        this.logger.log(`Deleting ${this.entityName} with ID: ${id}`);

        const scope = this.getDataScope();
        const entity = await this.repository.delete(id, scope);

        await this.afterDelete(id);

        return this.transformEntity(entity);
    }

    /**
     * Count entities matching conditions
     */
    async count(where?: any): Promise<number> {
        this.logger.log(`Counting ${this.entityName}`);

        const scope = this.getDataScope();
        return await this.repository.count(where, scope);
    }

    /**
     * Check if entity exists
     */
    async exists(where: any): Promise<boolean> {
        this.logger.log(`Checking if ${this.entityName} exists`);

        const scope = this.getDataScope();
        return await this.repository.exists(where, scope);
    }
}