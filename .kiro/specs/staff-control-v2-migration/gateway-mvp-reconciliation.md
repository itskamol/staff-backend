# Agent Gateway MVP Reconciliation Plan

## Current Situation Analysis

### Missing Services Inventory

#### Uplink Module
- ❌ `retry.service.ts` - Not implemented
- ❌ `idempotency.service.ts` - Not implemented  
- ❌ `uplink-health.service.ts` - Not implemented
- ✅ `uplink.service.ts` - Exists but depends on missing services

#### Control Channel Module
- ❌ `ControlChannelService` - Not implemented
- ❌ `CommandProcessorService` - Not implemented
- ❌ `AcknowledgmentService` - Not implemented
- ❌ `MessageQueueService` - Not implemented
- ✅ `websocket-client.service.ts` - Exists
- ✅ `heartbeat.service.ts` - Exists

#### Command Queue Module
- ❌ `CommandQueueService` - Not implemented
- ❌ `QueueManagementService` - Not implemented
- ❌ `CommandValidationService` - Not implemented
- ❌ `CommandExecutorService` - Not implemented
- ✅ `command-queue-infrastructure.service.ts` - Exists (SQLite queue)

#### Buffer Module
- ✅ `buffer.service.ts` - Exists but API mismatch with tests
- ❌ Methods like `storeRecord()` referenced in tests don't exist

### Database Schema Confusion

Two Prisma setups detected:
1. `shared/database/prisma/` - Old location?
2. `libs/shared/database/prisma/` - New location?

**Issue:** No `schema.prisma` file in either location, only migrations exist.

## MVP Architecture Decision

### Goal
Create a **minimal but functional** gateway that can:
1. ✅ Collect data from agents
2. ✅ Buffer data locally (SQLite)
3. ✅ Upload to cloud API (HTTPS)
4. ✅ Receive basic commands (WebSocket)

### What to KEEP (Phase 1 - Week 1)
- ✅ Buffer management (SQLite)
- ✅ HTTPS uplink to Agent API
- ✅ WebSocket for heartbeat
- ✅ Basic metrics

### What to DEFER (Phase 2 - Week 2+)
- ⏸️ Complex retry logic (use simple retry)
- ⏸️ Idempotency service (initially allow duplicates)
- ⏸️ Command queue infrastructure
- ⏸️ Policy distribution
- ⏸️ Device adapters

## Implementation Plan

### Step 1: Fix Database Schema (Day 1)

**Decision:** Use `libs/shared/database/prisma/` as authoritative location.

**Action:**
```bash
# Create consolidated schema
touch libs/shared/database/prisma/schema.prisma

# Copy existing migrations to correct location
# Remove duplicate shared/database/ directory
```

**Schema Contents:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/client"
}

// Only essential models for MVP
model Organization {
  id        Int      @id @default(autoincrement())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("organizations")
}

model ApiKey {
  id             String   @id @default(uuid())
  keyId          String   @unique
  hashedKey      String
  organizationId Int
  permissions    String
  expiresAt      DateTime
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  lastUsedAt     DateTime?
  
  @@map("api_keys")
}

model Certificate {
  id              String   @id @default(uuid())
  serialNumber    String   @unique
  commonName      String
  organizationId  Int?
  certificatePem  String
  privateKeyPem   String
  publicKeyPem    String
  issuerDn        String
  subjectDn       String
  validFrom       DateTime
  validTo         DateTime
  isActive        Boolean  @default(true)
  isRevoked       Boolean  @default(false)
  createdAt       DateTime @default(now())
  
  @@map("certificates")
}

model RlsAuditLog {
  id             String   @id @default(uuid())
  action         String
  userId         Int?
  organizationId Int?
  resource       String
  policyName     String
  accessGranted  Boolean
  reason         String?
  requestId      String?
  timestamp      DateTime @default(now())
  
  @@map("rls_audit_logs")
}
```

### Step 2: Create Missing Core Services (Day 2-3)

#### 2.1 Simple Retry Service
```typescript
// apps/agent-gateway/src/app/uplink/retry.service.ts
@Injectable()
export class RetryService {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: { maxAttempts: number; baseDelay: number }
  ): Promise<T & { retryCount: number }> {
    let lastError: Error;
    for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
      try {
        const result = await operation();
        return { ...result, retryCount: attempt } as any;
      } catch (error) {
        lastError = error;
        if (attempt < options.maxAttempts - 1) {
          await this.delay(options.baseDelay * Math.pow(2, attempt));
        }
      }
    }
    throw lastError;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### 2.2 Simple Idempotency Service (Optional for MVP)
