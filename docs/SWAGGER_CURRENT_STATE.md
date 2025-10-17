# Swagger Implementation – Current State Analysis

## 📊 Xulosa

Bu hujjat loyihaning Swagger/OpenAPI dokumentatsionasining joriy holati, mavjud patterns, va shared modules'ga o'tkazish uchun tahlillarni o'z ichiga oladi.

---

## 1️⃣ Mavjud Swagger Setup'lari

### 1.1 Agent API

**📍 Fayl:** `apps/agent-api/src/main.ts`

```typescript
const config = new DocumentBuilder()
    .setTitle('Staff Control System - Agent API')
    .setDescription('Data collection API for computer monitoring and access control systems')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .addBearerAuth()
    .addTag('Agent', 'Computer monitoring data collection')
    .addTag('HIKVision', 'HIKVision access control integration')
    .addTag('Data Processing', 'Asynchronous data processing')
    .addTag('Security', 'API security management')
    .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

**Status:**
- ✅ DocumentBuilder configured
- ✅ Tags defined
- ✅ API key + Bearer auth supported
- ❌ Controllers largely undocumented
- ❌ No extraModels configured

**Swagger URL:** `http://localhost:3001/api/docs`

---

### 1.2 Dashboard API

**📍 Fayl:** `apps/dashboard-api/src/main.ts`

```typescript
const config = new DocumentBuilder()
    .setTitle('Staff Control System - Dashboard API')
    .setDescription('Comprehensive API for staff management, monitoring, and reporting')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management operations')
    .addTag('Organizations', 'Organization management')
    .addTag('Departments', 'Department management')
    .addTag('Employees', 'Employee management')
    .addTag('Visitors', 'Visitor management and access control')
    .addTag('Policies', 'Security and monitoring policies')
    .build();

const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ApiSuccessResponse, ApiErrorResponse, ApiPaginatedResponse],
});

SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    customSiteTitle: 'Sector Staff API Docs',
});
```

**Status:**
- ✅ DocumentBuilder configured
- ✅ Tags defined (7 tags)
- ✅ extraModels configured
- ✅ Custom Swagger UI options
- ⚠️ Controllers dokumentatsiyasi partial (User ✅, others ❌)

**Swagger URL:** `http://localhost:3000/api/docs`

---

### 1.3 Agent Gateway

**📍 Fayl:** `apps/agent-gateway/src/main.ts`

```typescript
async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
        })
    );

    const port = Number(process.env.PORT) || 4100;
    await app.listen(port, '0.0.0.0');
    Logger.log(`Agent Gateway listening on http://localhost:${port}/v1/health`, 'Bootstrap');
}
```

**Status:**
- ❌ **No Swagger setup!**
- ❌ No DocumentBuilder
- ❌ No Swagger UI
- ✅ Global prefix configured

**Swagger URL:** ❌ Not available

---

## 2️⃣ Shared Swagger Utilities Analysis

### 2.1 Location: `apps/dashboard-api/src/shared/utils/swagger.util.ts`

**⚠️ Muammo:** Bu fayldan faqat Dashboard API'da foydalanilmoqda. Agent Gateway va Agent API ham foydalana oladi.

### 2.2 Mavjud Decorators

#### 1. `ApiOkResponseData<T>()`
```typescript
ApiOkResponseData<UserResponseDto>(UserResponseDto, {
    body: CreateUserDto,
    summary: 'Create a new user'
})
```
**Maqsadi:** Single object response'larni wrap qilish
**Ishlatilgani:** ✅ Dashboard API controllers

#### 2. `ApiOkResponsePaginated<T>()`
```typescript
ApiOkResponsePaginated<UserResponseDto>(UserResponseDto, {
    summary: 'Get all users'
})
```
**Maqsadi:** Paginated list response'larni wrap qilish
**Ishlatilgani:** ✅ Dashboard API list endpoints

#### 3. `ApiErrorResponses()`
```typescript
ApiErrorResponses({
    forbidden: true,
    notFound: true,
    badRequest: true,
    conflict: true,
})
```
**Maqsadi:** Error response'larni auto-generate qilish
**Ishlatilgani:** ✅ Barcha error response'lar

#### 4. `ApiQueries()`
```typescript
ApiQueries({
    pagination: true,
    search: true,
    sort: true
})
```
**Maqsadi:** Query parameters'ni auto-generate qilish
**Ishlatilgani:** ✅ Filter/search endpoints

#### 5. `ApiOkResponseArray()`
```typescript
ApiOkResponseArray('string', {
    summary: 'Get all user roles'
})
```
**Maqsadi:** Array responses (primitive types)
**Ishlatilgani:** ✅ Simple list endpoints

#### 6. `ApiCrudOperation()` – **Combined Decorator** 🌟
```typescript
@ApiCrudOperation(UserResponseDto, 'create', {
    body: CreateUserDto,
    summary: 'Create a new user',
    errorResponses: { badRequest: true, conflict: true },
})
```

**Operations:**
- `'create'` → POST
- `'update'` → PUT
- `'delete'` → DELETE
- `'get'` → GET by ID
- `'list'` → GET list

**Ishlatilgani:** ✅ Most common CRUD endpoints

---

### 2.3 DTO Files

#### `api-response.dto.ts` – Dashboard API
```typescript
export class ApiSuccessResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    timestamp: Date;
}

