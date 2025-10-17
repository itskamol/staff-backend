# Swagger Documentation Implementation Plan

## 📚 Maqsad
Loyiha routelari uchun comprehensive Swagger docs yozish va common patterns-ni `shared/` modulga o'tkazish.

**Status:** Planning & Analysis Phase

---

## 1️⃣ Hozirgi Holat Tahlili

### 1.1 Mavjud Swagger Setup

#### Agent API (`apps/agent-api/src/main.ts`)
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
```

**Status:** ✅ Basic setup, dokumentatsiya ko'p joyda yo'q

#### Dashboard API (`apps/dashboard-api/src/main.ts`)
```typescript
const config = new DocumentBuilder()
    .setTitle('Staff Control System - Dashboard API')
    .setDescription('Comprehensive API for staff management, monitoring, and reporting')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management operations')
    // ... more tags
    .build();
```

**Status:** ✅ Kontiguratsiya, controllers da tag'lar ko'p joyda yo'q

#### Agent Gateway (`apps/agent-gateway/src/main.ts`)
```typescript
// ❌ Swagger setup yo'q!
app.setGlobalPrefix('v1');
```

**Status:** ❌ Swagger hech qanday joyda yo'q

---

### 1.2 Mavjud Decorator Pattern-lari

#### Shared Utils - Swagger Utilities (`apps/dashboard-api/src/shared/utils/swagger.util.ts`)

**🔧 Mavjud Decorators:**
1. `ApiOkResponseData<T>` – single object response
2. `ApiOkResponsePaginated<T>` – paginated list response
3. `ApiErrorResponses()` – error response'larni auto-generate qilish
4. `ApiQueries()` – query parameters (pagination, search, sort, filter)
5. `ApiOkResponseArray()` – array responses
6. `ApiCrudOperation()` – combined CRUD decorator

**📍 Joylashuvi:** 
- `/home/nemo/Desktop/staff/apps/dashboard-api/src/shared/utils/swagger.util.ts`
- Hozirgi **lokalni** faqat dashboard-api'da

**Misol Foydalanish (User Controller):**
```typescript
@ApiCrudOperation(UserResponseDto, 'create', {
    body: CreateUserDto,
    summary: 'Create a new user',
    errorResponses: { badRequest: true, conflict: true },
})
async createUser(@Body() createUserDto: CreateUserDto) {
    // ...
}
```

---

### 1.3 Response DTO'lar

#### `ApiSuccessResponse` (shared/utils)
```typescript
export class ApiSuccessResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    timestamp: Date;
}
```

#### `ApiPaginatedResponse` (shared/utils)
```typescript
export class PaginationResponseDto<T> {
    data: T[];
    total?: number;
    page?: number;
    limit?: number;
}
```

#### `ApiErrorResponse`
```typescript
export class ApiErrorResponse {
    success: boolean;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    timestamp: Date;
}
```

---

## 2️⃣ Tahlil: Qayerga O'tkazish Kerak?

### 2.1 Shared Utilities'ga O'tkazilishi Kerak

**Hozir:** `/apps/dashboard-api/src/shared/utils/swagger.util.ts`
**Keyin:** `/shared/utils/src/lib/swagger/` (new directory)

| Fayl | Shaklari | Priority |
|------|----------|----------|
| `swagger.util.ts` | All decorators | 🔴 High |
| `api-response.dto.ts` | DTOs | 🔴 High |
| `pagination.dto.ts` | DTOs | 🔴 High |
| `query.dto.ts` | Query DTO | 🟡 Medium |

**Sababi:**
- ✅ Agent Gateway ham foydalansin
- ✅ Agent API ham foydalansin
- ✅ Future services uchun reusable
- ✅ Type-safety + consistency

---

### 2.2 Har bir App'da Qo'shimcha Swagger Setup

**Agent API (`apps/agent-api/`):**
- ✅ Hozirda setup bor
- ⚠️ Main.ts'ni o'zgartirish kerak emas
- 🎯 Controllers'da documentatsiya qo'shish

**Dashboard API (`apps/dashboard-api/`):**
- ✅ Hozirda setup bor
- ✅ Controllers'da documentatsiya partial bor
- 🎯 Barcha controllers'ni complete qilish

**Agent Gateway (`apps/agent-gateway/`):**
- ❌ Setup yo'q
- 🎯 Main.ts'ga Swagger setup qo'shish
- 🎯 Controllers'da full documentation

---

## 3️⃣ Refactoring Plan

### 3.1 Phase 1: Shared Utilities Extraction (Week 1)

#### Step 1.1 – Directory yaratish
```bash
mkdir -p shared/utils/src/lib/swagger
mkdir -p shared/utils/src/lib/dto/swagger
```

#### Step 1.2 – Files ko'chirish
```
✅ swagger.util.ts → shared/utils/src/lib/swagger/swagger.util.ts
✅ api-response.dto.ts → shared/utils/src/lib/dto/api-response.dto.ts
✅ pagination.dto.ts → shared/utils/src/lib/dto/pagination.dto.ts
```

#### Step 1.3 – Index files yaratish
```typescript
// shared/utils/src/lib/swagger/index.ts
export * from './swagger.util';