```typescript
// apps/agent-gateway/src/app/uplink/idempotency.service.ts
@Injectable()
export class IdempotencyService {
  private cache = new Map<string, any>();
  
  async generateKey(endpoint: string, data: any): Promise<string> {
    return createHash('sha256')
      .update(`${endpoint}:${JSON.stringify(data)}`)
      .digest('hex');
  }
  
  async getResponse(key: string): Promise<any> {
    return this.cache.get(key);
  }
  
  async storeResponse(key: string, response: any): Promise<void> {
    this.cache.set(key, response);
    // Simple TTL: remove after 24 hours
    setTimeout(() => this.cache.delete(key), 24 * 60 * 60 * 1000);
  }
}
```

#### 2.3 Message Queue Service
```typescript
// apps/agent-gateway/src/app/control-channel/message-queue.service.ts
@Injectable()
export class MessageQueueService {
  private queue: any[] = [];
  
  enqueue(message: any): void {
    this.queue.push(message);
  }
  
  dequeue(): any {
    return this.queue.shift();
  }
  
  isEmpty(): boolean {
    return this.queue.length === 0;
  }
  
  size(): number {
    return this.queue.length;
  }
}
```

#### 2.4 Acknowledgment Service
```typescript
// apps/agent-gateway/src/app/control-channel/acknowledgment.service.ts
@Injectable()
export class AcknowledgmentService {
  private pending = new Map<string, { timestamp: Date; callback?: Function }>();
  
  registerCommand(commandId: string, callback?: Function): void {
    this.pending.set(commandId, { timestamp: new Date(), callback });
  }
  
  acknowledge(commandId: string, result?: any): void {
    const command = this.pending.get(commandId);
    if (command?.callback) {
      command.callback(result);
    }
    this.pending.delete(commandId);
  }
  
  isPending(commandId: string): boolean {
    return this.pending.has(commandId);
  }
}
```

### Step 3: Simplify Module Dependencies (Day 4)

#### Update UplinkModule
```typescript
// apps/agent-gateway/src/app/uplink/uplink.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UplinkService } from './uplink.service';
import { RetryService } from './retry.service';
import { IdempotencyService } from './idempotency.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
  ],
  providers: [
    UplinkService,
    RetryService,
    IdempotencyService,
  ],
  exports: [UplinkService],
})
export class UplinkModule {}
```

#### Update ControlChannelModule
```typescript
// apps/agent-gateway/src/app/control-channel/control-channel.module.ts
import { Module } from '@nestjs/common';
import { WebSocketClientService } from './websocket-client.service';
import { HeartbeatService } from './heartbeat.service';
import { MessageQueueService } from './message-queue.service';
import { AcknowledgmentService } from './acknowledgment.service';

@Module({
  providers: [
    WebSocketClientService,
    HeartbeatService,
    MessageQueueService,
    AcknowledgmentService,
  ],
  exports: [
    WebSocketClientService,
    HeartbeatService,
  ],
})
export class ControlChannelModule {}
```

#### Update BufferService API
```typescript
// apps/agent-gateway/src/app/buffer/buffer.service.ts
// Add missing methods referenced in tests

async storeRecord(tableName: string, record: any): Promise<void> {
  await this.addToBuffer(tableName, [record]);
}

async getRecords(tableName: string, limit?: number): Promise<any[]> {
  const records = await this.getBufferedRecords(tableName, limit);
  return records.map(r => JSON.parse(r.data));
}
```

### Step 4: Update Tests (Day 5)

Remove or stub complex integration tests that depend on unimplemented features:

```typescript
// apps/agent-gateway/src/app/integration-tests/buffer-integration.spec.ts
describe('BufferService Integration', () => {
  // Keep only essential tests
  it('should store and retrieve records', async () => {
    await bufferService.storeRecord('test_table', { id: 1, data: 'test' });
    const records = await bufferService.getRecords('test_table');
    expect(records).toHaveLength(1);
  });
  
  // Remove tests for features we deferred
  // it.skip('should handle complex retry scenarios', ...)
});
```

### Step 5: MVP Gateway App Module (Day 6)