export class ApiErrorResponse {
    success: boolean;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    timestamp: Date;
}

export class ApiPaginatedResponse<T = any> {
    data: T[];
    total?: number;
    page?: number;
    limit?: number;
}
```

**Status:** ✅ Well-structured, reusable

#### `pagination.dto.ts` – Shared Utils
```typescript
export class PaginationDto {
    @ApiProperty({ example: 1, default: 1 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiProperty({ example: 10, default: 10 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 10;
}

export class PaginationResponseDto<T> {
    @ApiProperty({ isArray: true })
    data: T[];

    @ApiProperty({ example: 100 })
    total?: number;

    @ApiProperty({ example: 1 })
    page?: number;

    @ApiProperty({ example: 10 })
    limit?: number;
}
```

**Status:** ✅ In shared/utils, already reusable

#### `query.dto.ts` – Shared Utils
```typescript
export class QueryDto extends PaginationDto {
    @ApiProperty({
        description: 'Search term',
        required: false,
    })
    @IsOptional()
    @IsString()
    @MinLength(2)
    search?: string;

    @ApiProperty({
        description: 'Field to sort by',
        required: false,
    })
    @IsOptional()
    @IsString()
    sort?: string;

    @ApiProperty({
        description: 'Sort order',
        enum: ['asc', 'desc'],
        required: false,
    })
    @IsOptional()
    @IsEnum(SortOrder)
    order?: SortOrder;
}
```

**Status:** ✅ In shared/utils

---

## 3️⃣ Controllers Documentation Coverage

### 3.1 Dashboard API Controllers

```bash
# Total controllers found:
find apps/dashboard-api/src -name "*.controller.ts" -type f
```

#### Controllers List

| Controller | Module | Dokumentatsiya | Status |
|------------|--------|-----------------|--------|
| `user.controller.ts` | User | ✅ Partial | ApiCrudOperation used |
| `organization.controller.ts` | Organization | ❌ None | Needs complete docs |
| `department.controller.ts` | Department | ❌ None | Needs complete docs |
| `employee.controller.ts` | Employee | ❌ None | Needs complete docs |
| `policy.controller.ts` | Policy | ❌ None | Needs complete docs |
| `device.controller.ts` | Device | ❌ None | Needs complete docs |
| `visitor.controller.ts` | Visitor | ⚠️ Partial | Old implementation |
| `visitors.controller.ts` | Visitors (v2) | ⚠️ Partial | New implementation |
| `app.controller.ts` | App | ❌ None | Root endpoint |

#### User Controller – Good Example ✅

```typescript
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@ApiExtraModels(ApiSuccessResponse, UserResponseDto)
export class UserController {
    @Post()
    @ApiCrudOperation(UserResponseDto, 'create', {
        body: CreateUserDto,
        summary: 'Create a new user',
        errorResponses: { badRequest: true, conflict: true },
    })
    async createUser(@Body() createUserDto: CreateUserDto) { }

    @Get()
    @ApiCrudOperation(UserResponseDto, 'list', {
        summary: 'Get all users',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
        },
    })
    async getAllUsers(@Query() query: QueryDto) { }

    @Get('me')
    @ApiCrudOperation(UserResponseDto, 'get', {
        summary: 'Get current user',
    })
    async getCurrentUser(@User() user: UserContext) { }

    @Get(':id')
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiCrudOperation(UserResponseDto, 'get', {
        summary: 'Get a specific user by ID',
    })
    async getUserById(@Param('id') id: number) { }
}
```

**✅ Best Practices:**
- ApiTags used correctly
- ApiBearerAuth applied
- ApiCrudOperation for consistency
- Query parameters documented
- Operation-specific summaries

---

### 3.2 Agent API Controllers

**📍 Location:** `apps/agent-api/src/app/modules/`

Controllers bu joyda hozirda qayq ko'rish kerak. Ular dokumentatsiyasiz bo'lishi mumkin.

---

### 3.3 Agent Gateway Controllers

**📍 Location:** `apps/agent-gateway/src/modules/`

Hozirda Swagger setup yo'q, shuning uchun controllers dokumentatsiyasiz.

---

## 4️⃣ DTO Pattern Analysis

### 4.1 Response DTO Pattern

**Standard Response Format:**
```typescript
{
    success: boolean,
    message?: string,
    data?: T,
    timestamp: Date,
    error?: {
        code: string,
        message: string,
        details?: any
    }
}
```

**Implementation:** ✅ Consistent across Dashboard API

### 4.2 Pagination Pattern

**Standard Format:**
```typescript
{
    data: T[],
    total?: number,
    page?: number,
    limit?: number
}
```

**Implementation:** ✅ Consistent

### 4.3 Error Response Pattern

**Standard Format:**
```typescript
{
    success: false,
    error: {
        code: 'ERROR_CODE',
        message: 'Human readable message',
        details?: { additional: 'info' }
    },
    timestamp: Date
}
```

**Implementation:** ✅ In ApiErrorResponse DTO

---

## 5️⃣ Tahlil – Qanday O'tkazish Kerak?

### 5.1 Files to Migrate

```
Dashboard API Local Utils → Shared Utils Library
│
├── swagger.util.ts
│   ├── ApiOkResponseData
│   ├── ApiOkResponsePaginated
│   ├── ApiErrorResponses
│   ├── ApiQueries
│   ├── ApiOkResponseArray
│   └── ApiCrudOperation
│
└── DTOs (already in shared/utils, just consolidate)
    ├── api-response.dto.ts
    ├── pagination.dto.ts
    └── query.dto.ts
```

### 5.2 Target Structure

```
shared/utils/src/lib/
├── swagger/                          # 🆕 NEW FOLDER
│   ├── swagger.util.ts              # Moved
│   ├── auth-decorators.ts           # 🆕 For ApiSecureOperation, etc
│   ├── file-decorators.ts           # 🆕 For file upload docs
│   ├── pagination-helpers.ts        # 🆕 For ApiPaginatedGet
│   ├── error-responses.ts           # 🆕 For error handling
│   ├── index.ts
│   └── __tests__/
│       └── swagger.util.spec.ts
│
├── dto/
│   ├── api-response.dto.ts
│   ├── pagination.dto.ts
│   ├── query.dto.ts
│   ├── swagger/                     # 🆕 Swagger-specific DTOs
│   │   ├── api-error.dto.ts
│   │   ├── api-success.dto.ts
│   │   └── index.ts
│   └── index.ts
│
├── index.ts                          # Export all
└── README.md                         # Usage guide
```

### 5.3 Import Changes Needed

**Hozir:**
```typescript
// apps/dashboard-api
import { ApiCrudOperation } from '../../shared/utils/swagger.util';
```

**Keyin:**
```typescript
// apps/dashboard-api
import { ApiCrudOperation } from '@app/shared/utils';

// apps/agent-api
import { ApiCrudOperation } from '@app/shared/utils';

// apps/agent-gateway
import { ApiCrudOperation } from '@app/shared/utils';
```

---

## 6️⃣ Qo'shimcha Utilities – Keyin Qo'shish Kerak

### 6.1 Auth Decorators

**Tavsiya etilgan naming:**
```typescript
// shared/utils/src/lib/swagger/auth-decorators.ts

export const ApiSecureOperation = (roles?: Role[]) => applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Missing or invalid token' }),
    ...(roles ? [ApiForbiddenResponse({ description: 'Insufficient permissions' })] : [])
);

export const ApiKeySecureOperation = () => applyDecorators(
    ApiSecurity('api-key'),
    ApiBadRequestResponse({ description: 'Missing API key' })
);

export const ApiPublicOperation = () => applyDecorators(
    ApiOperation({ summary: 'Public endpoint' })
);
```

### 6.2 File Upload Decorators

```typescript
// shared/utils/src/lib/swagger/file-decorators.ts

export const ApiFileUpload = (
    fieldName: string = 'file',
    options?: { 
        mimetype?: string; 
        maxSize?: number 
    }
) => applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
        schema: {
            type: 'object',
            properties: {
                [fieldName]: {
                    type: 'string',
                    format: 'binary',
                    description: options?.mimetype || 'File to upload'
                },
            },
        },
    })
);

