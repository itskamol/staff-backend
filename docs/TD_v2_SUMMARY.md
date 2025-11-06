# Staff Control System v2.0 – Texnik Dizayn Xulasasi

## 📋 Hujjat Ko'rinishi
- **Asosiy fayl:** `TD_v2.md`
- **Muallifi:** Staff Control System jamoasi
- **Versiyasi:** 2.0
- **Sana:** 2025-10-16

---

## 1️⃣ Asosiy Maqsad va Doira

**Maqsad:** v1.0 arxitekturasini korporativ miqyosda barqaror, xavfsiz va kengaytiriladigan v2.0 yechimiga yangilash.

**Asosiy komponentlar:**
- Backend xizmatlar (dashboard-api, agent-api)
- Yangi gateway servisi
- Fayl saqlash abstraksiyasi
- Monitoring va observability
- TimescaleDB integratsiyasi
- Policy va device boshqaruvi
- Ma'lumotlar bazasi RLS (Row Level Security)

---

## 2️⃣ Funksional Talablar

| Talabi | Tavsifi |
|--------|---------|
| **Agent ma'lumotlari xavfsizligi** | Gateway orqali lokal yig'ish → HTTPS batch yetkazish |
| **Real-time status** | WebSocket kanal (Gateway ↔ Main Server) |
| **Policy boshqaruvi** | Policy o'zgarishi agentlarga avtomatik yetkazilishi |
| **Device integratsiyasi** | Plagin asosidagi adapterlari (Hikvision, ZKTeco, custom) |
| **Multi-tenancy xavfsizligi** | PostgreSQL RLS + `organization_id` izolatsiyasi |
| **Monitoring** | Katta dataset uchun metrikalar, tracing, loglarni markazlash |
| **Fayl saqlash** | Screenshot, credential, profil, arxivlarni moslashuvchan storage |
| **Vaqtga bog'liq ma'lumotlar** | ActiveWindow, VisitedSite → TimescaleDB |

---

## 3️⃣ V1.0 Hozirgi Holati

### Arxitektura
```
Nx Monorepo
├── apps/
│   ├── dashboard-api (NestJS v11)
│   ├── agent-api (NestJS v11)
│   └── e2e tests
└── shared/
    ├── auth
    ├── common
    ├── database (Prisma, PostgreSQL)
    ├── repository
    └── utils
```

### Bo'shliqlar (Tiklash zarur)
- ❌ Agent API to'g'ridan-to'g'ri internetga ochiq (xavf)
- ❌ Fayl saqlash lokalga bog'langan (scalability yo'q)
- ❌ Monitoring ma'lumotlari PostgreSQL da (performance masalasi)
- ❌ Tenant izolatsiyasi faqat dasturiy (xavfsiz emas)
- ❌ Minimal observability (metrics, logging)

---

## 4️⃣ V2.0 Taklif etilayotgan Arxitektura

### Komponentlar Diagrammasi

```
┌─────────────────────────────────┐
│      Customer LAN               │
├─────────────────────────────────┤
│ C# Agent → [Agent Gateway]      │
│ Device A  → (NestJS)            │
│ Device B  → Queue/Buffer        │
└────────────────┬────────────────┘
                 │
         HTTPS batch + WebSocket
                 │
        ┌────────▼─────────┐
        │   Agent API      │
        │   (Cloud)        │
        │ - Ingest         │
        │ - Queue mgmt     │
        │ - Policy dist.   │
        └────┬──────┬──────┘
             │      │
        ┌────▼─┐ ┌──▼────┐
        │ PG   │ │TimeDB │
        └──────┘ └───────┘
```

### Asosiy Topologiya

| Qatlam | Texnologiya | Joylashuvi |
|--------|-------------|-----------|
| **Gateway** | NestJS microservice | Mijoz LAN (Raspberry Pi / VM) |
| **Agent API** | NestJS | Cloud (prod) |
| **Dashboard API** | NestJS | Cloud |
| **PostgreSQL** | Managed/AWS RDS | Cloud |
| **TimescaleDB** | Time-series DB | Cloud/Self-hosted |
| **File Storage** | Local (dev) / MinIO S3 (prod) | Cloud |
| **Observability** | LGTM Stack | Cloud |

