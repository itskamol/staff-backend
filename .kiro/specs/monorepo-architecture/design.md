# Design Document

## Overview

Staff Control System loyihasini **NestJS NX monorepo** arxitekturasiga o'tkazish
uchun **ikki asosiy backend service**ga bo'lamiz: **Agent API** (C# agentlar va
HIKVision qurilmalari uchun) va **Dashboard API** (asosiy business logic va
RBAC). Bu arxitektura scalability, maintainability va deployment flexibility ni
ta'minlaydi.

**Loyiha maqsadi:**

- HIKVision qurilmalari orqali hodimlarning kirish/chiqish nazorati
- C# Agent dastur orqali kompyuter faoliyati monitoring
- Mehmonlar nazorati va bir martalik kodlar
- Role-based access control (Admin, HR, Department Lead, Guard)
- Samaradorlik tahlili va hisobotlar

### Technology Stack

- **Framework:** NestJS v10+ (with NX workspace)
- **Database:** PostgreSQL 15+ + Prisma ORM v5+
- **Authentication:** JWT + Passport + **RBAC only**
- **Cache:** Redis 7+
- **Queue System:** BullMQ
- **Logging:** Winston
- **API Documentation:** Swagger/OpenAPI
- **Package Manager:** pnpm
- **Language:** TypeScript
- **Monorepo Tool:** NX
- **External Integrations:** HIKVision SDK/API, C# Windows Service Agent

## Architecture

### NX Monorepo Structure

```
app/
├── apps/
│   ├── agent-api/          # Agent ma'lumotlarini qabul qiluvchi API
│   └── dashboard-api/      # Asosiy business logic API
├── libs/
│   ├── shared/
│   │   ├── database/       # Prisma client va models
│   │   ├── types/          # Common TypeScript types
│   │   ├── constants/      # Doimiy qiymatlar
│   │   └── utils/          # Yordamchi funksiyalar
│   └── common/
│       ├── auth/           # Authentication utilities
│       ├── guards/         # NestJS guards
│       └── interceptors/   # NestJS interceptors
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Migration files
├── nx.json                 # NX configuration
├── workspace.json          # Workspace configuration
├── pnpm-workspace.yaml     # pnpm workspace
├── docker-compose.yml      # Development environment
└── README.md
```

### Service Architecture

```mermaid
graph TB
    subgraph "External Sources"
        A[Computer Agents]
        B[Hikvision Devices]
    end

    subgraph "NX Monorepo"
        subgraph "Agent API (apps/agent-api)"
            C[Agent Controller]
            D[Hikvision Controller]
            E[Data Processing Service]
        end

        subgraph "Dashboard API (apps/dashboard-api)"
            F[User Management]
            G[Policy Management]
            H[Reports & Analytics]
            O[Device Management]
        end

        subgraph "Shared Libraries (libs/)"
            I[Common Types]
            J[Prisma Database]
            K[Auth Guards]
            P[RBAC Utils]
        end
    end

    subgraph "Infrastructure"
        L[(PostgreSQL + Prisma)]
        M[Redis Cache]
        N[File Storage]
    end

    A --> C
    B --> D
    C --> E
    D --> E
    E --> L
    F --> L
    G --> L
    H --> L
    E --> M
    F --> M
    G --> M
    H --> M

    C --> I
    D --> I
    F --> I
    G --> I
    H --> I

    E --> J
    F --> J
    G --> J
    H --> J
```

## Components and Interfaces

### Agent API Components

#### 1. Computer Agent Controller

**Maqsad:** Hodim kompyuterlaridan keladigan monitoring ma'lumotlarini qabul
qilish

**Endpoints:**

- `POST /api/agent/active-windows` - Faol oynalar ma'lumoti
- `POST /api/agent/visited-sites` - Tashrif buyurilgan saytlar
- `POST /api/agent/screenshots` - Skrinshot ma'lumotlari
- `POST /api/agent/user-sessions` - Foydalanuvchi sessiyalari

**Input Format:**

```typescript
interface AgentDataPayload {
  computerUid: string;
  userSid: string;
  timestamp: Date;
  data: ActiveWindowData | VisitedSiteData | ScreenshotData | UserSessionData;
}
```

#### 2. HIKVision Controller

**Maqsad:** HIKVision kirish nazorati qurilmalaridan ma'lumot qabul qilish

**Endpoints:**

- `POST /api/agent/hikvision/actions` - Kirish/chiqish harakatlari
- `POST /api/agent/hikvision/events` - Qurilma hodisalari
- `POST /api/agent/hikvision/device-status` - Qurilma holati

**Input Format:**

