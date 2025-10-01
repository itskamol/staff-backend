# Staff Control System - Refactor Plan

**Sana:** 1 Oktyabr 2025  
**Branch:** migration  
**Repository:** itskamol/staff

## 🔍 Hozirgi Holatni Baholash

### ✅ Muvaffaqiyatli amalga oshirilgan:

- **NX Monorepo v21.5.3**: To'liq o'rnatilgan va pnpm bilan sozlangan
- **Agent API**: 95% tugallangan, ishlaydi (port 3001)
- **Dashboard API**: 60-70% tugallangan, asosiy modullar mavjud (port 3000)
- **Database Schema**: Prisma ORM v6.16.2 orqali to'liq implementatsiya
- **Authentication**: JWT + RBAC tizimi (4 role: ADMIN, HR, DEPARTMENT_LEAD, GUARD)
- **Shared Libraries**: 
  - `shared/database` - PrismaService va schema
  - `shared/auth` - JWT service, guards, RBAC
  - `shared/utils` - Common utilities, DTOs, interceptors

### ⚠️ Aniqlangan Muammolar:

#### 1. Code Quality Issues (Jami 222 muammo)

**ESLint Errors (74 error, 74 warning):**
```
shared/database: 2 problems (1 error, 1 warning)
shared/utils: 20 problems (4 errors, 16 warnings) 
shared/auth: 8 problems (8 errors, 0 warnings)
dashboard-api: 148 problems (74 errors, 74 warnings)
agent-api: ESLint config issues
```

**Asosiy muammolar:**
- Import statements alphabetical sorting
- Unused variables va parameters
- `any` types oʻrniga proper types
- Object shorthand syntax
- Console statements in production code

#### 2. Test Configuration Issues

```
agent-api: Jest preset not found
agent-api-e2e: TypeScript config file issues
dashboard-api: UserContext interface mismatches
```

#### 3. Technical Debt

**TODO/FIXME comments topilgan fayllar:**
- `agent-api/src/modules/agent/agent.service.ts`
- `agent-api/src/modules/hikvision/hikvision.service.ts`
- `dashboard-api/src/modules/reports/reports.service.ts`
- `dashboard-api/src/modules/reports/reports.controller.ts`
- `dashboard-api/src/modules/visitor/visitor.service.ts`

## 📋 4 Bosqichli Refactor Plan

### 🎯 **Bosqich 1: Code Quality & Standards (1-2 hafta)**

#### 1.1 ESLint va TypeScript Errors Tuzatish

**Avtomatik tuzatishlar:**
```bash
npx nx run-many --target=lint --all --fix
```

**Manual fixes kerak bo'lgan holatlar:**
- Import sorting alphabetically
- Unused variables (underscore prefix)
- TypeScript strict types
- Property shorthand syntax

**Priority fayllar:**
```
1. shared/database/src/lib/prisma.service.ts - Import sorting
2. shared/auth/src/lib/jwt.service.ts - Object shorthand  
3. dashboard-api/src/modules/reports/ - Multiple issues
4. dashboard-api/src/app/app.module.ts - Unused imports
```

#### 1.2 Jest Configuration Fix

**Agent API config issues:**
```typescript
// apps/agent-api/jest.config.ts
export default {
  preset: '../../jest.preset.js', // Path correction
  testEnvironment: 'node',
  // ... other configs
};
```

**UserContext interface unification:**
```typescript
// Fix shared/auth interface
export interface UserContext {
  sub: number;
  username: string;
  id: number;
  role: Role;
  organizationId: number;
  name?: string;
}
```

#### 1.3 TypeScript Strict Mode Enhancement

```json
// tsconfig.base.json improvements
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### 🏗️ **Bosqich 2: Architecture Optimization (2-3 hafta)**

#### 2.1 Shared Libraries Enhancement

**Database Service Improvements:**
```typescript
// shared/database/src/lib/enhanced-prisma.service.ts
export class EnhancedPrismaService extends PrismaService {
  // Query optimization helpers
  // Transaction management
  // Connection pooling
  // Audit logging
}
```

**Auth Module Standardization:**
```typescript
// shared/auth/src/lib/auth.config.ts
export const authConfig = {
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '1h',
    refreshExpiresIn: '7d'
  },
  rbac: {
    roles: ['ADMIN', 'HR', 'DEPARTMENT_LEAD', 'GUARD'],
    permissions: {
      // Role-based permissions mapping
    }
  }
};
```

#### 2.2 API Response Standardization

**Unified Response Format:**
```typescript
// shared/utils/src/lib/dto/standard-response.dto.ts
export class StandardApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  timestamp: Date;
  path: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