```typescript
// apps/agent-gateway/src/app/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BufferModule } from './buffer/buffer.module';
import { UplinkModule } from './uplink/uplink.module';
import { ControlChannelModule } from './control-channel/control-channel.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    BufferModule,
    UplinkModule,
    ControlChannelModule,
    HealthModule,
  ],
})
export class AppModule {}
```

## Testing the MVP

### Startup Test
```bash
# Should compile and start without errors
cd apps/agent-gateway
pnpm install
pnpm build
pnpm start

# Expected output:
# ✅ Buffer service initialized
# ✅ Uplink service ready
# ✅ WebSocket client connecting...
# ✅ Health endpoint available at :3000/health
```

### Basic Functionality Test
```bash
# 1. Store data in buffer
curl -X POST http://localhost:3000/buffer/store \
  -H "Content-Type: application/json" \
  -d '{"table": "test", "data": {"value": 123}}'

# 2. Check buffer stats
curl http://localhost:3000/buffer/stats

# 3. Trigger manual upload
curl -X POST http://localhost:3000/uplink/flush

# 4. Check health
curl http://localhost:3000/health
```

## Deferred Features Roadmap

### Phase 2 (Week 2)
- Enhanced retry with exponential backoff
- Redis-based idempotency
- Command queue infrastructure
- Policy distribution basics

### Phase 3 (Week 3)
- Device adapter platform
- Advanced buffering strategies
- Performance optimization
- Comprehensive monitoring

## Migration from Current State

### Cleanup Tasks
1. Remove unused imports from existing modules
2. Comment out failing tests with `// TODO: Implement after Phase 2`
3. Add `.skip` to integration tests that need missing services
4. Create simple mocks for complex dependencies

### File Structure After Cleanup
```
apps/agent-gateway/src/app/
├── buffer/
│   ├── buffer.module.ts ✅
│   ├── buffer.service.ts ✅ (add missing methods)
│   ├── buffer-cleanup.service.ts ✅
│   └── disk-monitoring.service.ts ✅
├── uplink/
│   ├── uplink.module.ts ✅ (updated imports)
│   ├── uplink.service.ts ✅ (simplified)
│   ├── retry.service.ts 🆕 (create simple version)
│   └── idempotency.service.ts 🆕 (create simple version)
├── control-channel/
│   ├── control-channel.module.ts ✅ (updated)
│   ├── websocket-client.service.ts ✅
│   ├── heartbeat.service.ts ✅
│   ├── message-queue.service.ts 🆕 (create)
│   └── acknowledgment.service.ts 🆕 (create)
├── health/
│   └── health.module.ts ✅
└── integration-tests/
    ├── buffer-integration.spec.ts ✅ (simplified)
    └── gateway-integration.spec.ts ⏸️ (defer complex scenarios)
```

## Success Criteria

### MVP Must Have:
- ✅ Gateway starts without errors
- ✅ Accepts data from mock agent
- ✅ Stores data in SQLite buffer
- ✅ Uploads buffered data to cloud API
- ✅ Maintains WebSocket connection for 24 hours
- ✅ Responds to basic health checks
- ✅ Handles graceful shutdown

### Nice to Have (Deferred):
- ⏸️ Complex retry strategies
- ⏸️ Distributed idempotency
- ⏸️ Command queue with priorities
- ⏸️ Policy hot-reload
- ⏸️ Device adapter plugins

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Use libs/shared/database/prisma as authoritative | Nx convention, clearer structure | 2025-10-17 |
| Create simple in-memory services first | Faster MVP, easier to test | 2025-10-17 |
| Defer command queue complexity | Not needed for basic buffering | 2025-10-17 |
| Keep WebSocket for heartbeat only initially | Simplifies control channel | 2025-10-17 |

## Next Steps

**Immediate (Next 2 hours):**
1. Create Prisma schema file
2. Generate Prisma client: `pnpm db:generate`
3. Create 4 missing simple services

**Today (Next 6 hours):**
4. Update module imports
5. Fix BufferService API
6. Simplify integration tests

**Tomorrow:**
7. Test end-to-end flow
8. Document MVP limitations
9. Plan Phase 2 features

---

**Question for Team:**
Do you want to proceed with this MVP approach, or do you prefer to implement all designed services from the start (which will take 2-3 weeks instead of 1 week)?
