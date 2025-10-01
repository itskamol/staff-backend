# Code Generalization & Abstraction Plan

**Sana:** 1 Oktyabr 2025  
**Repository:** itskamol/staff  
**Branch:** migration

## 🎯 Umumiylashtirish Maqsadi

Hozirgi kod bazasida **code duplication**, **tightly coupled modules**, va **hardcoded values** muammolarini bartaraf etish orqali **maintainable**, **scalable** va **reusable** kod yaratish.

## 🔍 Hozirgi Kod Tahlili

### Aniqlangan Muammolar:

#### 1. Code Duplication Issues
- **Similar Controller patterns** - Har bir modulda bir xil CRUD operatsiyalar
- **Repeated DTO structures** - Create/Update/Response DTOs pattern takrorlanishi
- **Database query patterns** - Har service da bir xil Prisma queries
- **Validation patterns** - Har DTO da bir xil validation logic
- **Response formatting** - Har controller da bir xil response structure

#### 2. Hardcoded Values
- Port numbers: 3000, 3001
- API URLs: localhost references  
- Event types: 'ACTIVE_WINDOW', 'VISITED_SITE', etc.
- Role names: 'ADMIN', 'HR', 'DEPARTMENT_LEAD'
- Status constants scattered across codebase

#### 3. Tightly Coupled Modules
- Relative import paths: `../../shared/utils`
- Direct service dependencies across modules
- Configuration scattered across multiple files
- Business logic mixed with presentation logic

## 📋 Umumiylashtirish Plan - 5 Bosqich

### 🎯 **Bosqich 1: Base Abstractions (1-2 hafta)**

#### 1.1 Generic CRUD Controller

```typescript
// shared/abstractions/src/lib/controllers/base-crud.controller.ts
export abstract class BaseCrudController<
  TEntity,
  TCreateDto,
  TUpdateDto,
  TResponseDto
> {
  constructor(
    protected readonly service: BaseCrudService<TEntity, TCreateDto, TUpdateDto>,
    protected readonly responseTransformer: ResponseTransformer<TEntity, TResponseDto>
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create new entity' })
  async create(
    @Body() createDto: TCreateDto,
    @GetUser() user: UserContext
  ): Promise<StandardApiResponse<TResponseDto>> {
    const entity = await this.service.create(createDto, user);
    return this.responseTransformer.toResponse(entity);
  }

  @Get()
  @ApiOperation({ summary: 'Get all entities' })
  async findAll(
    @Query() query: QueryDto,
    @GetUser() user: UserContext
  ): Promise<StandardApiResponse<TResponseDto[]>> {
    const { data, pagination } = await this.service.findAllWithPagination(query, user);
    return this.responseTransformer.toPaginatedResponse(data, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get entity by ID' })
  async findOne(
    @Param('id') id: string,
    @GetUser() user: UserContext
  ): Promise<StandardApiResponse<TResponseDto>> {
    const entity = await this.service.findOne(id, user);
    return this.responseTransformer.toResponse(entity);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update entity' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: TUpdateDto,
    @GetUser() user: UserContext
  ): Promise<StandardApiResponse<TResponseDto>> {
    const entity = await this.service.update(id, updateDto, user);
    return this.responseTransformer.toResponse(entity);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete entity' })
  async remove(
    @Param('id') id: string,
    @GetUser() user: UserContext
  ): Promise<StandardApiResponse<void>> {
    await this.service.remove(id, user);
    return { success: true, message: 'Entity deleted successfully' };
  }
}
```

**Natija:** 80% controller code reduction

#### 1.2 Generic CRUD Service

