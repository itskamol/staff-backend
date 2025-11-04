# 🎯 TD v2.0 – MVP Priority Breakdown

**Maqsad:** Minimal lekin ishlaydigan v2.0 ni tezda deploy qilish  
**Strategiya:** Core features → Production → Incremental improvements

---

## ✅ PHASE 1: CORE MVP (2-3 hafta) – HOZIR QILISH KERAK

### 1.1 Critical Database Schema (3 kun)

#### ✅ HOZIR KERAK (Production uchun zarur):
```sql
-- Gateway registration va status tracking
CREATE TABLE gateway_instances (
    id UUID PRIMARY KEY,
    organization_id INT NOT NULL,
    name VARCHAR(255),
    api_key VARCHAR(255) UNIQUE,
    status VARCHAR(50), -- ONLINE, OFFLINE, ERROR
    last_seen_at TIMESTAMP,
    config JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Real-time gateway health monitoring
CREATE TABLE gateway_status_snapshots (
    id UUID PRIMARY KEY,
    gateway_id UUID REFERENCES gateway_instances(id),
    timestamp TIMESTAMP DEFAULT NOW(),
    cpu_usage DECIMAL(5,2),
    disk_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    queue_depth INT,
    connected_agents INT
);

-- Agent (C# client) tracking
CREATE TABLE agent_instances (
    id UUID PRIMARY KEY,
    gateway_id UUID REFERENCES gateway_instances(id),
    agent_uid VARCHAR(255) UNIQUE,
    hostname VARCHAR(255),
    status VARCHAR(50), -- ONLINE, OFFLINE
    last_seen_at TIMESTAMP,
    policy_id INT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Command queue for gateway operations
CREATE TABLE gateway_commands (
    -- Bu allaqachon mavjud GatewayCommand model
    -- Faqat service layer kerak
);

-- Device control commands
CREATE TABLE device_commands (
    id UUID PRIMARY KEY,
    device_id INT REFERENCES devices(id),
    gateway_id UUID REFERENCES gateway_instances(id),
    command_type VARCHAR(100),
    payload JSONB,
    status VARCHAR(50), -- PENDING, SENT, SUCCESS, FAILED
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
```

**Nega KERAK:**
- Gateway registratsiya qilish uchun
- Agent online/offline ko'rish uchun
- Device commandlarini track qilish uchun
- Production monitoring uchun

---

#### ❌ HOZIR KERAK EMAS (Keyinchalik qo'shish mumkin):

```sql
-- ❌ Policy versioning - Simple approach bilan ishlaydi
CREATE TABLE policy_versions (
    id UUID PRIMARY KEY,
    policy_id INT,
    version INT,
    checksum VARCHAR(64),
    released_at TIMESTAMP
);

-- ❌ Policy change audit - Basic audit log kifoya
CREATE TABLE policy_changes (
    id UUID PRIMARY KEY,
    policy_id INT,
    changed_by INT,
    changeset JSONB,
    created_at TIMESTAMP
);

-- ❌ Retention policies - Manual cleanup yoki simple cron
CREATE TABLE retention_policies (
    id UUID PRIMARY KEY,
    organization_id INT,
    resource_type VARCHAR(100),
    retention_days INT,
    action VARCHAR(50)
);
```

**Nega KERAK EMAS:**
- **policy_versions**: Policy o'zgarganda faqat `updated_at` timestamp yetarli. Versioning keyin qo'shish oson.
- **policy_changes**: Existing `change_histories` table bilan ishlash mumkin.
- **retention_policies**: Simple cron job bilan manual cleanup qilish mumkin. Keyin advanced qilish oson.

---

### 1.2 Gateway Core Features (1 hafta)

#### ✅ HOZIR KERAK (Asosiy funksionallik):

1. **Buffer Manager (SQLite + Memory)**
   ```typescript
   // Simple in-memory queue + SQLite backup
   class SimpleBufferManager {
       private memoryQueue: AgentLog[] = [];
       private sqlite: Database; // faqat persistence uchun
       
       async enqueue(log: AgentLog) {
           this.memoryQueue.push(log);
           if (this.memoryQueue.length > 100) {
               await this.flush(); // batch upload
           }
       }
   }
   ```
   **Nega:** Offline support minimal level uchun yetarli

2. **Uplink Service (HTTPS Batch)**
   ```typescript
   // Simple batch POST
   async uploadBatch(logs: AgentLog[]) {
       await axios.post('/v2/ingest/logs', {
           logs,
           idempotency_token: uuid()
       }, {
           headers: { 'X-API-Key': this.apiKey }
       });
   }
   ```
   **Nega:** Basic data transmission kerak

3. **WebSocket Control Channel**
   ```typescript
   // Allaqachon mavjud! ✅
   // Faqat command handling logic qo'shish kerak
   ```