```typescript
interface HikvisionActionPayload {
  deviceId: number;
  gateId?: number;
  employeeId?: number;
  visitorId?: number;
  actionType: ActionType; // PHOTO, CARD, CAR, QR, PERSONAL_CODE, ONE_TIME_ID
  entryType: EntryType; // ENTER, EXIT, BOTH
  visitorType: VisitorType; // EMPLOYEE, VISITOR
  actionMode: ActionMode; // ONLINE, OFFLINE
  actionTime: Date;
  actionResult: string;
}
```

#### 3. Data Processing Service

**Maqsad:** Keladigan ma'lumotlarni qayta ishlash va saqlash

**Funksiyalar:**

- Ma'lumotlarni validatsiya qilish
- Computer va User ma'lumotlarini bog'lash
- Real-time processing
- Queue orqali batch processing

### Dashboard API Components

#### 1. User Management Module

**Maqsad:** Foydalanuvchi, tashkilot va bo'limlarni boshqarish (Role-based
access)

**Endpoints:**

- `GET/POST/PUT/DELETE /api/users` - [Admin only]
- `GET/POST/PUT/DELETE /api/organizations` - [Admin, HR-own]
- `GET/POST/PUT/DELETE /api/departments` - [Admin, HR-own org, Lead-own dept]
- `GET/POST/PUT/DELETE /api/employees` - [Admin, HR-own org, Lead-own dept,
  Guard-basic]
- `POST /api/employees/:id/assign-card` - [Admin, HR-own org]
- `POST /api/employees/:id/link-computer-user` - [Admin, HR-own org]

#### 2. Policy Management Module

**Maqsad:** Monitoring siyosatlarini boshqarish

**Endpoints:**

- `GET/POST/PUT/DELETE /api/policies` - [Admin, HR-own org]
- `GET/POST/PUT/DELETE /api/website-groups` - [Admin, HR-own org]
- `GET/POST/PUT/DELETE /api/app-groups` - [Admin, HR-own org]
- `GET/POST/PUT/DELETE /api/screenshot-options` - [Admin, HR-own org]
- `GET/POST/PUT/DELETE /api/visited-sites-options` - [Admin, HR-own org]
- `GET/POST/PUT/DELETE /api/active-windows-options` - [Admin, HR-own org]

#### 3. Reports & Analytics Module

**Maqsad:** Hisobot va tahlil ma'lumotlarini taqdim etish (Role-based filtered)

**Endpoints:**

- `GET /api/reports/attendance` - [Admin, HR-own org, Lead-own dept, Guard]
- `GET /api/reports/productivity` - [Admin, HR-own org, Lead-own dept]
- `GET /api/reports/device-usage` - [Admin only]
- `GET /api/reports/visitor-logs` - [Admin, HR-own org, Lead-own dept, Guard]
- `POST /api/reports/custom` - [Admin, HR-own org, Lead-own dept]
- `GET /api/entry-logs` - [Admin, HR-filtered, Lead-filtered, Guard]
- `GET /api/monitoring/employee/:id/activity` - [Admin, HR-own org, Lead-own
  dept]

#### 4. Visitor Management Module

**Maqsad:** Mehmonlar va bir martalik kodlarni boshqarish

**Endpoints:**

- `GET/POST/PUT/DELETE /api/visitors` - [Admin, HR-own org, Lead-own dept,
  Guard-basic]
- `POST /api/visitors/:id/generate-code` - [Admin, HR-own org]
- `GET /api/visitors/:id/entry-logs` - [Admin, HR-own org, Lead-own dept, Guard]
- `GET/POST/PUT/DELETE /api/onetime-codes` - [Admin, HR-own org]

#### 5. Device Management Module

**Maqsad:** HIKVision qurilmalarini boshqarish

**Endpoints:**

- `GET/POST/PUT/DELETE /api/devices` - [Admin only, Guard-status]
- `GET/POST/PUT/DELETE /api/gates` - [Admin only]
- `POST /api/devices/:id/test-connection` - [Admin only]

### Shared Package Components

#### 1. Common Types

```typescript
// Database model types
export * from './types/database.types';
export * from './types/api.types';
export * from './types/monitoring.types';

// Enums
export * from './enums/action-type.enum';
export * from './enums/session-type.enum';
```

#### 2. Prisma Database

```typescript
// Prisma service (libs/shared/database)
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}

// Repository pattern with Prisma
export abstract class BaseRepository<T> {
  constructor(protected prisma: PrismaService) {}

  // CRUD operatsiyalari with Prisma
  abstract findMany(args?: any): Promise<T[]>;
  abstract findUnique(args: any): Promise<T | null>;
  abstract create(data: any): Promise<T>;
  abstract update(args: any): Promise<T>;
  abstract delete(args: any): Promise<T>;
}
```