```typescript
// shared/abstractions/src/lib/services/base-crud.service.ts
export abstract class BaseCrudService<
  TEntity,
  TCreateDto,
  TUpdateDto,
  TRepository = BaseRepository<TEntity>
> {
  constructor(
    protected readonly repository: TRepository,
    protected readonly logger: LoggerService,
    protected readonly validator: ValidationService
  ) {}

  async create(createDto: TCreateDto, user: UserContext): Promise<TEntity> {
    await this.validator.validate(createDto);
    await this.validateBusinessRules(createDto, user, 'create');
    
    const entity = await this.repository.create(
      this.transformCreateDto(createDto),
      undefined,
      this.getDataScope(user)
    );
    
    await this.afterCreate(entity, user);
    this.logger.log(`Entity created: ${JSON.stringify(entity)}`);
    return entity;
  }

  async findAllWithPagination(
    query: QueryDto, 
    user: UserContext
  ): Promise<{ data: TEntity[]; pagination: PaginationInfo }> {
    const filters = this.buildFilters(query, user);
    return await this.repository.findManyWithPagination(
      filters,
      query.orderBy,
      this.getIncludeOptions(),
      {
        page: query.page,
        limit: query.limit
      },
      undefined,
      this.getDataScope(user)
    );
  }

  // Abstract methods for customization
  protected abstract transformCreateDto(dto: TCreateDto): any;
  protected abstract transformUpdateDto(dto: TUpdateDto): any;
  protected abstract buildFilters(query: QueryDto, user: UserContext): any;
  protected abstract getDataScope(user: UserContext): DataScope;
  protected abstract getIncludeOptions(): any;
  
  // Hook methods
  protected async validateBusinessRules(
    dto: TCreateDto | TUpdateDto | null, 
    user: UserContext, 
    operation: 'create' | 'update' | 'delete',
    existingEntity?: TEntity
  ): Promise<void> {}
  
  protected async afterCreate(entity: TEntity, user: UserContext): Promise<void> {}
  protected async afterUpdate(entity: TEntity, previousEntity: TEntity, user: UserContext): Promise<void> {}
  protected async afterDelete(entity: TEntity, user: UserContext): Promise<void> {}
}
```

**Natija:** 75% service boilerplate reduction

#### 1.3 Generic Response Transformers

```typescript
// shared/abstractions/src/lib/transformers/response.transformer.ts
export abstract class ResponseTransformer<TEntity, TResponseDto> {
  abstract transform(entity: TEntity): TResponseDto;
  
  toResponse(entity: TEntity): StandardApiResponse<TResponseDto> {
    return {
      success: true,
      data: this.transform(entity),
      message: 'Operation completed successfully',
      timestamp: new Date(),
      path: this.getPath()
    };
  }
  
  toPaginatedResponse(
    entities: TEntity[], 
    pagination: PaginationInfo
  ): StandardApiResponse<TResponseDto[]> {
    return {
      success: true,
      data: entities.map(entity => this.transform(entity)),
      message: 'Data retrieved successfully',
      timestamp: new Date(),
      path: this.getPath(),
      pagination
    };
  }
  
  protected abstract getPath(): string;
}
```

### 🎯 **Bosqich 2: Configuration Management (1 hafta)**

#### 2.1 Centralized Configuration

```typescript
// shared/config/src/lib/app-config.service.ts
@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  // API Configuration
  get api() {
    return {
      agent: {
        port: this.configService.get<number>('AGENT_API_PORT', 3001),
        host: this.configService.get<string>('AGENT_API_HOST', 'localhost'),
        prefix: this.configService.get<string>('AGENT_API_PREFIX', 'api')
      },
      dashboard: {
        port: this.configService.get<number>('DASHBOARD_API_PORT', 3000),
        host: this.configService.get<string>('DASHBOARD_API_HOST', 'localhost'),
        prefix: this.configService.get<string>('DASHBOARD_API_PREFIX', 'api')
      }
    };
  }

  // Authentication Configuration
  get auth() {
    return {
      jwt: {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1h'),
        refreshExpiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d')
      },
      bcrypt: {
        rounds: this.configService.get<number>('BCRYPT_ROUNDS', 12)
      }
    };
  }

  // HIKVision Configuration
  get hikvision() {
    return {
      devices: this.configService.get<string[]>('HIKVISION_DEVICES', []),
      username: this.configService.get<string>('HIKVISION_USERNAME'),
      password: this.configService.get<string>('HIKVISION_PASSWORD'),
      timeout: this.configService.get<number>('HIKVISION_TIMEOUT', 30000)
    };
  }
}
```

#### 2.2 Environment-based Constants