**Global Exception Filter Enhancement:**
```typescript
// Unified error handling across both APIs
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Standardized error responses
    // Logging integration
    // Security filtering
  }
}
```

#### 2.3 Database Optimization

**Missing Indexes:**
```sql
-- Performance optimization
CREATE INDEX idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX idx_computer_user_active ON computer_user(employee_id, is_active);
CREATE INDEX idx_visited_sites_timestamp ON visited_sites(timestamp);
CREATE INDEX idx_active_windows_timestamp ON active_windows(timestamp);
```

### 🎯 **Bosqich 3: Feature Completion (3-4 hafta)**

#### 3.1 Dashboard API - Reports Module (30% incomplete)

**Joriy holat:**
- Basic reports structure mavjud
- Implementation incomplete
- Real-time features missing

**Qo'shilishi kerak:**

```typescript
// Real-time dashboard endpoints
@Controller('reports/realtime')
export class RealtimeReportsController {
  @Get('productivity')
  async getRealtimeProductivity() {
    // Live productivity metrics
  }
  
  @Get('device-status')
  async getDeviceStatus() {
    // HIKVision device monitoring
  }
}
```

**Export functionality:**
```typescript
// reports/export.service.ts
export class ExportService {
  async exportToPDF(reportData: any): Promise<Buffer> {
    // PDF generation using puppeteer
  }
  
  async exportToExcel(reportData: any): Promise<Buffer> {
    // Excel generation using exceljs
  }
}
```

#### 3.2 Agent API - HIKVision Integration Enhancement

**Hozirgi TODO'lar:**
```typescript
// modules/hikvision/hikvision.service.ts
export class HikvisionService {
  // TODO: Real-time event streaming
  // TODO: Face recognition integration  
  // TODO: Device health monitoring
  // TODO: Bulk event processing
}
```

**Yangi features:**
```typescript
@Controller('hikvision')
export class HikvisionController {
  @Post('events/bulk')
  async processBulkEvents(@Body() events: HikVisionEvent[]) {
    // Batch processing optimization
  }
  
  @Get('devices/status')
  async getDeviceStatus() {
    // Real-time device monitoring
  }
  
  @WebSocketGateway()
  async handleRealtimeEvents() {
    // WebSocket for real-time events
  }
}
```

#### 3.3 Computer Monitoring Dashboard

**Agent API dan Dashboard API ga ma'lumot ko'rsatish:**
```typescript
// dashboard-api/modules/monitoring/monitoring.module.ts
@Module({
  // Computer activity visualization
  // Screenshot management
  // Productivity analytics
  // Real-time monitoring dashboard
})
export class MonitoringModule {}
```

**Features:**
- Live employee activity tracking
- Website visit analytics
- Application usage statistics
- Productivity scoring algorithm

#### 3.4 Visitor Management Completion

**Qolgan ishlar:**
- QR code generation optimization
- Bulk visitor import
- Visitor analytics and reports
- Integration with HIKVision entry/exit

### 🚀 **Bosqich 4: Performance & DevOps (2-3 hafta)**

#### 4.1 Performance Optimization

**Caching Strategy:**
```typescript
// shared/cache/redis.service.ts
@Injectable()
export class RedisCacheService {
  // Query result caching
  // Session management  
  // Real-time data caching
  // Cache invalidation strategies
}
```

**Database Query Optimization:**
```typescript
// Database connection pooling
// Query result pagination
// Lazy loading strategies
// Bulk operations optimization
```

#### 4.2 Docker & Deployment Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  agent-api:
    build: 
      context: .
      dockerfile: apps/agent-api/Dockerfile
    ports: ["3001:3001"]
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on: [postgres, redis]
  
  dashboard-api:
    build:
      context: .
      dockerfile: apps/dashboard-api/Dockerfile
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on: [postgres, redis]
    
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: staff_control
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### 4.3 CI/CD Pipeline Setup

```yaml
# .github/workflows/ci.yml
name: Staff Control System CI/CD
on:
  push:
    branches: [main, migration]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
        
      - name: Run linting
        run: npx nx run-many --target=lint --all
        
      - name: Run tests
        run: npx nx run-many --target=test --all
        
      - name: Build applications
        run: npx nx run-many --target=build --all
        
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to staging
        run: echo "Deploy to staging server"
```