#### 3. Utilities

```typescript
// Validation utilities
export class ValidationUtil {
  static validateAgentData(data: any): boolean;
  static validateHikvisionData(data: any): boolean;
}

// Encryption utilities
export class EncryptionUtil {
  static encrypt(data: string): string;
  static decrypt(data: string): string;
}
```

## Data Models

### Agent API Data Flow

```mermaid
sequenceDiagram
    participant CA as Computer Agent
    participant AA as Agent API
    participant DB as Database
    participant Q as Queue

    CA->>AA: POST /api/agent/active-windows
    AA->>AA: Validate payload
    AA->>DB: Find/Create Computer & User
    AA->>Q: Add to processing queue
    AA->>CA: 200 OK
    Q->>DB: Process and save data
```

### Dashboard API Data Flow

```mermaid
sequenceDiagram
    participant UI as Dashboard UI
    participant DA as Dashboard API
    participant DB as Database
    participant Cache as Redis Cache

    UI->>DA: GET /api/reports/activity
    DA->>Cache: Check cache
    alt Cache hit
        Cache->>DA: Return cached data
    else Cache miss
        DA->>DB: Query database
        DB->>DA: Return data
        DA->>Cache: Cache result
    end
    DA->>UI: Return response
```

## Error Handling

### Agent API Error Handling

```typescript
export class AgentErrorHandler {
  static handleValidationError(error: ValidationError): ApiResponse {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: error.message,
      timestamp: new Date(),
    };
  }

  static handleDatabaseError(error: DatabaseError): ApiResponse {
    // Log error and return generic message
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: "Ma'lumot saqlashda xatolik yuz berdi",
      timestamp: new Date(),
    };
  }
}
```

### Dashboard API Error Handling

```typescript
export class DashboardErrorHandler {
  static handleAuthError(error: AuthError): ApiResponse {
    return {
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Avtorizatsiya talab qilinadi',
      timestamp: new Date(),
    };
  }

  static handleNotFoundError(resource: string): ApiResponse {
    return {
      success: false,
      error: 'NOT_FOUND',
      message: `${resource} topilmadi`,
      timestamp: new Date(),
    };
  }
}
```

## Testing Strategy

### Unit Testing

- Har bir service va controller uchun unit testlar
- Mock dependencies ishlatish
- Jest testing framework

### Integration Testing

- API endpoint larni test qilish
- Database bilan integratsiya testlari
- Queue processing testlari

### End-to-End Testing

- Agent ma'lumot yuborish va saqlash jarayoni
- Dashboard API orqali ma'lumot olish
- Authentication va authorization

### Performance Testing

- Load testing for Agent API endpoints
- Database query performance
- Cache effectiveness

## Deployment Strategy

### Development Environment

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  agent-api:
    build: ./apps/agent-api
    ports:
      - '3001:3000'
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:password@postgres:5432/staff_control

  dashboard-api:
    build: ./apps/dashboard-api
    ports:
      - '3002:3000'
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:password@postgres:5432/staff_control

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: staff_control
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password

  redis:
    image: redis:7-alpine
```

### Production Deployment

- Docker containers
- Kubernetes orchestration
- Load balancer
- Database clustering
- Redis clustering

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          pnpm install
          pnpm test

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker images
        run: |
          nx build agent-api
          nx build dashboard-api
          docker build -t agent-api ./apps/agent-api
          docker build -t dashboard-api ./apps/dashboard-api
      - name: Deploy to production
        run: |
          # Deployment commands
```

## Security Considerations

### Agent API Security

- API key authentication for C# agents and HIKVision devices
- Rate limiting per agent/device
- Input validation and sanitization
- HTTPS only communication
- Computer/User SID validation
- Device ID validation

### Dashboard API Security

- JWT token authentication (15 min access, 7 day refresh)
- **RBAC only system**: Admin, HR, Department Lead, Guard
- Data scoping per organization/department
- NestJS Guards with Prisma-based permission checks
- CORS configuration
- Password hashing with bcrypt
- Prisma-based role and permission queries

### Data Security

- Encryption at rest
- Encryption in transit
- Sensitive data masking in logs
- Regular security audits

## Monitoring and Logging

### Application Monitoring

- Health check endpoints
- Metrics collection (Prometheus)
- Performance monitoring
- Error tracking

### Logging Strategy