export const ApiMultipleFileUpload = (
    fieldName: string = 'files',
    maxFiles: number = 10
) => applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
        schema: {
            type: 'object',
            properties: {
                [fieldName]: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    maxItems: maxFiles
                },
            },
        },
    })
);
```

### 6.3 Pagination Helper

```typescript
// shared/utils/src/lib/swagger/pagination-helpers.ts

export const ApiPaginatedGet = <T extends Type<unknown>>(
    dataDto: T,
    options?: { 
        summary?: string; 
        search?: boolean; 
        filters?: Record<string, Type>
    }
) => applyDecorators(
    ApiOperation({ summary: options?.summary || 'Get paginated list' }),
    ApiQueries({ 
        pagination: true, 
        search: options?.search || false,
        filters: options?.filters || {}
    }),
    ApiOkResponsePaginated(dataDto),
    ApiErrorResponses({
        unauthorized: true,
        forbidden: true,
    })
);
```

---

## 7️⃣ Endpoint Documentation Strategy

### 7.1 Dashboard API – Required Documentations

| Module | Endpoints | Priority | Status |
|--------|-----------|----------|--------|
| **Users** | 6-8 | 🔴 HIGH | ✅ DONE |
| **Organizations** | 5-7 | 🔴 HIGH | ❌ TODO |
| **Departments** | 6-8 | 🔴 HIGH | ❌ TODO |
| **Employees** | 8-10 | 🔴 HIGH | ❌ TODO |
| **Policies** | 5-7 | 🟡 MEDIUM | ❌ TODO |
| **Devices** | 5-6 | 🟡 MEDIUM | ❌ TODO |
| **Visitors** | 6-8 | 🟡 MEDIUM | ⚠️ PARTIAL |

**Total Endpoints:** ~45-60
**Currently Documented:** ~6 (User controller)
**Coverage:** ~10%

### 7.2 Agent API – Required Documentations

| Module | Endpoints | Priority | Status |
|--------|-----------|----------|--------|
| **Ingest** | 3-5 | 🔴 HIGH | ❌ TODO |
| **Gateway Control** | 4-6 | 🔴 HIGH | ❌ TODO |
| **Health** | 1-2 | 🟡 MEDIUM | ❌ TODO |

**Total Endpoints:** ~8-13
**Currently Documented:** 0
**Coverage:** 0%

### 7.3 Agent Gateway – Required Documentations

| Module | Endpoints | Priority | Status |
|--------|-----------|----------|--------|
| **Health** | 1-2 | 🟡 MEDIUM | ❌ TODO |
| **Collector** | 2-3 | 🔴 HIGH | ❌ TODO |
| **Uplink** | 2-3 | 🟡 MEDIUM | ❌ TODO |
| **Device** | 3-5 | 🔴 HIGH | ❌ TODO |
| **Buffer** | 1-2 | 🟡 MEDIUM | ❌ TODO |

**Total Endpoints:** ~9-15
**Currently Documented:** 0
**Coverage:** 0%

---

## 8️⃣ Package Dependencies

### Currently Used
```json
{
  "@nestjs/common": "^11.1.6",
  "@nestjs/swagger": "^11.2.0",
  "class-validator": "^0.14.2",
  "class-transformer": "^0.5.1"
}
```

### Additional Needed (Optional)
```json
{
  "@nestjs/platform-express": "^11.x",  // For file uploads
  "swagger-ui-dist": "^5.21.0"          // Already installed
}
```

---

## 9️⃣ Files to Create/Modify

### Create (New)
```
shared/utils/src/lib/swagger/
├── swagger.util.ts              (move from dashboard-api)
├── auth-decorators.ts           (new)
├── file-decorators.ts           (new)
├── pagination-helpers.ts        (new)
├── error-responses.ts           (new)
├── __tests__/
│   ├── swagger.util.spec.ts
│   ├── auth-decorators.spec.ts
│   └── file-decorators.spec.ts
├── index.ts                     (new)
└── README.md                    (new)