---

## 5️⃣ Agent Gateway Komponenti

### Funktsiyalari
✅ Device SDKlar bilan muloqot (ISAPI, vendor API)
✅ C# agent ma'lumotlarini qabul qilish
✅ Offline support (SQLite buffer + disk)
✅ Batch qilish va HTTPS POST
✅ WebSocket status kanali
✅ Command execution (policy push, device control)
✅ Audit logging va health check

### Asosiy Modullar
1. **Collector** – device/agent ma'lumot yig'ish
2. **Buffer Manager** – SQLite + disk queue
3. **Uplink** – HTTPS mutual TLS client
4. **Control Channel** – WebSocket client
5. **Command Executor** – policy/restart/device command
6. **Adapter SDKs** – plagin arxitektura

### Offline Aniqlash
- Heartbeat >30s yo'q → offline
- Har agent gatewayga heartbeat → Gateway statusni map qiladi
- Agent API'ga yetkazadi

### Deployment
- Docker image (arm64 + amd64)
- Auto-update mexanizmi
- Failsafe rollback

---

## 6️⃣ Agent API (Cloud)

### Inbound API Endpointlari
- `POST /v2/ingest/logs` – log yig'indisi
- `POST /v2/ingest/screenshots` – screenshot upload
- `POST /v2/ingest/device-events` – device telemetry
- **Xavfsizlik:** JWT + API key, batch max 5MB

### Control Channel Server
- WebSocket `/v2/gateway/socket`
- Access token + rate limit + heartbeat
- Push notifications: PolicyUpdated, CommandAck, RestartAgent

### Queue Management
- `gateway_commands` – komanda queue
- `gateway_status` – health snapshot
- Policy distribution versioning

### Security
- Mutual TLS yoki request signing
- `organization_id` header validation

---

## 7️⃣ Dashboard API

### RLS (Row Level Security)
```sql
-- Request boshida:
SET app.current_organization_id = '<uuid>';
SET app.current_role = 'ADMIN';

-- Policy:
USING (
  current_setting('app.current_role') = 'ADMIN' OR
  organization_id = current_setting('app.current_organization_id')
)
```

### Asosiy Endpointlar
- Device control endpoints
- Policy versioning va change history
- Employee-device sync
- File storage management

---

## 8️⃣ File Storage Layer

### Interface: `IFileStorageService`
```typescript
- upload(path: string, data: Buffer)
- download(path: string)
- delete(path: string)
- list(prefix?: string)
```

### Implementatsiyalar
- **LocalDisk** (dev) – local filesystem
- **MinIO/S3** (prod) – cloud storage

### Retention Siyosati
- `retention_policies` jadvali
- Cron job (archive service)
- Automatic cleanup/archival

---

## 9️⃣ Device Integration Layer

### Adapter Pattern
```typescript
interface IDeviceAdapter {
  connect()
  status(): Promise<DeviceStatus>
  command(cmd: Command)
  fetchLogs(): Promise<Log[]>
}
```

### Vendor Prioriteti (PoC)
1. **Hikvision** (ISAPI)
2. **ZKTeco** (SDK)
3. Custom adapters (future)

### Registry
- `device_adapters` jadvali
- Config-driven activation
- Dynamic loading

---

## 🔟 Observability Stack

### LGTM (Tavsiyalangan)
- **Loki** – Log aggregation
- **Grafana** – Visualization
- **Tempo** – Distributed tracing
- **Prometheus** – Metrics

### Metrikalar
- Request latency
- Queue depth
- DB latency
- Policy distribution time
- Device success rate

---

## 1️⃣1️⃣ Ma'lumotlar Bazasi (Yangi Jadvallar)