// shared/utils/src/lib/index.ts (update)
export * from './swagger/index';
export * from './dto/api-response.dto';
export * from './dto/pagination.dto';
```

#### Step 1.4 – Imports o'zgartirish
```typescript
// Qo'lli (manual) yoki Nx tooling orqali
// dashboard-api imports → @app/shared/utils
// agent-gateway imports → @app/shared/utils
// agent-api imports → @app/shared/utils (if needed)
```

---

### 3.2 Phase 2: Agent Gateway Swagger Setup (Week 1-2)

#### Step 2.1 – Main.ts'ni yangilash
```typescript
// apps/agent-gateway/src/main.ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('v1');

    // ✅ Swagger setup qo'shish
    const config = new DocumentBuilder()
        .setTitle('Staff Control System - Agent Gateway')
        .setDescription('Gateway for secure agent data collection and device control')
        .setVersion('1.0')
        .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
        .addBearerAuth()
        .addTag('Health', 'System health endpoints')
        .addTag('Collector', 'Data collection from agents')
        .addTag('Uplink', 'Connection management to Agent API')
        .addTag('Device', 'Device control and management')
        .addTag('Buffer', 'Local queue and buffer status')
        .build();

    const document = SwaggerModule.createDocument(app, config, {
        extraModels: [ApiSuccessResponse, ApiErrorResponse, ApiPaginatedResponse],
    });

    SwaggerModule.setup('v1/docs', app, document, {
        customSiteTitle: 'Staff Gateway API Docs',
        swaggerOptions: { defaultModelsExpandDepth: 1 },
    });

    const port = Number(process.env.PORT) || 4100;
    await app.listen(port, '0.0.0.0');
    Logger.log(`📄 Swagger docs available at: http://localhost:${port}/v1/docs`);
}
```

#### Step 2.2 – Controllers'da documentation
```typescript
// apps/agent-gateway/src/modules/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    @Get()
    @ApiOperation({ summary: 'Gateway health check' })
    @ApiResponse({ 
        status: 200, 
        description: 'Gateway is healthy',
        schema: {
            example: {
                status: 'ok',
                timestamp: new Date().toISOString(),
                version: '1.0'
            }
        }
    })
    health() {
        return { status: 'ok', timestamp: new Date(), version: '1.0' };
    }
}
```

---

### 3.3 Phase 3: Agent API Documentation (Week 2-3)

#### Step 3.1 – DTOs fayl creation
```
apps/agent-api/src/modules/ingest/dto/
├── logs-ingest.dto.ts
├── screenshots-ingest.dto.ts
└── device-events-ingest.dto.ts
```

#### Step 3.2 – Ingest Controller
```typescript
// apps/agent-api/src/modules/ingest/ingest.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { 
    ApiTags, 
    ApiOperation, 
    ApiResponse, 
    ApiBody,
    ApiHeader 
} from '@nestjs/swagger';
import { 
    ApiCrudOperation, 
    ApiErrorResponses 
} from '@app/shared/utils';
import { LogsIngestDto } from './dto/logs-ingest.dto';