shared/utils/src/lib/dto/swagger/
├── api-error.dto.ts             (move/consolidate)
├── api-success.dto.ts           (move/consolidate)
└── index.ts                     (new)
```

### Modify
```
apps/dashboard-api/src/
├── main.ts                      (no change needed)
├── shared/utils/                (remove swagger.util.ts)
└── modules/**/*.controller.ts   (add missing docs)

apps/agent-api/src/
├── main.ts                      (add Swagger if missing)
└── modules/**/*.controller.ts   (add docs)

apps/agent-gateway/src/
├── main.ts                      (ADD Swagger setup)
└── modules/**/*.controller.ts   (add docs)

shared/utils/src/
├── lib/index.ts                 (update exports)
└── package.json                 (no change needed)
```

---

## 🔟 Execution Order

1. **Create shared swagger directory structure**
2. **Move swagger.util.ts from dashboard-api**
3. **Update dashboard-api imports**
4. **Create additional decorators**
5. **Add Swagger to Agent Gateway main.ts**
6. **Update Agent API Swagger setup**
7. **Document all controllers (dashboard-api first)**
8. **Document Agent API controllers**
9. **Document Agent Gateway controllers**
10. **Write comprehensive README**

---

## 1️⃣1️⃣ Risk Factors

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Import cycles | Medium | High | Module structure review |
| Missing exports | High | Low | Export tests |
| Breaking changes | Medium | High | Beta branch + tests |
| Performance hit | Low | Medium | Lazy loading |

---

## 1️⃣2️⃣ Success Criteria

✅ 100% endpoints documented in Swagger
✅ All DTOs use @ApiProperty decorators
✅ Shared utilities exported from @app/shared/utils
✅ Zero duplicate Swagger code
✅ All three apps use shared decorators
✅ Swagger UI loads <2 seconds
✅ Documentation matches implementation
✅ All examples include realistic data

---

**Prepared:** 2025-10-17
**Status:** Analysis Complete – Ready for Implementation