## 🎯 Immediate Action Items (Keyingi 1 hafta)

### 1. Critical Fixes

```bash
# 1. ESLint errors automatic fix
npx nx run-many --target=lint --all --fix

# 2. Jest configuration fix
# Fix jest.preset.js paths
# Update tsconfig references

# 3. Agent API eslint config
# Fix missing eslint.config.mjs reference
```

### 2. High Priority Manual Fixes

**shared/database/src/lib/prisma.service.ts:**
```typescript
// Fix import sorting
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
```

**shared/auth/src/lib/jwt.service.ts:**
```typescript
// Fix object shorthand
return {
  sub,
  username,
  // ... other properties
};
```

### 3. Test Configuration Updates

**Fix UserContext interfaces across all test files:**
```typescript
const mockUser: UserContext = {
  sub: 1,
  username: 'testuser',
  id: 1,
  role: Role.ADMIN,
  organizationId: 1,
  name: 'Test User'
};
```

## 📊 Success Metrics va KPIs

### Code Quality Targets

| Metric | Current | Target | Deadline |
|--------|---------|--------|----------|
| ESLint Errors | 82 | 0 | 1 hafta |
| ESLint Warnings | 90 | < 10 | 2 hafta |
| Test Coverage | ~60% | 80% | 3 hafta |
| TypeScript Strict | Partial | Full | 2 hafta |

### Performance Targets

| Metric | Current | Target | Deadline |
|--------|---------|--------|----------|
| API Response Time | ~300ms | < 200ms | 4 hafta |
| Database Query Optimization | Basic | Advanced | 3 hafta |
| Memory Usage | Unknown | Monitored | 4 hafta |
| Docker Build Time | Unknown | < 5min | 4 hafta |

### Feature Completion

| Module | Current | Target | Deadline |
|--------|---------|--------|----------|
| Agent API | 95% | 100% | 2 hafta |
| Dashboard API Core | 70% | 100% | 3 hafta |
| Reports Module | 40% | 100% | 4 hafta |
| HIKVision Integration | 80% | 100% | 3 hafta |
| Monitoring Dashboard | 30% | 100% | 4 hafta |

## 🔧 Development Tools va Commands

### Daily Development

```bash
# Code quality check
npx nx run-many --target=lint --all
npx nx run-many --target=test --all

# Development servers
npx nx run agent-api:serve
npx nx run dashboard-api:serve

# Database operations
npx prisma studio
npx prisma db push
npx prisma migrate dev
```

### Build and Deploy

```bash
# Production builds
npx nx run-many --target=build --all

# Docker operations
docker-compose up -d
docker-compose logs -f agent-api
docker-compose logs -f dashboard-api
```

### Monitoring and Debugging

```bash
# Performance monitoring
npx nx run dashboard-api:serve --verbose
npx nx run agent-api:serve --verbose

# Database debugging
npx prisma db seed
npx prisma db reset
```

## 📅 Timeline va Milestones

### Week 1 (Oktabr 1-7)
- [ ] ESLint errors fix (automatic + manual)
- [ ] Jest configuration repair
- [ ] TypeScript strict mode setup
- [ ] Agent API configuration issues

### Week 2 (Oktabr 8-14)
- [ ] Shared libraries enhancement
- [ ] API response standardization
- [ ] Database indexes optimization
- [ ] Test coverage improvement

### Week 3 (Oktabr 15-21)
- [ ] Reports module completion
- [ ] HIKVision integration enhancement
- [ ] Computer monitoring dashboard
- [ ] Performance optimization start

### Week 4 (Oktabr 22-28)
- [ ] Docker setup completion
- [ ] CI/CD pipeline implementation
- [ ] Performance testing
- [ ] Documentation update

### Week 5+ (Oktabr 29+)
- [ ] Production deployment preparation
- [ ] Security audit
- [ ] Load testing
- [ ] Final optimization

## 🎯 Keyingi Qadamlar

1. **Darhol boshlash:** ESLint errors fix
2. **Test qilish:** Har bir fix dan keyin test run
3. **Commit strategy:** Har bosqich uchun alohida commits
4. **Code review:** Har katta o'zgarish uchun review
5. **Documentation:** Har yangi feature uchun docs update

**Qaysi bosqichdan boshlaymiz?** 

Tavsiya: Bosqich 1.1 dan boshlash - ESLint errors fix, chunki bu boshqa ishlarni osonlashtiradi.