| Jadval | Maqsad | Asosiy ustunlar |
|--------|--------|-----------------|
| `gateway_instances` | Gateway ro'yxat | id, organization_id, api_key, status |
| `gateway_status_snapshots` | Health monitoring | gateway_id, cpu, disk, queue_depth |
| `agent_instances` | Agent PC tracking | id, gateway_id, status, policy_version |
| `gateway_commands` | Command queue | id, type, status, retry_count, expires_at |
| `device_commands` | Device control | id, device_id, adapter_type, status |
| `policy_versions` | Version control | id, policy_id, version, checksum, released_at |
| `policy_changes` | Audit trail | id, changed_by, changeset, created_at |
| `retention_policies` | Storage retention | id, resource_type, days, action |

---

## 1️⃣2️⃣ Ma'lumot Oqimlari

### 1. Ingestion Flow
```
Agent → Gateway (HTTP POST /local/agent/logs)
→ Buffer (SQLite)
→ Batch scheduler (30s interval)
→ Agent API /v2/ingest/...
→ PostgreSQL + TimescaleDB
→ Ack response
```

### 2. Policy Update
```
Dashboard UI → Change policy
→ Increase version
→ Agent API queue
→ Gateway WebSocket
→ C# Agents
→ Ack (policy hash)
→ Optional: Agent restart
```

### 3. Device Control
```
Admin → Dashboard API
→ device_commands table
→ WebSocket to Gateway
→ Device adapter execution
→ Status response
→ Telemetry upstream
```

### 4. Online/Offline Monitoring
- Gateway heartbeat (default 30s)
- Agent heartbeat
- Metrics tracking

---

## 1️⃣3️⃣ Migratsiya Rejasi (6 Bosqich)

### 1️⃣ RLS va Storage Abstraksiyasi
- `IFileStorageService` implementatsiyasi
- Prisma service RLS interceptor
- Admin bypass tests

### 3️⃣ Policy & Command Queue
- Jadval yaratish
- Service layer
- Dashboard → Gateway update

### 4️⃣ TimescaleDB Integratsiyasi
- Monitoring jadvallar ko'chirish
- Dual datasource Prisma
- Migration skript

### 5️⃣ Device Adapter Platformasi
- Adapter SDK skeleton
- Hikvision PoC
- Health monitoring

### 6️⃣ Observability Stack
- Prometheus exporters
- Grafana dashboards
- Alerting

---

## 1️⃣4️⃣ Risklar va Mitigatsiya

| Risk | Mitigatsiya |
|------|-------------|
| **Gateway device xilma-xilligi** | Modular adapterlar, vendor pilot |
| **TimescaleDB murakkabligi** | PoC instance, monitoring, fallback |
| **Offline uzun davom** | Buffer size limit + manual export |
| **Security breach** | Mutual TLS, key rotation, audit |
| **Operational overload** | IaC, automation, alerts |

---

## 1️⃣5️⃣ Qarorlar (Asosiy)

✅ **Vendor prioriteti:** Hikvision + ZKTeco birinchi
✅ **Gateway yangilanishi:** Manifest checking + signed packages + failsafe
✅ **Policy restart:** `requires_restart` flag (hot-reload vs full restart)
✅ **Timescale hosting:** Startda self-hosted, keyinchalik managed
✅ **Observability:** LGTM asosiy, ELK nostandart ehtiyojlarda

---

## 🎯 Qisqacha Xulasa

**v2.0 – Asosiy Etiborlar:**
1. ✅ Gateway → offline-first architecture
2. ✅ Multi-tenant security (RLS + izolatsiya)
3. ✅ Scalable device integration (adapter pattern)
4. ✅ Time-series monitoring (TimescaleDB)
5. ✅ Flexible file storage (abstraction layer)
6. ✅ Real-time policy distribution
7. ✅ Comprehensive observability (LGTM)
8. ✅ Enterprise deployment (Docker, IaC)

**Natija:** Uzoq muddatli, scalable, xavfsiz platforma offlayn-ishchi agentlar va murakkab qurilma integratsiyasi uchun.

---

**Tayyorlanish:** 2025-10-17
**Maqsad:** Technical team reference va planning