```typescript
// shared/constants/src/lib/app.constants.ts
export const APP_CONSTANTS = {
  // API Response Messages
  MESSAGES: {
    SUCCESS: {
      CREATED: 'Resource created successfully',
      UPDATED: 'Resource updated successfully',
      DELETED: 'Resource deleted successfully',
      RETRIEVED: 'Data retrieved successfully'
    },
    ERROR: {
      NOT_FOUND: 'Resource not found',
      UNAUTHORIZED: 'Unauthorized access',
      FORBIDDEN: 'Access forbidden',
      VALIDATION_FAILED: 'Validation failed'
    }
  },

  // HIKVision Events
  HIKVISION: {
    EVENT_TYPES: {
      ENTRY: 'ENTRY',
      EXIT: 'EXIT',
      FACE_DETECTION: 'FACE_DETECTION',
      CARD_ACCESS: 'CARD_ACCESS'
    }
  },

  // Computer Monitoring
  MONITORING: {
    DATA_TYPES: {
      ACTIVE_WINDOW: 'ACTIVE_WINDOW',
      VISITED_SITE: 'VISITED_SITE',
      SCREENSHOT: 'SCREENSHOT',
      USER_SESSION: 'USER_SESSION'
    }
  },

  // RBAC
  RBAC: {
    ROLES: {
      ADMIN: 'ADMIN',
      HR: 'HR',
      DEPARTMENT_LEAD: 'DEPARTMENT_LEAD',
      GUARD: 'GUARD'
    }
  }
} as const;

// Type-safe constants
export type AppRole = typeof APP_CONSTANTS.RBAC.ROLES[keyof typeof APP_CONSTANTS.RBAC.ROLES];
export type HikvisionEventType = typeof APP_CONSTANTS.HIKVISION.EVENT_TYPES[keyof typeof APP_CONSTANTS.HIKVISION.EVENT_TYPES];
```

### 🎯 **Bosqich 3: Generic Utilities & Helpers (1-2 hafta)**

#### 3.1 Generic Validation Service

```typescript
// shared/validation/src/lib/validation.service.ts
@Injectable()
export class ValidationService {
  async validate<T extends object>(dto: T, groups?: string[]): Promise<void> {
    const errors = await validate(dto, {
      groups,
      whitelist: true,
      transform: true,
      validationError: { target: false, value: false }
    });

    if (errors.length > 0) {
      throw new ValidationException(this.formatErrors(errors));
    }
  }

  // Business rule validation
  async validateBusinessRule(
    condition: boolean,
    message: string,
    errorCode?: string
  ): Promise<void> {
    if (!condition) {
      throw new BusinessRuleException(message, errorCode);
    }
  }

  // Unique field validation
  async validateUnique<T>(
    repository: BaseRepository<T>,
    field: keyof T,
    value: any,
    excludeId?: string | number,
    scope?: DataScope
  ): Promise<void> {
    const whereClause = { [field]: value };
    if (excludeId) {
      whereClause['id'] = { not: excludeId };
    }

    const existing = await repository.findUnique(whereClause, undefined, scope);
    if (existing) {
      throw new ValidationException([{
        field: field as string,
        message: `${field as string} must be unique`,
        value
      }]);
    }
  }
}
```

#### 3.2 Generic Query Builder

```typescript
// shared/query-builder/src/lib/query-builder.service.ts
export class QueryBuilder<T> {
  private whereConditions: any = {};
  private includeRelations: any = {};
  private orderByFields: any = {};
  private paginationOptions: { skip?: number; take?: number } = {};

  where(conditions: Partial<T> | ((builder: WhereBuilder<T>) => void)): this {
    if (typeof conditions === 'function') {
      const whereBuilder = new WhereBuilder<T>();
      conditions(whereBuilder);
      this.whereConditions = { ...this.whereConditions, ...whereBuilder.build() };
    } else {
      this.whereConditions = { ...this.whereConditions, ...conditions };
    }
    return this;
  }

  include(relations: IncludeRelations<T>): this {
    this.includeRelations = { ...this.includeRelations, ...relations };
    return this;
  }

  orderBy(field: keyof T, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderByFields[field as string] = direction;
    return this;
  }

  paginate(page: number, limit: number): this {
    this.paginationOptions = {
      skip: (page - 1) * limit,
      take: limit
    };
    return this;
  }

  // Search functionality
  search(searchTerm: string, searchFields: (keyof T)[]): this {
    if (searchTerm && searchFields.length > 0) {
      const searchConditions = searchFields.map(field => ({
        [field]: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      }));
      
      this.whereConditions = {
        ...this.whereConditions,
        OR: searchConditions
      };
    }
    return this;
  }

  // Build final query
  build(): PrismaQueryOptions {
    return {
      where: this.whereConditions,
      include: Object.keys(this.includeRelations).length > 0 ? this.includeRelations : undefined,
      orderBy: Object.keys(this.orderByFields).length > 0 ? this.orderByFields : undefined,
      ...this.paginationOptions
    };
  }

  // Execute query
  async execute(repository: BaseRepository<T>): Promise<T[]> {
    const query = this.build();
    return await repository.findMany(
      query.where,
      query.orderBy,
      query.include,
      query.skip && query.take ? { 
        page: Math.floor(query.skip / query.take) + 1, 
        limit: query.take 
      } : undefined
    );
  }
}
```