```typescript
export class LoggerService {
  static logAgentData(data: AgentDataPayload): void {
    logger.info('Agent data received', {
      computerUid: data.computerUid,
      dataType: data.data.type,
      timestamp: data.timestamp,
    });
  }

  static logError(error: Error, context: string): void {
    logger.error('Application error', {
      error: error.message,
      stack: error.stack,
      context,
    });
  }
}
```

### Alerting

- Database connection failures
- High error rates
- Performance degradation
- Security incidents

## Migration Strategy

### Current State Analysis

**Hozirgi loyiha holati:**

- Single NestJS application (src/ struktura)
- Prisma ORM v6.14 + PostgreSQL database
- Modules: auth, user, organization, department, employee
- Core services: config, database, logger, cache, queue
- Shared components: guards, interceptors, filters, dto, decorators
- Working Docker setup with docker-compose.yml

### Migration Phases

#### Phase 1: NX Workspace Setup (1-2 kun)

**Maqsad:** NX monorepo yaratish va basic structure o'rnatish

**Steps:**

1. **NX workspace yaratish:**

   ```bash
   npx create-nx-workspace@latest app \
     --preset=nest \
     --package-manager=pnpm \
     --nx-cloud=false
   ```

2. **Dashboard API application yaratish:**

   ```bash
   nx g @nx/nest:app dashboard-api --port=3000
   ```

3. **Agent API application yaratish:**

   ```bash
   nx g @nx/nest:app agent-api --port=3001
   ```

4. **Shared libraries yaratish:**
   ```bash
   nx g @nx/nest:lib shared/database
   nx g @nx/nest:lib shared/auth
   nx g @nx/nest:lib shared/utils
   nx g @nx/nest:lib shared/types
   ```

#### Phase 2: Database Layer Migration (2-3 kun)

**Maqsad:** Prisma schema va database servicelarni shared library ga ko'chirish

**Steps:**

1. **Prisma schema ko'chirish:**

   ```bash
   # Existing: prisma/schema.prisma
   # New: libs/shared/database/prisma/schema.prisma
   cp prisma/schema.prisma libs/shared/database/prisma/
   cp -r prisma/migrations/ libs/shared/database/prisma/
   cp prisma/seed.ts libs/shared/database/prisma/
   ```

2. **PrismaService shared qilish:**

   ```typescript
   // libs/shared/database/src/lib/prisma.service.ts
   import { Injectable, OnModuleInit } from '@nestjs/common';
   import { PrismaClient } from '@prisma/client';

   @Injectable()
   export class PrismaService extends PrismaClient implements OnModuleInit {
     async onModuleInit() {
       await this.$connect();
     }
   }
   ```

3. **Database module yaratish:**

   ```typescript
   // libs/shared/database/src/lib/database.module.ts
   import { Global, Module } from '@nestjs/common';
   import { PrismaService } from './prisma.service';

   @Global()
   @Module({
     providers: [PrismaService],
     exports: [PrismaService],
   })
   export class SharedDatabaseModule {}
   ```

#### Phase 3: Auth System Migration (2-3 kun)

**Maqsad:** Authentication va authorization systemni shared library ga
ko'chirish

**Steps:**

1. **Auth guards ko'chirish:**

   ```bash
   # Existing: src/shared/guards/
   # New: libs/shared/auth/src/lib/guards/
   cp -r src/shared/guards/* libs/shared/auth/src/lib/guards/
   ```

2. **JWT service ko'chirish:**

   ```bash
   # Existing: src/modules/auth/jwt.service.ts
   # New: libs/shared/auth/src/lib/jwt.service.ts
   cp src/modules/auth/jwt.service.ts libs/shared/auth/src/lib/
   ```

3. **RBAC decorators ko'chirish:**
   ```bash
   # Existing: src/shared/decorators/roles.decorator.ts
   # New: libs/shared/auth/src/lib/decorators/
   cp src/shared/decorators/roles.decorator.ts libs/shared/auth/src/lib/decorators/
   ```

#### Phase 4: Dashboard API Migration (3-4 kun)

**Maqsad:** Existing modullarni Dashboard API ga ko'chirish

**Steps:**

1. **Core modules ko'chirish:**

   ```bash
   # User management
   cp -r src/modules/auth/* apps/dashboard-api/src/modules/auth/
   cp -r src/modules/user/* apps/dashboard-api/src/modules/user/
   cp -r src/modules/organization/* apps/dashboard-api/src/modules/organization/
   cp -r src/modules/department/* apps/dashboard-api/src/modules/department/
   cp -r src/modules/employee/* apps/dashboard-api/src/modules/employee/
   ```