@ApiTags('Ingest')
@ApiHeader({
    name: 'X-API-Key',
    description: 'API key for authentication',
    required: true,
})
@Controller('v2/ingest')
export class IngestController {
    @Post('logs')
    @ApiOperation({ 
        summary: 'Ingest monitoring logs',
        description: 'Batch logs from Gateway with automatic routing to TimescaleDB'
    })
    @ApiBody({ type: LogsIngestDto })
    @ApiResponse({
        status: 200,
        description: 'Logs ingested successfully',
        schema: {
            example: {
                success: true,
                message: 'Ingested 150 log records',
                data: { processedCount: 150, failedCount: 0 }
            }
        }
    })
    @ApiErrorResponses({
        badRequest: true,
        unauthorized: true,
    })
    async ingestLogs(@Body() dto: LogsIngestDto) {
        // Implementation
    }
}
```

#### Step 3.3 – Gateway Control Channel
```typescript
// Gateway/Control Channel endpoints (WebSocket + fallback REST)
@ApiTags('Gateway Control')
@Controller('v2/gateway')
export class GatewayControlController {
    @Get('policies/:id')
    @ApiOperation({ summary: 'Get specific policy version' })
    async getPolicy(@Param('id') id: string) { }

    @Post('commands/ack')
    @ApiOperation({ summary: 'Acknowledge command execution' })
    async acknowledgeCommand(@Body() dto: CommandAckDto) { }
}
```

---

### 3.4 Phase 4: Dashboard API Completion (Week 3-4)

#### Step 4.1 – Barcha controllersni audit qilish
```bash
# Find all controllers
find apps/dashboard-api/src -name "*.controller.ts" | wc -l

# Check documentation coverage
grep -r "@ApiCrudOperation\|@ApiOperation" apps/dashboard-api/src | wc -l
```

#### Step 4.2 – Missing Documentation'ni topish
Controllers'ni tekshirish:
- ✅ User controller → dokumentatsiya bor
- ❌ Organization → documentation yo'q
- ❌ Department → documentation yo'q
- ❌ Employee → documentation yo'q
- ❌ Policy → documentation yo'q
- ❌ Device → documentation yo'q
- ✅ Visitor → partial documentation

#### Step 4.3 – DTOs va decorators
```typescript
// apps/dashboard-api/src/modules/organization/dto/
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrganizationDto {
    @ApiProperty({
        description: 'Organization name',
        example: 'Acme Corporation',
        maxLength: 255
    })
    name: string;

    @ApiProperty({
        description: 'Organization code/identifier',
        example: 'ACME_CORP',
        unique: true
    })
    code: string;

    @ApiProperty({
        description: 'Optional description',
        example: 'Leading tech company',
        required: false
    })
    description?: string;
}
```

---

## 4️⃣ Shared Swagger Utilities – Extended Features

### 4.1 Hozirgi Utilities Tahlili

**Mavjud Decorators:**
```typescript
// 1. Response wrappers
- ApiOkResponseData<T>(dataDto, options)
- ApiOkResponsePaginated<T>(dataDto, options)
- ApiOkResponseArray(itemType, options)

// 2. Error handling
- ApiErrorResponses(options, customResponses)

// 3. Query parameters
- ApiQueries(options, customQueries)