### 🎯 **Bosqich 4: Module Templates & Generators (2 hafta)**

#### 4.1 NX Schematic for CRUD Module

```bash
# Generate new CRUD module
nx g @staff/generators:crud-module \
  --name=products \
  --app=dashboard-api \
  --entity=Product \
  --fields=name:string:true,price:number:true,description:string:false \
  --withAuth=true \
  --withPagination=true \
  --withSoftDelete=true
```

Bu generator quyidagi fayllarni avtomatik yaratadi:
- Controller (BaseCrudController extends)
- Service (BaseCrudService extends)  
- Repository (BaseRepository extends)
- DTOs (standardized pattern)
- Module (proper imports/exports)
- Tests (with mocks and base test cases)

#### 4.2 Template Files

```typescript
// Generated controller template
@Controller('<%= entityNamePlural %>')
export class <%= controllerName %> extends BaseCrudController<
  <%= className %>,
  Create<%= className %>Dto,
  Update<%= className %>Dto,
  <%= className %>ResponseDto
> {
  constructor(
    private readonly <%= entityNameLower %>Service: <%= serviceName %>,
    private readonly responseTransformer: <%= className %>ResponseTransformer
  ) {
    super(<%= entityNameLower %>Service, responseTransformer);
  }

  // Additional custom endpoints can be added here
}
```

**Benefits:**
- **85% faster** module creation (2-3 hours → 15 minutes)
- **95% consistency** across modules
- **Automatic testing** setup
- **Built-in best practices**

### 🎯 **Bosqich 5: Advanced Abstractions (2-3 hafta)**

#### 5.1 Event-Driven Architecture

```typescript
// shared/events/src/lib/event-bus.service.ts
@Injectable()
export class EventBusService {
  private readonly eventEmitter = new EventEmitter2();

  // Emit events
  async emit<T extends BaseEvent>(event: T): Promise<void> {
    this.logger.debug(`Emitting event: ${event.eventType}`);
    this.eventEmitter.emit(event.eventType, event);
    await this.persistEvent(event);
  }

  // Subscribe to events
  on<T extends BaseEvent>(
    eventType: string,
    listener: (event: T) => Promise<void> | void
  ): void {
    this.eventEmitter.on(eventType, async (event: T) => {
      try {
        await listener(event);
      } catch (error) {
        this.logger.error(`Event listener failed for ${eventType}`, error);
      }
    });
  }
}

// Domain events
export class EntityCreatedEvent<T> extends BaseEvent {
  constructor(
    entityType: string,
    public readonly entity: T,
    userId?: number,
    organizationId?: number
  ) {
    super(`${entityType}.created`, userId, organizationId);
  }
}
```

#### 5.2 Advanced RBAC System

```typescript
// shared/rbac/src/lib/rbac.service.ts
@Injectable()
export class RbacService {
  // Check if user has permission
  async hasPermission(
    user: UserContext,
    resource: string,
    action: string,
    resourceId?: string
  ): Promise<boolean> {
    const cacheKey = `rbac:${user.id}:${resource}:${action}:${resourceId || 'all'}`;
    
    // Check cache first
    const cached = await this.cacheService.get<boolean>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Calculate permission
    const hasPermission = await this.calculatePermission(user, resource, action, resourceId);
    
    // Cache result
    await this.cacheService.set(cacheKey, hasPermission, 300);
    
    return hasPermission;
  }

  private async calculatePermission(
    user: UserContext,
    resource: string,
    action: string,
    resourceId?: string
  ): Promise<boolean> {
    // Get user roles (including inherited roles)
    const userRoles = await this.getUserRoles(user);
    
    // Check each role for permission
    for (const role of userRoles) {
      const permissions = this.permissionMatrix.get(role) || [];
      
      for (const permission of permissions) {
        if (this.matchesPermission(permission, resource, action)) {
          if (await this.checkDataScope(permission, user, resourceId)) {
            return true;
          }
        }
      }
    }

    return false;
  }
}
```

## 📊 Implementation Metrics

### Code Reduction Targets

| Area | Current | Target | Improvement |
|------|---------|---------|-------------|
| Controller Code | ~100 lines/controller | ~20 lines/controller | **80% reduction** |
| Service Boilerplate | ~200 lines/service | ~50 lines/service | **75% reduction** |
| DTO Duplication | ~50 similar DTOs | ~10 base DTOs | **80% reduction** |
| Validation Logic | Scattered | Centralized | **90% reusability** |
| Query Patterns | Repeated 20+ times | 1 query builder | **95% reduction** |