4. **Health Endpoint**
   ```typescript
   @Get('health')
   getHealth() {
       return {
           status: 'ok',
           queue_depth: this.buffer.getQueueDepth(),
           last_upload: this.uplink.getLastUploadTime()
       };
   }
   ```

---

#### ❌ HOZIR KERAK EMAS:

1. **❌ Complex Retry Logic**
   - Simple retry (3 attempts) yetarli
   - Exponential backoff keyin

2. **❌ Disk-based Queue**
   - SQLite yetarli
   - Redis/File-based queue keyin

3. **❌ Rate Limiting**
   - Simple throttle yetarli
   - Advanced rate limiting keyin

4. **❌ Command Executor Complex Logic**
   - Faqat basic restart command
   - Device control keyin

---

### 1.3 Policy Distribution (Simple) (3 kun)

#### ✅ HOZIR KERAK (Basic Push):

```typescript
// Simple approach: Policy update => WebSocket push
class PolicyService {
    async updatePolicy(policyId: number, changes: any) {
        // 1. Update policy in DB
        await this.prisma.policy.update({ 
            where: { id: policyId }, 
            data: changes 
        });
        
        // 2. Get affected gateways
        const gateways = await this.getGatewaysByPolicy(policyId);
        
        // 3. Push via WebSocket
        for (const gateway of gateways) {
            await this.controlChannel.send(gateway.id, {
                type: 'POLICY_UPDATE',
                policy: await this.getPolicy(policyId)
            });
        }
    }
}
```

**Versioning kerak emas!** Faqat:
- ✅ Policy o'zgardi -> Push qil
- ✅ Gateway qabul qildi -> ACK
- ✅ `updated_at` timestamp track qil

---

#### ❌ HOZIR KERAK EMAS:

1. **❌ Policy Versioning System**
   - Version number (1, 2, 3...) keyin
   - Checksum validation keyin
   - Rollback keyin

2. **❌ Change History Detailed Tracking**
   - Faqat `updated_at` yetarli
   - Detailed changeset keyin

3. **❌ Conflict Resolution**
   - Last-write-wins yetarli
   - Merge logic keyin

---

### 1.4 Device Integration (Minimal) (3 kun)

#### ✅ HOZIR KERAK (1 Adapter PoC):

```typescript
// Faqat 1 ta adapter - Hikvision ISAPI
interface IDeviceAdapter {
    connect(): Promise<void>;
    sendCommand(cmd: string): Promise<any>;
}

class HikvisionAdapter implements IDeviceAdapter {
    async connect() {
        // ISAPI login
    }
    
    async sendCommand(cmd: string) {
        // HTTP request to device
    }
}

// Gateway da:
@Post('device/:id/command')
async sendDeviceCommand(@Param('id') id: string, @Body() cmd: any) {
    const adapter = new HikvisionAdapter(device.config);
    return await adapter.sendCommand(cmd);
}
```

**Nega:** Faqat 1 ta device type bilan PoC ko'rsatish yetarli

---

#### ❌ HOZIR KERAK EMAS:

1. **❌ Device Adapter Registry**
   - Dynamic plugin loading keyin
   - Hardcoded adapter hozir

2. **❌ Multiple Vendors**
   - ZKTeco, Suprema keyin
   - Faqat Hikvision hozir

3. **❌ Device Discovery**
   - Manual registration yetarli
   - Auto-discovery keyin

4. **❌ Device Health Monitoring**
   - Basic status check yetarli
   - Detailed metrics keyin

---

## 🟡 PHASE 2: PRODUCTION READY (2-3 hafta) – KEYINROQ

### 2.1 TimescaleDB (❌ HOZIR KERAK EMAS)

**Alternative approach:**
```sql
-- PostgreSQL da partitioning qil
CREATE TABLE active_windows (
    ...
) PARTITION BY RANGE (datetime);

CREATE TABLE active_windows_2025_10 
    PARTITION OF active_windows 
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

**Nega kerak emas:**
- PostgreSQL partitioning yetarli
- TimescaleDB qo'shish 1 hafta keyin ham mumkin
- Data migration oson

---

### 2.2 Observability (❌ HOZIR KERAK EMAS)

**Simple alternative:**
```typescript
// Basic Winston logging
logger.info('Gateway uploaded batch', {
    gateway_id,
    batch_size,
    duration_ms
});

// Simple metrics endpoint
@Get('metrics')
getMetrics() {
    return {
        total_uploads: this.counter,
        avg_latency_ms: this.avgLatency,
        queue_depth: this.buffer.depth
    };
}
```

**Full stack keyin:**
- Prometheus
- Grafana
- OpenTelemetry
- Loki

---

### 2.3 Security (❌ HOZIR KERAK EMAS)

**Minimal security (yetarli):**
```typescript
// Simple API key
headers: { 'X-API-Key': process.env.GATEWAY_API_KEY }