2. **Core services ko'chirish:**

   ```bash
   # Config, Logger, Cache services
   cp -r src/core/* apps/dashboard-api/src/core/
   ```

3. **Shared components ko'chirish:**
   ```bash
   # DTOs, Filters, Interceptors
   cp -r src/shared/dto/* libs/shared/utils/src/lib/dto/
   cp -r src/shared/filters/* libs/shared/utils/src/lib/filters/
   cp -r src/shared/interceptors/* libs/shared/utils/src/lib/interceptors/
   ```

#### Phase 5: Agent API Development (3-4 kun)

**Maqsad:** Agent API yaratish va C# agent endpoints

**Steps:**

1. **Agent controllers yaratish:**

   ```typescript
   // apps/agent-api/src/modules/agent/agent.controller.ts
   @Controller('agent')
   export class AgentController {
     @Post('active-windows')
     async receiveActiveWindows(@Body() payload: AgentDataPayload) {}

     @Post('visited-sites')
     async receiveVisitedSites(@Body() payload: AgentDataPayload) {}

     @Post('screenshots')
     async receiveScreenshots(@Body() payload: AgentDataPayload) {}
   }
   ```

2. **HIKVision controller yaratish:**
   ```typescript
   // apps/agent-api/src/modules/hikvision/hikvision.controller.ts
   @Controller('agent/hikvision')
   export class HikvisionController {
     @Post('actions')
     async receiveActions(@Body() payload: HikvisionActionPayload) {}
   }
   ```

#### Phase 6: Configuration Migration (1-2 kun)

**Maqsad:** Docker va environment configuration yangilash

**Steps:**

1. **Docker configuration yangilash:**

   ```yaml
   # docker-compose.yml
   version: '3.8'
   services:
     dashboard-api:
       build: ./apps/dashboard-api
       ports:
         - '3000:3000'
       environment:
         - DATABASE_URL=${DATABASE_URL}

     agent-api:
       build: ./apps/agent-api
       ports:
         - '3001:3000'
       environment:
         - DATABASE_URL=${DATABASE_URL}
   ```

2. **Package.json scripts yangilash:**
   ```json
   {
     "scripts": {
       "start:dashboard": "nx serve dashboard-api",
       "start:agent": "nx serve agent-api",
       "start:dev": "nx run-many --target=serve --projects=dashboard-api,agent-api --parallel",
       "build:all": "nx run-many --target=build --projects=dashboard-api,agent-api",
       "test:all": "nx run-many --target=test --projects=dashboard-api,agent-api"
     }
   }
   ```

#### Phase 7: Testing & Validation (2-3 kun)

**Maqsad:** Migration testlari va validation

**Steps:**

1. **Unit testlarni ko'chirish va yangilash**
2. **Integration testlar yaratish**
3. **API endpoints testlari**
4. **Database connectivity testlari**
5. **Parallel testing (eski vs yangi system)**

### Migration Checklist

#### Pre-Migration

- [ ] Existing system full backup
- [ ] Database backup
- [ ] Environment variables documentation
- [ ] Dependencies audit
- [ ] Performance baseline metrics

#### During Migration

- [ ] NX workspace setup completed
- [ ] Shared libraries created and configured
- [ ] Database layer migrated successfully
- [ ] Auth system migrated and tested
- [ ] Dashboard API modules migrated
- [ ] Agent API developed and tested
- [ ] Docker configuration updated
- [ ] All tests passing

#### Post-Migration

- [ ] Performance comparison completed
- [ ] Security audit passed
- [ ] Documentation updated
- [ ] Team training completed
- [ ] Rollback plan documented
- [ ] Production deployment strategy defined

### Rollback Strategy

**Agar migration muvaffaqiyatsiz bo'lsa:**

1. **Git revert** - O'zgarishlarni bekor qilish
2. **Database restore** - Backup dan qayta tiklash
3. **Docker rollback** - Eski container image ishlatish
4. **DNS switch** - Traffic ni eski service ga yo'naltirish

### Risk Mitigation

**Potensial xavflar va yechimlar:**

1. **Data loss risk** → Database backup + transaction rollback
2. **Downtime risk** → Blue-green deployment strategy
3. **Performance degradation** → Load testing + optimization
4. **Integration failures** → Comprehensive integration tests
5. **Team productivity loss** → Gradual migration + training

### Success Metrics

**Migration muvaffaqiyatini baholash:**

- **Functional:** Barcha API endpoints ishlaydi
- **Performance:** Response time 95th percentile < 200ms
- **Reliability:** Uptime > 99.9%
- **Security:** Barcha auth/authz testlari o'tadi
- **Maintainability:** Code coverage > 80%