### Maintainability Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Module Creation Time | 2-3 hours | 15 minutes | **85% faster** |
| Code Consistency | 60% | 95% | **35% improvement** |
| Bug Fix Impact | Multiple files | Single file | **80% reduction** |
| New Feature Addition | 3-5 files | 1-2 files | **60% reduction** |
| Test Coverage | 60% | 85% | **25% improvement** |

## 🔧 Usage Examples

### Creating New Module with Abstraction

```bash
# Generate new CRUD module
nx g @staff/generators:crud-module \
  --name=products \
  --app=dashboard-api \
  --entity=Product \
  --fields=name:string:true,price:number:true,description:string:false \
  --withAuth=true \
  --withPagination=true \
  --withSoftDelete=true
```

### Using Generic Query Builder

```typescript
// In service
async findProductsWithAdvancedFilters(query: ProductQueryDto, user: UserContext) {
  return new QueryBuilder<Product>(this.productSchema)
    .where(builder => 
      builder
        .equals('isActive', true)
        .between('price', query.minPrice, query.maxPrice)
        .contains('name', query.search)
    )
    .include({ category: true, reviews: { take: 5 } })
    .orderBy('createdAt', 'desc')
    .paginate(query.page, query.limit)
    .search(query.search, ['name', 'description'])
    .executeWithCount(this.productRepository);
}
```

### Event-Driven Operations

```typescript
// In service
async createProduct(dto: CreateProductDto, user: UserContext) {
  const product = await super.create(dto, user);
  
  // Emit domain event
  await this.eventBus.emit(
    new EntityCreatedEvent('product', product, user.id, user.organizationId)
  );
  
  return product;
}

// Event listener in another module
@Injectable()
export class ProductEventHandler {
  constructor(private eventBus: EventBusService) {
    this.eventBus.on('product.created', this.handleProductCreated.bind(this));
  }
  
  async handleProductCreated(event: EntityCreatedEvent<Product>) {
    // Send notification, update inventory, etc.
  }
}
```

## 📅 Implementation Timeline

### Phase 1 (1-2 hafta): Base Abstractions
- [ ] BaseCrudController implementation
- [ ] BaseCrudService implementation  
- [ ] ResponseTransformer implementation
- [ ] Initial testing and validation

### Phase 2 (1 hafta): Configuration Management
- [ ] AppConfigService implementation
- [ ] Constants centralization
- [ ] Environment configuration
- [ ] Migration of hardcoded values

### Phase 3 (1-2 hafta): Generic Utilities
- [ ] ValidationService implementation
- [ ] QueryBuilder implementation
- [ ] Error handling standardization
- [ ] Utility function consolidation

### Phase 4 (2 hafta): Module Templates
- [ ] NX schematic development
- [ ] Template file creation
- [ ] Generator testing
- [ ] Documentation creation

### Phase 5 (2-3 hafta): Advanced Features
- [ ] Event-driven architecture
- [ ] Advanced RBAC system
- [ ] Performance optimization
- [ ] Final testing and validation

## 🎯 Success Criteria

### Technical Metrics
- ✅ **80%+ code reduction** in controllers
- ✅ **75%+ boilerplate reduction** in services
- ✅ **90%+ reusability** in validation logic
- ✅ **95%+ reduction** in query patterns
- ✅ **85% faster** module creation

### Quality Metrics
- ✅ **95%+ consistency** across modules
- ✅ **25%+ improvement** in test coverage
- ✅ **80%+ reduction** in bug fix impact
- ✅ **35%+ improvement** in code consistency

### Developer Experience
- ✅ **85% faster** new feature development
- ✅ **Standardized** patterns across team
- ✅ **Reduced** learning curve for new developers
- ✅ **Improved** code maintainability

## 🔄 Migration Strategy

### Incremental Approach
1. **Create abstractions** in shared libraries
2. **Migrate one module** as proof of concept
3. **Test and validate** the approach
4. **Gradually migrate** other modules
5. **Remove old patterns** after full migration

### Risk Mitigation
- **Parallel development** - old and new patterns coexist
- **Gradual rollout** - module by module migration
- **Comprehensive testing** at each step
- **Rollback strategy** if issues arise

Bu plan loyihangizni DRY (Don't Repeat Yourself) prinsipiga asosan qayta tashkil qilish va maintainable code bazasini yaratish uchun comprehensive roadmap hisoblanadi! 🚀