// Basic rate limiting
@UseGuards(ThrottlerGuard)
@Throttle(100, 60) // 100 req/min
```

**Advanced keyin:**
- Mutual TLS
- Request signing
- Key rotation
- Audit logging

---

## 📊 TIMELINE COMPARISON

### ❌ Full TD v2.0 (Original):
```
Week 1-2:  Database + RLS + Storage ✅ (Done)
Week 3-4:  Gateway + Policy + Device
Week 5-6:  TimescaleDB + Observability
Week 7-8:  Security + Auto-update
---
TOTAL: 8 hafta
```

### ✅ MVP Approach (Recommended):
```
Week 1:    Core Database (gateway, agent, device_commands)
Week 2:    Gateway Buffer + Uplink
Week 3:    Simple Policy Push + 1 Device Adapter
---
TOTAL: 3 hafta MVP ready! 🚀

Then incrementally:
Week 4-5:  TimescaleDB migration
Week 6:    Observability stack
Week 7:    Security hardening
Week 8:    Policy versioning + advanced features
```

---

## 🎯 MVP CHECKLIST – FAQAT HOZIR KERAK

### Database (3 kun):
- [x] ~~RLS + Storage~~ (Already done ✅)
- [ ] `gateway_instances` table
- [ ] `gateway_status_snapshots` table
- [ ] `agent_instances` table
- [ ] `device_commands` table

### Gateway (1 hafta):
- [ ] Simple buffer (memory + SQLite)
- [ ] HTTPS batch upload
- [ ] WebSocket command handler
- [ ] Health endpoint
- [ ] Basic retry logic (3 attempts)

### Policy (3 kun):
- [ ] Simple policy push (no versioning)
- [ ] WebSocket broadcast
- [ ] ACK handling
- [ ] Error logging

### Device (3 kun):
- [ ] `IDeviceAdapter` interface
- [ ] Hikvision ISAPI adapter
- [ ] Basic command endpoint
- [ ] Error handling

### Testing (2 kun):
- [ ] Gateway → Agent API integration test
- [ ] Policy push test
- [ ] Device command test
- [ ] Load test (100 agents)

---

## 🚫 KEYINROQ QO'SHISH (Prodga chiqgandan keyin)

### Phase 2 (Week 4-5):
- [ ] TimescaleDB migration
- [ ] PostgreSQL partitioning
- [ ] Data archival

### Phase 3 (Week 6):
- [ ] Prometheus + Grafana
- [ ] OpenTelemetry
- [ ] Alert rules

### Phase 4 (Week 7):
- [ ] Policy versioning system
- [ ] Detailed change tracking
- [ ] Rollback mechanism

### Phase 5 (Week 8):
- [ ] Multiple device adapters (ZKTeco, Suprema)
- [ ] Device discovery
- [ ] Advanced security (mTLS, signing)

---

## 💡 RECOMMENDED APPROACH

### Option 1: Full Implementation (8 hafta)
```
✅ All features
✅ Production-grade
❌ Slow to market
❌ Over-engineering risk
```

### Option 2: MVP First (3 hafta + iterations) ⭐ RECOMMENDED
```
✅ Fast to production (3 weeks)
✅ Early feedback
✅ Incremental improvements
✅ Less waste
✅ Proven features first
```

---

## 🎯 FINAL RECOMMENDATION

**HOZIR QILING (MVP):**
1. ✅ 4 ta core table (gateway_instances, agent_instances, etc.)
2. ✅ Gateway basic buffer + upload
3. ✅ Simple policy push (no versioning)
4. ✅ 1 device adapter (Hikvision)

**Prodga chiqing va test qiling!**

**KEYIN QILING (Incremental):**
5. ⏳ TimescaleDB (Week 4-5)
6. ⏳ Observability (Week 6)
7. ⏳ Policy versioning (Week 7)
8. ⏳ More adapters + security (Week 8)

---

## 📈 SUCCESS CRITERIA (MVP)

✅ Gateway can register and connect  
✅ Agents can send logs through gateway  
✅ Gateway buffers data when offline  
✅ Policy changes pushed to gateways  
✅ 1 device type controllable (Hikvision)  
✅ System handles 100 concurrent agents  
✅ Basic monitoring via health endpoints  

---

**MVP = Minimum Viable Product, NOT Minimum Value Product!** 🚀

You can always add features later, but you can't launch if you never finish! 

---

**Priority:** 🔴 Core Tables → 🔴 Gateway Buffer → 🟡 Policy Push → 🟢 Everything else

**Timeline:** 3 hafta MVP → Production → +1 hafta per feature

**Risk:** Low (iterative approach, early feedback)