// 4. Combined
- ApiCrudOperation(dataDto, operation, options)
```

### 4.2 Qo'shimcha Utilities Qilish Kerak

#### A. Security/Auth Decorators
```typescript
// shared/utils/src/lib/swagger/auth-decorators.ts
export const ApiSecureOperation = (scopes?: string[]) => 
    applyDecorators(
        ApiBearerAuth(),
        ApiUnauthorizedResponse({ description: 'Invalid token' }),
        ...
    );

export const ApiKeyOperation = () =>
    applyDecorators(
        ApiSecurity('api-key'),
        ApiBadRequestResponse({ description: 'Missing API key' })
    );
```

#### B. File Upload Decorators
```typescript
// shared/utils/src/lib/swagger/file-decorators.ts
export const ApiFileUpload = (fieldName: string = 'file') =>
    applyDecorators(
        ApiConsumes('multipart/form-data'),
        ApiBody({
            schema: {
                type: 'object',
                properties: {
                    [fieldName]: {
                        type: 'string',
                        format: 'binary',
                    },
                },
            },
        })
    );
```

#### C. Pagination Helpers
```typescript
// shared/utils/src/lib/swagger/pagination-helpers.ts
export const ApiPaginatedGet = <T extends Type<unknown>>(
    dataDto: T,
    options?: { summary?: string; tags?: string[] }
) =>
    applyDecorators(
        ApiOperation({ summary: options?.summary || 'Get paginated list' }),
        ApiQueries({ pagination: true, search: true, sort: true }),
        ApiOkResponsePaginated(dataDto),
        ApiErrorResponses({
            unauthorized: true,
            forbidden: true,
        })
    );
```

---

## 5️⃣ Implementation Checklist

### ✅ Phase 1: Shared Utilities (Weeks 1-2)
- [ ] Create `shared/utils/src/lib/swagger/` directory
- [ ] Migrate swagger.util.ts
- [ ] Create index files
- [ ] Update package exports
- [ ] Update imports in dashboard-api
- [ ] Add extended utilities (auth, file, pagination)
- [ ] Write unit tests
- [ ] Update shared/utils README

### ✅ Phase 2: Agent Gateway (Weeks 2-3)
- [ ] Add Swagger setup to main.ts
- [ ] Create controller DTOs
- [ ] Document all endpoints
- [ ] Add examples to Swagger
- [ ] Test Swagger UI
- [ ] Update agent-gateway README

### ✅ Phase 3: Agent API (Weeks 3-4)
- [ ] Create ingest DTOs
- [ ] Document ingest endpoints
- [ ] Document gateway control endpoints
- [ ] Add request examples
- [ ] Add response examples
- [ ] Test with gateway integration

### ✅ Phase 4: Dashboard API (Weeks 4-5)
- [ ] Audit all controllers
- [ ] Create missing DTOs
- [ ] Document Organization module
- [ ] Document Department module
- [ ] Document Employee module
- [ ] Document Policy module
- [ ] Document Device module
- [ ] Complete Visitor documentation
- [ ] Add error response examples
- [ ] Test all endpoints

### ✅ Phase 5: Documentation & Testing (Week 5-6)
- [ ] Create Swagger guide (markdown)
- [ ] Write endpoint examples
- [ ] Create integration tests
- [ ] Performance testing Swagger
- [ ] Add CI/CD validation
- [ ] Create developer guide

---

## 6️⃣ Directory Structure – Target

```
shared/utils/src/lib/
├── swagger/                          # 🆕 NEW
│   ├── swagger.util.ts              # Moved from dashboard-api
│   ├── auth-decorators.ts           # 🆕 NEW
│   ├── file-decorators.ts           # 🆕 NEW
│   ├── pagination-helpers.ts        # 🆕 NEW
│   ├── index.ts
│   └── README.md
├── dto/
│   ├── api-response.dto.ts          # Moved
│   ├── pagination.dto.ts            # Moved
│   ├── query.dto.ts                 # Existing
│   ├── swagger/                     # 🆕 NEW
│   │   ├── api-error.dto.ts        # 🆕 NEW
│   │   ├── api-success.dto.ts      # 🆕 NEW (expanded)
│   │   └── index.ts
│   └── index.ts
├── query/
├── validation/
├── interceptors/
├── filters/
├── database/
├── encryption/
├── sanitization/
├── utils.module.ts
└── index.ts (update exports)
```

---

## 7️⃣ Code Examples – Target State

### Example 1: Shared Swagger Usage (Agent Gateway)

```typescript
// apps/agent-gateway/src/modules/collector/collector.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { 
    ApiTags, 
    ApiOperation,
    ApiBearerAuth 
} from '@nestjs/swagger';
import { 
    ApiCrudOperation,
    ApiSecureOperation 
} from '@app/shared/utils';
import { CollectorService } from './collector.service';
import { LogsIngestDto } from './dto/logs-ingest.dto';

@ApiTags('Collector')
@Controller('v1/agent')
export class CollectorController {
    constructor(private collectorService: CollectorService) {}

    @Post('logs')
    @ApiSecureOperation()  // 🆕 Uses shared decorator
    @ApiCrudOperation(LogIngestResponseDto, 'create', {
        body: LogsIngestDto,
        summary: 'Collect logs from C# agent',
    })
    async ingestLogs(@Body() dto: LogsIngestDto) {
        return this.collectorService.processLogs(dto);
    }
}
```

### Example 2: File Upload Documentation

```typescript
// apps/dashboard-api/src/modules/screenshot/screenshot.controller.ts
import { Controller, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { 
    ApiFileUpload,
    ApiCrudOperation 
} from '@app/shared/utils';

@Controller('screenshots')
export class ScreenshotController {
    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    @ApiFileUpload('file')  // 🆕 Uses shared decorator
    @ApiCrudOperation(ScreenshotDto, 'create', {
        summary: 'Upload screenshot'
    })
    async uploadScreenshot(@UploadedFile() file: Express.Multer.File) {
        // Implementation
    }
}
```

---

## 8️⃣ Timeline

| Hafta | Vazifa | Priority | Owner |
|-------|--------|----------|-------|
| W1 | Shared utilities extraction | 🔴 HIGH | Backend Lead |
| W2 | Agent Gateway Swagger | 🔴 HIGH | Gateway Dev |
| W3 | Agent API Documentation | 🔴 HIGH | API Dev |
| W4 | Dashboard API completion | 🟡 MEDIUM | Dashboard Dev |
| W5-6 | Testing + Documentation | 🟡 MEDIUM | QA + Tech Lead |

---

## 9️⃣ Expected Outcomes

### Benefits
✅ **Consistency** – Uniform Swagger documentation across all services
✅ **Reusability** – Shared decorators, DTOs, utilities
✅ **Maintainability** – Single source of truth for API docs
✅ **DX** – Better developer experience (auto-generated docs)
✅ **Testing** – Swagger examples enable easier testing

### Metrics
- 📊 100% endpoint documentation coverage
- 📊 Zero duplicate code in swagger setup
- 📊 Single DTOs for response/error format
- 📊 <5 seconds Swagger page load time

---

## 🔟 Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Breaking changes in imports | High | High | Branch protection + tests |
| Circular dependencies | Medium | Medium | Module structure review |
| Swagger overload (large doc) | Low | Medium | Pagination, grouping |
| Performance on devices | Low | Low | Async generation, caching |

---

## 📝 Next Steps

1. ✅ **Approve** this plan
2. ⏳ **Start Phase 1** – Shared utilities extraction
3. ⏳ **Create feature branch** – `feature/swagger-shared-utils`
4. ⏳ **Set up PR template** – for Swagger coverage validation
5. ⏳ **Document** – Developer guide for using shared decorators

---

**Prepared by:** Technical Lead
**Date:** 2025-10-17
**Status:** Draft – Awaiting Review
