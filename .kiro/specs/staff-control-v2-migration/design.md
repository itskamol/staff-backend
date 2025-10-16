# Staff Control System v2.0 Migration Design Document

## Overview

Bu design document Staff Control System ni v1.0 dan v2.0 ga migratsiya qilish uchun comprehensive arxitektura va implementation strategiyasini belgilaydi. Migratsiya asosiy maqsadi - korporativ miqyosda barqaror, xavfsiz va kengaytiriladigan yechim yaratish, yangi Agent Gateway servisi, TimescaleDB integratsiyasi, PostgreSQL RLS, device adapter platformasi va observability stack bilan.

### Migration Scope

- **Current State (v1.0):** Monorepo NestJS application, Prisma + PostgreSQL, to'g'ridan-to'g'ri agent API
- **Target State (v2.0):** Agent Gateway + Cloud APIs, TimescaleDB, RLS, File Storage abstraction, Device adapters, LGTM observability

### Key Design Principles

1. **Minimal Downtime:** Bosqichma-bosqich migratsiya 4 soat ichida, har bir phase uchun 15 daqiqalik rollback capability
2. **Backward Compatibility:** Mavjud API endpoint lar saqlanadi, performance 20% yaxshiroq
3. **Security First:** RLS audit logging, mutual TLS, API key rotation, PII scrubbing
4. **Scalability:** Horizontal scaling, queue-based processing, configurable buffer management
5. **Observability:** Full monitoring va alerting stack, dependency health tracking
6. **Reliability:** Exponential backoff retry logic, failure isolation, comprehensive testing (85% coverage)
7. **Operational Excellence:** Automated rollback triggers, phase exit criteria, 24/7 support

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Customer LAN"
        CA[C# Agents]
        HD[Hikvision Devices]
        ZD[ZKTeco Devices]
        AG[Agent Gateway<br/>NestJS + SQLite]
        
        CA -->|HTTP/gRPC| AG
        HD -->|ISAPI| AG
        ZD -->|SDK| AG
    end
    
    subgraph "Cloud Infrastructure"
        subgraph "API Layer"
            AAP[Agent API<br/>Port 3001]
            DAP[Dashboard API<br/>Port 3000]
        end
        
        subgraph "Data Layer"
            PG[(PostgreSQL<br/>+ RLS)]
            TS[(TimescaleDB<br/>Time-series)]
            FS[File Storage<br/>MinIO/S3]
        end
        
        subgraph "Observability"
            PR[Prometheus]
            GR[Grafana]
            LK[Loki]
            TP[Tempo]
        end
    end
    
    AG -->|HTTPS Batch| AAP
    AG <-->|WebSocket Control| AAP
    
    AAP --> PG
    AAP --> TS
    AAP --> FS
    
    DAP --> PG
    DAP --> TS
    DAP --> FS
    
    AAP --> PR
    DAP --> PR
    AG --> PR
    
    PR --> GR
    LK --> GR
    TP --> GR
```

### Component Architecture

#### Agent Gateway (Customer LAN)

**Technology Stack:**
- NestJS microservice
- SQLite buffer storage
- Docker deployment (arm64/amd64)
- WebSocket client
- Device adapter plugins

**Core Modules:**

```typescript
// Agent Gateway Module Structure
apps/agent-gateway/
├── src/
│   ├── modules/
│   │   ├── collector/          # Data collection from agents/devices
│   │   ├── buffer/             # SQLite + disk buffer management
│   │   ├── uplink/             # HTTPS client to Agent API
│   │   ├── control/            # WebSocket control channel
│   │   ├── executor/           # Command execution (policy, restart)
│   │   └── adapters/           # Device adapter registry
│   ├── adapters/
│   │   ├── hikvision/          # ISAPI implementation
│   │   ├── zkteco/             # ZKTeco SDK wrapper
│   │   └── base/               # IDeviceAdapter interface
│   └── config/
│       ├── gateway.config.ts   # Gateway configuration
│       └── adapters.config.ts  # Adapter configurations
```

**Buffer Management:**

```sql
-- SQLite buffer schema
CREATE TABLE agent_data_buffer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'active_window', 'visited_site', 'screenshot'
    payload TEXT NOT NULL, -- JSON payload
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploaded_at DATETIME NULL,
    retry_count INTEGER DEFAULT 0
);

CREATE TABLE device_data_buffer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    adapter_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploaded_at DATETIME NULL,
    retry_count INTEGER DEFAULT 0
);
```

#### Agent API (Cloud)

**Responsibilities:**
- Gateway ma'lumotlarini qabul qilish va processing
- WebSocket control channel server
- Policy distribution
- Command queue management
- TimescaleDB/PostgreSQL ga yozish

**API Endpoints:**

```typescript
// Agent API endpoints
@Controller('v2')
export class AgentApiController {
  // Batch ingestion endpoints
  @Post('ingest/logs')
  async ingestLogs(@Body() batch: AgentLogBatch) {}
  
  @Post('ingest/screenshots') 
  async ingestScreenshots(@Body() batch: ScreenshotBatch) {}
  
  @Post('ingest/device-events')
  async ingestDeviceEvents(@Body() batch: DeviceEventBatch) {}
  
  // Gateway management
  @Get('gateway/policies/:id')
  async getPolicy(@Param('id') gatewayId: string) {}
  
  @Get('gateway/update-manifest')
  async getUpdateManifest() {}
}

@WebSocketGateway({ path: '/v2/gateway/socket' })
export class GatewayControlGateway {
  @SubscribeMessage('heartbeat')
  handleHeartbeat(@MessageBody() data: HeartbeatData) {}
  
  @SubscribeMessage('command_ack')
  handleCommandAck(@MessageBody() data: CommandAckData) {}
}
```

#### Dashboard API (Cloud)

**Enhanced Responsibilities:**
- Existing business logic (users, organizations, employees)
- Device management va control
- Policy management va versioning
- Reports va analytics
- File storage management
- RLS-aware data access

**New Modules:**

```typescript
// Dashboard API new modules
apps/dashboard-api/src/modules/
├── gateway-management/     # Gateway registration va monitoring
├── device-control/         # Device command va status
├── policy-versioning/      # Policy version management
├── file-storage/          # File storage abstraction
└── observability/         # Metrics va health endpoints
```

### Data Models

#### New Database Tables

```sql
-- Gateway management
CREATE TABLE gateway_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    serial VARCHAR(255) UNIQUE NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    status gateway_status DEFAULT 'offline',
    last_seen_at TIMESTAMP,
    config JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Gateway status snapshots
CREATE TABLE gateway_status_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_id UUID NOT NULL REFERENCES gateway_instances(id),
    timestamp TIMESTAMP NOT NULL,
    cpu_usage DECIMAL(5,2),
    disk_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    queue_depth INTEGER,
    connected_agents INTEGER,
    network_status JSONB
);

-- Agent instances
CREATE TABLE agent_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_id UUID NOT NULL REFERENCES gateway_instances(id),
    agent_uid VARCHAR(255) NOT NULL,
    computer_name VARCHAR(255),
    status agent_status DEFAULT 'offline',
    last_seen_at TIMESTAMP,
    policy_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(gateway_id, agent_uid)
);

-- Command queue
CREATE TABLE gateway_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_id UUID NOT NULL REFERENCES gateway_instances(id),
    type command_type NOT NULL, -- 'policy_update', 'restart_agent', 'device_command'
    payload JSONB NOT NULL,
    status command_status DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    ack_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Policy versioning
CREATE TABLE policy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id INTEGER NOT NULL REFERENCES policies(id),
    version VARCHAR(50) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    requires_restart BOOLEAN DEFAULT FALSE,
    released_at TIMESTAMP DEFAULT NOW(),
    released_by INTEGER REFERENCES users(id),
    UNIQUE(policy_id, version)
);

-- Policy change audit
CREATE TABLE policy_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id INTEGER NOT NULL REFERENCES policies(id),
    version_id UUID NOT NULL REFERENCES policy_versions(id),
    changed_by INTEGER NOT NULL REFERENCES users(id),
    changeset JSONB NOT NULL,
    change_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Device adapters registry
CREATE TABLE device_adapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(100) NOT NULL, -- 'hikvision', 'zkteco', 'suprema'
    vendor VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    config_schema JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(type, version)
);

-- Device commands tracking
CREATE TABLE device_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id INTEGER NOT NULL REFERENCES devices(id),
    gateway_id UUID NOT NULL REFERENCES gateway_instances(id),
    adapter_type VARCHAR(100) NOT NULL,
    command_type VARCHAR(100) NOT NULL, -- 'open_door', 'restart', 'get_status'
    payload JSONB NOT NULL,
    status command_status DEFAULT 'pending',
    response JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- File storage retention policies
CREATE TABLE retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id INTEGER REFERENCES organizations(id),
    resource_type VARCHAR(100) NOT NULL, -- 'screenshot', 'credential', 'profile'
    retention_days INTEGER NOT NULL,
    action retention_action DEFAULT 'delete', -- 'delete', 'archive'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### TimescaleDB Schema

```sql
-- TimescaleDB monitoring schema
CREATE SCHEMA IF NOT EXISTS monitoring;

-- Active windows (time-series)
CREATE TABLE monitoring.active_windows (
    id UUID DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    computer_uid VARCHAR(255) NOT NULL,
    user_sid VARCHAR(255) NOT NULL,
    window_title VARCHAR(500),
    process_name VARCHAR(255),
    url VARCHAR(1000),
    datetime TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER,
    organization_id INTEGER NOT NULL,
    PRIMARY KEY (id, datetime)
);

-- Convert to hypertable
SELECT create_hypertable('monitoring.active_windows', 'datetime', chunk_time_interval => INTERVAL '1 day');

-- Visited sites (time-series)
CREATE TABLE monitoring.visited_sites (
    id UUID DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    computer_uid VARCHAR(255) NOT NULL,
    user_sid VARCHAR(255) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    title VARCHAR(500),
    datetime TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER,
    organization_id INTEGER NOT NULL,
    PRIMARY KEY (id, datetime)
);

SELECT create_hypertable('monitoring.visited_sites', 'datetime', chunk_time_interval => INTERVAL '1 day');

-- Screenshots metadata (time-series)
CREATE TABLE monitoring.screenshots (
    id UUID DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    computer_uid VARCHAR(255) NOT NULL,
    user_sid VARCHAR(255) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT,
    datetime TIMESTAMPTZ NOT NULL,
    organization_id INTEGER NOT NULL,
    PRIMARY KEY (id, datetime)
);

SELECT create_hypertable('monitoring.screenshots', 'datetime', chunk_time_interval => INTERVAL '1 day');

-- User sessions (time-series)
CREATE TABLE monitoring.user_sessions (
    id UUID DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    computer_uid VARCHAR(255) NOT NULL,
    user_sid VARCHAR(255) NOT NULL,
    session_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'lock', 'unlock'
    datetime TIMESTAMPTZ NOT NULL,
    organization_id INTEGER NOT NULL,
    PRIMARY KEY (id, datetime)
);

SELECT create_hypertable('monitoring.user_sessions', 'datetime', chunk_time_interval => INTERVAL '1 day');

-- Retention policies
SELECT add_retention_policy('monitoring.active_windows', INTERVAL '90 days');
SELECT add_retention_policy('monitoring.visited_sites', INTERVAL '90 days');
SELECT add_retention_policy('monitoring.screenshots', INTERVAL '30 days');
SELECT add_retention_policy('monitoring.user_sessions', INTERVAL '365 days');
```

#### RLS Implementation

```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_instances ENABLE ROW LEVEL SECURITY;
-- ... other tables

-- RLS policies
CREATE POLICY organization_rls ON organizations
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        id = current_setting('app.current_organization_id')::integer
    );

CREATE POLICY employee_rls ON employees
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        organization_id = current_setting('app.current_organization_id')::integer
    );

CREATE POLICY gateway_rls ON gateway_instances
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        organization_id = current_setting('app.current_organization_id')::integer
    );

-- TimescaleDB RLS
CREATE POLICY monitoring_active_windows_rls ON monitoring.active_windows
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        organization_id = current_setting('app.current_organization_id')::integer
    );
```

### Components and Interfaces

#### File Storage Abstraction

```typescript
// File storage interface
export interface IFileStorageService {
  upload(file: Buffer, path: string, metadata?: FileMetadata): Promise<string>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  list(prefix: string, options?: ListOptions): Promise<FileInfo[]>;
  getUrl(path: string, expiresIn?: number): Promise<string>;
}

// Implementations
@Injectable()
export class LocalFileStorageService implements IFileStorageService {
  constructor(private readonly config: LocalStorageConfig) {}
  
  async upload(file: Buffer, path: string): Promise<string> {
    const fullPath = join(this.config.basePath, path);
    await writeFile(fullPath, file);
    return fullPath;
  }
  // ... other methods
}

@Injectable()
export class S3FileStorageService implements IFileStorageService {
  constructor(private readonly s3Client: S3Client) {}
  
  async upload(file: Buffer, path: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: path,
      Body: file,
    });
    await this.s3Client.send(command);
    return `s3://${this.config.bucket}/${path}`;
  }
  // ... other methods
}

// Factory
@Injectable()
export class FileStorageFactory {
  create(driver: string): IFileStorageService {
    switch (driver) {
      case 'local':
        return new LocalFileStorageService(this.localConfig);
      case 's3':
        return new S3FileStorageService(this.s3Client);
      case 'minio':
        return new MinIOFileStorageService(this.minioClient);
      default:
        throw new Error(`Unsupported storage driver: ${driver}`);
    }
  }
}
```

#### Device Adapter Platform

```typescript
// Base device adapter interface
export interface IDeviceAdapter {
  connect(config: DeviceConfig): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<DeviceStatus>;
  executeCommand(command: DeviceCommand): Promise<DeviceCommandResult>;
  fetchLogs(since?: Date): Promise<DeviceLog[]>;
  subscribe(callback: (event: DeviceEvent) => void): void;
}

// Hikvision adapter implementation
@Injectable()
export class HikvisionAdapter implements IDeviceAdapter {
  private isapi: ISAPIClient;
  
  async connect(config: HikvisionConfig): Promise<void> {
    this.isapi = new ISAPIClient({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    });
    await this.isapi.authenticate();
  }
  
  async executeCommand(command: DeviceCommand): Promise<DeviceCommandResult> {
    switch (command.type) {
      case 'open_door':
        return await this.openDoor(command.gateId);
      case 'restart':
        return await this.restart();
      case 'get_status':
        return await this.getDeviceInfo();
      default:
        throw new Error(`Unsupported command: ${command.type}`);
    }
  }
  
  private async openDoor(gateId: number): Promise<DeviceCommandResult> {
    const response = await this.isapi.post(`/ISAPI/AccessControl/RemoteControl/door/${gateId}`, {
      cmd: 'open'
    });
    return {
      success: response.status === 200,
      message: response.data?.message || 'Door opened',
      timestamp: new Date(),
    };
  }
}

// ZKTeco adapter implementation
@Injectable()
export class ZKTecoAdapter implements IDeviceAdapter {
  private sdk: ZKTecoSDK;
  
  async connect(config: ZKTecoConfig): Promise<void> {
    this.sdk = new ZKTecoSDK();
    await this.sdk.connect(config.host, config.port);
    await this.sdk.authenticate(config.username, config.password);
  }
  
  async executeCommand(command: DeviceCommand): Promise<DeviceCommandResult> {
    switch (command.type) {
      case 'open_door':
        return await this.sdk.openDoor();
      case 'get_users':
        return await this.sdk.getAllUsers();
      default:
        throw new Error(`Unsupported command: ${command.type}`);
    }
  }
}

// Adapter registry
@Injectable()
export class DeviceAdapterRegistry {
  private adapters = new Map<string, IDeviceAdapter>();
  
  register(type: string, adapter: IDeviceAdapter): void {
    this.adapters.set(type, adapter);
  }
  
  get(type: string): IDeviceAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new Error(`Adapter not found for type: ${type}`);
    }
    return adapter;
  }
  
  async executeCommand(deviceId: number, command: DeviceCommand): Promise<DeviceCommandResult> {
    const device = await this.deviceService.findById(deviceId);
    const adapter = this.get(device.type);
    return await adapter.executeCommand(command);
  }
}
```

#### Policy Distribution System

```typescript
// Policy distribution service
@Injectable()
export class PolicyDistributionService {
  constructor(
    private readonly gatewayService: GatewayService,
    private readonly commandQueue: CommandQueueService,
    private readonly websocketGateway: GatewayControlGateway,
  ) {}
  
  async distributePolicy(policyId: number, organizationId: number): Promise<void> {
    // Create new policy version
    const version = await this.createPolicyVersion(policyId);
    
    // Get all gateways for organization
    const gateways = await this.gatewayService.findByOrganization(organizationId);
    
    // Create commands for each gateway
    for (const gateway of gateways) {
      const command = {
        type: 'policy_update',
        payload: {
          policyId,
          version: version.version,
          checksum: version.checksum,
          requiresRestart: version.requires_restart,
        },
      };
      
      // Add to command queue
      await this.commandQueue.add(gateway.id, command);
      
      // Try immediate WebSocket delivery
      try {
        await this.websocketGateway.sendCommand(gateway.id, command);
      } catch (error) {
        // Will be retried via queue
        this.logger.warn(`Failed to send immediate command to gateway ${gateway.id}`);
      }
    }
  }
  
  async handlePolicyAck(gatewayId: string, ack: PolicyAckData): Promise<void> {
    // Update command status
    await this.commandQueue.markCompleted(ack.commandId);
    
    // Update agent policy versions
    await this.agentService.updatePolicyVersion(gatewayId, ack.policyVersion);
    
    // Trigger restart if required
    if (ack.requiresRestart) {
      await this.triggerAgentRestart(gatewayId);
    }
  }
}

// Command queue service
@Injectable()
export class CommandQueueService {
  async add(gatewayId: string, command: GatewayCommand): Promise<string> {
    const commandRecord = await this.prisma.gatewayCommands.create({
      data: {
        gateway_id: gatewayId,
        type: command.type,
        payload: command.payload,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
    
    return commandRecord.id;
  }
  
  async getPending(gatewayId: string): Promise<GatewayCommand[]> {
    return await this.prisma.gatewayCommands.findMany({
      where: {
        gateway_id: gatewayId,
        status: 'pending',
        expires_at: { gt: new Date() },
        attempts: { lt: this.prisma.gatewayCommands.fields.max_attempts },
      },
      orderBy: { created_at: 'asc' },
    });
  }
  
  async markCompleted(commandId: string): Promise<void> {
    await this.prisma.gatewayCommands.update({
      where: { id: commandId },
      data: {
        status: 'completed',
        ack_at: new Date(),
      },
    });
  }
}
```

### Error Handling

#### Gateway Error Handling

```typescript
@Injectable()
export class GatewayErrorHandler {
  private readonly retryConfig = {
    maxRetries: 5,
    baseDelay: 1000, // 1 second
    maxDelay: 16000, // 16 seconds
  };
  
  static handleConnectionError(error: ConnectionError): void {
    // Log error and switch to offline mode
    logger.error('Connection to Agent API failed', { 
      error: error.message,
      timestamp: new Date(),
      retryAttempt: error.retryAttempt 
    });
    
    // Continue buffering data locally
    this.bufferManager.setOfflineMode(true);
    
    // Schedule retry with exponential backoff
    this.scheduleReconnectWithBackoff(error.retryAttempt);
  }
  
  static handleBufferOverflow(error: BufferOverflowError): void {
    const currentUsage = this.bufferManager.getDiskUsage();
    
    if (currentUsage > 0.95) {
      // Critical: Reject new data and implement back-pressure
      this.bufferManager.enableBackPressure(true);
      logger.error('Buffer at 95% capacity, enabling back-pressure');
    } else if (currentUsage > 0.80) {
      // Warning: Cleanup oldest records
      this.bufferManager.cleanupOldest(1000);
      logger.warn('Buffer at 80% capacity, cleaning up oldest records');
    }
    
    // Alert monitoring with severity
    this.metricsService.incrementCounter('buffer_overflow_total');
    this.alertService.sendAlert('buffer_overflow', { 
      severity: currentUsage > 0.95 ? 'critical' : 'warning',
      usage: currentUsage 
    });
  }
  
  static handleDeviceError(deviceId: string, error: DeviceError): void {
    // Log device-specific error with failure isolation
    logger.error('Device communication failed', {
      deviceId,
      error: error.message,
      adapter: error.adapterType,
      timestamp: new Date(),
      isolationStatus: 'isolated'
    });
    
    // Update device status and isolate failure
    this.deviceStatusService.markOffline(deviceId);
    this.adapterRegistry.isolateAdapter(error.adapterType, deviceId);
    
    // Schedule device reconnection with exponential backoff
    this.scheduleDeviceReconnectWithBackoff(deviceId, error.retryAttempt);
    
    // Update adapter health metrics
    this.metricsService.recordAdapterFailure(error.adapterType);
  }
  
  private scheduleReconnectWithBackoff(retryAttempt: number): void {
    if (retryAttempt >= this.retryConfig.maxRetries) {
      logger.error('Max retry attempts reached, marking as failed');
      this.alertService.sendAlert('connection_failed', { 
        severity: 'critical',
        maxRetriesReached: true 
      });
      return;
    }
    
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(2, retryAttempt),
      this.retryConfig.maxDelay
    );
    
    setTimeout(() => {
      this.attemptReconnection(retryAttempt + 1);
    }, delay);
  }
}
```

#### API Error Handling

```typescript
@Injectable()
export class ApiErrorHandler {
  private static consecutiveTimescaleFailures = 0;
  private static readonly TIMESCALE_FAILURE_THRESHOLD = 3;
  
  static handleValidationError(error: ValidationError): ApiErrorResponse {
    // Log validation error with PII scrubbing
    logger.error('Validation error occurred', {
      error: this.scrubPII(error.message),
      field: error.field,
      timestamp: new Date(),
    });
    
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Ma\'lumot validatsiyasida xatolik',
      details: this.scrubPII(error.details),
      timestamp: new Date(),
    };
  }
  
  static handleRLSError(error: RLSError): ApiErrorResponse {
    // Audit failed access attempt
    this.auditService.logFailedAccess({
      userId: error.userId,
      organizationId: error.organizationId,
      resource: error.resource,
      action: error.action,
      reason: 'RLS_POLICY_VIOLATION',
      timestamp: new Date(),
    });
    
    // Log RLS violation for monitoring
    logger.warn('RLS access denied', {
      userId: error.userId,
      resource: error.resource,
      policy: error.policyName,
      timestamp: new Date(),
    });
    
    // Update RLS metrics
    this.metricsService.incrementCounter('rls_violations_total', {
      policy: error.policyName,
      resource: error.resource,
    });
    
    return {
      success: false,
      error: 'ACCESS_DENIED',
      message: 'Ushbu ma\'lumotga kirish huquqi yo\'q',
      timestamp: new Date(),
    };
  }
  
  static async handleTimescaleError(error: TimescaleError): Promise<ApiErrorResponse> {
    this.consecutiveTimescaleFailures++;
    
    // Log error with failure count
    logger.error('TimescaleDB error occurred', {
      error: error.message,
      consecutiveFailures: this.consecutiveTimescaleFailures,
      threshold: this.TIMESCALE_FAILURE_THRESHOLD,
      timestamp: new Date(),
    });
    
    // Check if we should trigger fallback
    if (this.consecutiveTimescaleFailures >= this.TIMESCALE_FAILURE_THRESHOLD) {
      logger.error('TimescaleDB failure threshold reached, activating PostgreSQL fallback');
      
      // Activate fallback mode
      await this.databaseService.activatePostgreSQLFallback();
      
      // Start recovery monitoring
      this.startTimescaleRecoveryMonitoring();
      
      // Alert operations team
      this.alertService.sendAlert('timescale_fallback_activated', {
        severity: 'critical',
        consecutiveFailures: this.consecutiveTimescaleFailures,
      });
    }
    
    return {
      success: false,
      error: 'DATABASE_ERROR',
      message: 'Ma\'lumot saqlashda vaqtinchalik muammo',
      timestamp: new Date(),
    };
  }
  
  private static startTimescaleRecoveryMonitoring(): void {
    const recoveryInterval = setInterval(async () => {
      try {
        // Test TimescaleDB connection
        await this.databaseService.testTimescaleConnection();
        
        // If successful, deactivate fallback
        await this.databaseService.deactivatePostgreSQLFallback();
        
        // Sync buffered data
        await this.databaseService.syncBufferedDataToTimescale();
        
        // Reset failure counter
        this.consecutiveTimescaleFailures = 0;
        
        // Clear recovery monitoring
        clearInterval(recoveryInterval);
        
        logger.info('TimescaleDB recovery successful, fallback deactivated');
        
      } catch (recoveryError) {
        logger.warn('TimescaleDB still unavailable, continuing fallback mode');
      }
    }, 60000); // Check every 60 seconds
  }
  
  private static scrubPII(data: any): any {
    if (typeof data === 'string') {
      return data
        .replace(/password[=:]\s*\S+/gi, 'password=***')
        .replace(/api[_-]?key[=:]\s*\S+/gi, 'api_key=***')
        .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '****-****-****-****')
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***');
    }
    return data;
  }
}
```

### Testing Strategy

#### Unit Testing (85% Coverage Target)

```typescript
// Gateway service unit tests
describe('GatewayService', () => {
  let service: GatewayService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockBufferManager: jest.Mocked<BufferManager>;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GatewayService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BufferManager, useValue: mockBufferManager },
      ],
    }).compile();
    
    service = module.get<GatewayService>(GatewayService);
  });
  
  it('should register new gateway', async () => {
    const gatewayData = {
      serial: 'GW-001',
      organizationId: 1,
    };
    
    mockPrisma.gatewayInstances.create.mockResolvedValue({
      id: 'uuid',
      ...gatewayData,
      api_key: 'generated-key',
    });
    
    const result = await service.register(gatewayData);
    
    expect(result.api_key).toBeDefined();
    expect(mockPrisma.gatewayInstances.create).toHaveBeenCalledWith({
      data: expect.objectContaining(gatewayData),
    });
  });
  
  it('should handle buffer overflow with back-pressure', async () => {
    mockBufferManager.getDiskUsage.mockReturnValue(0.96);
    
    await service.handleBufferOverflow();
    
    expect(mockBufferManager.enableBackPressure).toHaveBeenCalledWith(true);
    expect(mockAlertService.sendAlert).toHaveBeenCalledWith('buffer_overflow', {
      severity: 'critical',
      usage: 0.96
    });
  });
});

// Device adapter unit tests with failure isolation
describe('HikvisionAdapter', () => {
  let adapter: HikvisionAdapter;
  let mockISAPI: jest.Mocked<ISAPIClient>;
  let mockMetrics: jest.Mocked<MetricsService>;
  
  beforeEach(() => {
    adapter = new HikvisionAdapter();
    mockISAPI = jest.mocked(new ISAPIClient());
    mockMetrics = jest.mocked(new MetricsService());
  });
  
  it('should open door successfully', async () => {
    mockISAPI.post.mockResolvedValue({ status: 200, data: { message: 'OK' } });
    
    const result = await adapter.executeCommand({
      type: 'open_door',
      gateId: 1,
    });
    
    expect(result.success).toBe(true);
    expect(mockISAPI.post).toHaveBeenCalledWith(
      '/ISAPI/AccessControl/RemoteControl/door/1',
      { cmd: 'open' }
    );
    expect(mockMetrics.recordAdapterSuccess).toHaveBeenCalledWith('hikvision');
  });
  
  it('should handle adapter failure with isolation', async () => {
    mockISAPI.post.mockRejectedValue(new Error('Connection timeout'));
    
    await expect(adapter.executeCommand({
      type: 'open_door',
      gateId: 1,
    })).rejects.toThrow();
    
    expect(mockMetrics.recordAdapterFailure).toHaveBeenCalledWith('hikvision');
    expect(adapter.isIsolated()).toBe(true);
  });
});

// Auto-update mechanism tests
describe('GatewayAutoUpdater', () => {
  let updater: GatewayAutoUpdater;
  let mockSignatureValidator: jest.Mocked<SignatureValidator>;
  
  beforeEach(() => {
    updater = new GatewayAutoUpdater();
    mockSignatureValidator = jest.mocked(new SignatureValidator());
  });
  
  it('should verify package provenance', async () => {
    const manifest = {
      version: '2.1.0',
      downloadUrl: 'https://releases.staff-control.com/gateway/2.1.0/gateway.tar.gz',
      signature: 'valid-signature',
    };
    
    mockSignatureValidator.verify.mockResolvedValue(true);
    
    const isValid = await updater.verifyPackageProvenance(manifest);
    
    expect(isValid).toBe(true);
    expect(mockSignatureValidator.verify).toHaveBeenCalledWith(
      manifest.downloadUrl,
      manifest.signature
    );
  });
  
  it('should rollback on failed update', async () => {
    const updateResult = await updater.performUpdate('2.1.0');
    
    // Simulate health check failure
    mockHealthChecker.check.mockResolvedValue(false);
    
    const rollbackResult = await updater.rollbackToPreviousVersion();
    
    expect(rollbackResult.success).toBe(true);
    expect(mockAuditLogger.log).toHaveBeenCalledWith({
      action: 'auto_rollback',
      version: '2.1.0',
      reason: 'health_check_failed',
    });
  });
});

// TimescaleDB migration tests
describe('TimescaleMigrationService', () => {
  let service: TimescaleMigrationService;
  let mockTimescale: jest.Mocked<TimescaleService>;
  let mockPostgres: jest.Mocked<PostgresService>;
  
  it('should verify data integrity after migration', async () => {
    const sourceCount = 10000;
    const targetCount = 10000;
    
    mockPostgres.count.mockResolvedValue(sourceCount);
    mockTimescale.count.mockResolvedValue(targetCount);
    
    const integrity = await service.verifyDataIntegrity('active_windows');
    
    expect(integrity.isValid).toBe(true);
    expect(integrity.sourceCount).toBe(sourceCount);
    expect(integrity.targetCount).toBe(targetCount);
  });
  
  it('should handle fallback mechanism', async () => {
    // Simulate TimescaleDB failure
    mockTimescale.isHealthy.mockResolvedValue(false);
    
    await service.checkAndActivateFallback();
    
    expect(mockPostgres.activatePartitionFallback).toHaveBeenCalled();
    expect(mockAlertService.sendAlert).toHaveBeenCalledWith('timescale_fallback_activated');
  });
});
```

#### Integration Testing

```typescript
// Gateway-Agent API integration tests
describe('Gateway Integration', () => {
  let app: INestApplication;
  let gateway: TestGateway;
  
  beforeAll(async () => {
    app = await createTestApp();
    gateway = new TestGateway(app.getHttpServer());
  });
  
  it('should handle batch data ingestion', async () => {
    const batchData = {
      gatewayId: 'test-gateway',
      data: [
        {
          type: 'active_window',
          computerUid: 'PC-001',
          userSid: 'S-1-5-21-123',
          payload: { windowTitle: 'Test Window' },
          timestamp: new Date(),
        },
      ],
    };
    
    const response = await gateway.post('/v2/ingest/logs', batchData);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    // Verify data was saved to TimescaleDB
    const saved = await app.get(TimescaleService).findActiveWindows({
      computerUid: 'PC-001',
    });
    expect(saved).toHaveLength(1);
  });
  
  it('should handle WebSocket control commands', async () => {
    const wsClient = gateway.createWebSocketClient();
    
    // Send heartbeat
    wsClient.emit('heartbeat', {
      gatewayId: 'test-gateway',
      status: 'online',
      queueDepth: 0,
    });
    
    // Should receive policy update command
    const command = await wsClient.waitForMessage('policy_update');
    expect(command.type).toBe('policy_update');
    
    // Send acknowledgment
    wsClient.emit('command_ack', {
      commandId: command.id,
      status: 'completed',
    });
  });
});
```

#### Load Testing (Performance Baseline Requirements)

```typescript
// Load testing configuration with baseline comparison
export const loadTestConfig = {
  scenarios: {
    batch_ingestion: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 100 },
        { duration: '10m', target: 200 }, // Peak load
        { duration: '2m', target: 0 },
      ],
    },
    timescale_stress: {
      executor: 'constant-arrival-rate',
      rate: 1000, // 1000 messages per second
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
    },
    queue_backlog_stress: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      stages: [
        { duration: '2m', target: 500 },
        { duration: '5m', target: 1000 },
        { duration: '2m', target: 100 },
      ],
    },
  },
  thresholds: {
    // Performance improvement requirements (20% better than baseline)
    http_req_duration: ['p(95)<400'], // 20% better than 500ms baseline
    http_req_failed: ['rate<0.005'],  // 50% better than 1% baseline
    timescale_write_duration: ['p(95)<200'], // TimescaleDB write performance
    queue_depth: ['max<10000'], // Queue backlog limit
    buffer_usage: ['max<0.80'], // Buffer usage threshold
  },
};

// Performance baseline measurement
export function measureBaseline() {
  const startTime = Date.now();
  
  // Measure current v1.0 performance
  const baselineMetrics = {
    apiResponseTime: measureApiResponseTime(),
    dbQueryLatency: measureDbQueryLatency(),
    throughput: measureThroughput(),
  };
  
  console.log('Baseline metrics captured:', baselineMetrics);
  return baselineMetrics;
}

// Load test script with comprehensive monitoring
export default function() {
  const batchData = generateBatchData(100);
  
  // Add idempotency token
  const idempotencyToken = `batch_${__VU}_${__ITER}_${Date.now()}`;
  
  const response = http.post('http://agent-api:3001/v2/ingest/logs', 
    JSON.stringify({
      ...batchData,
      idempotencyToken,
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'X-Idempotency-Token': idempotencyToken,
      },
    }
  );
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 400ms': (r) => r.timings.duration < 400, // 20% improvement
    'no duplicate processing': (r) => !r.json('duplicateDetected'),
    'timescale write successful': (r) => r.json('timescaleStatus') === 'success',
  });
  
  // Monitor buffer usage
  const bufferUsage = parseFloat(response.headers['X-Buffer-Usage'] || '0');
  check(bufferUsage, {
    'buffer usage under 80%': (usage) => usage < 0.80,
  });
  
  sleep(1);
}

// TimescaleDB specific load test
export function timescaleStressTest() {
  const timeSeriesData = generateTimeSeriesData(1000); // 1000 records
  
  const response = http.post('http://agent-api:3001/v2/ingest/timeseries', 
    JSON.stringify(timeSeriesData), {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(response, {
    'timescale ingestion successful': (r) => r.status === 200,
    'write latency acceptable': (r) => r.timings.duration < 200,
    'no fallback triggered': (r) => r.headers['X-Fallback-Mode'] !== 'true',
  });
}
```

## Migration Phases with Exit Criteria

### Phase 1: RLS and Storage Abstraction (Week 1)

#### Success Criteria
- IFileStorageService implementation with 90% test pass rate
- RLS policy verification on all core tables
- Performance baseline captured and documented
- Prisma RLS interceptor functional testing complete

#### Exit Gates
- [ ] Unit tests: 85% coverage achieved
- [ ] Integration tests: RLS isolation verified for all roles
- [ ] Performance tests: No degradation from baseline
- [ ] Security audit: RLS policies reviewed and approved

#### Rollback Triggers
- RLS policy failures affecting data access
- Performance degradation > 10% from baseline
- Test coverage below 80%

#### Rollback Plan (15 minutes)
1. Disable RLS on all tables
2. Revert to direct Prisma queries
3. Switch back to local file storage
4. Verify system functionality

### Phase 2: Gateway MVP (Week 2)

#### Success Criteria
- Gateway MVP load test (100 req/s) passes
- WebSocket stability test (24 hours) successful
- Basic ingestion and buffering functional
- API key authentication working

#### Exit Gates
- [ ] Load test: 100 req/s sustained for 1 hour
- [ ] WebSocket: 24-hour stability test
- [ ] Buffer management: Overflow handling verified
- [ ] Security: API key rotation tested

#### Rollback Triggers
- Gateway connection failures > 5%
- Buffer overflow without proper back-pressure
- WebSocket disconnections > 1 per hour

#### Rollback Plan (15 minutes)
1. Route traffic back to direct Agent API
2. Disable gateway endpoints
3. Restore v1.0 agent connections
4. Verify data flow continuity

### Phase 3: Policy & Command Queue (Week 3)

#### Success Criteria
- Policy distribution success rate > 95%
- Command queue processing with exponential backoff
- Agent restart mechanism functional
- Retry logic with proper limits implemented

#### Exit Gates
- [ ] Policy distribution: 95% success rate
- [ ] Command processing: < 30s average latency
- [ ] Retry mechanism: Exponential backoff verified
- [ ] Queue management: Overflow handling tested

#### Rollback Triggers
- Policy distribution failure rate > 5%
- Command queue overflow without cleanup
- Retry loops without proper termination

#### Rollback Plan (15 minutes)
1. Disable policy distribution system
2. Clear command queues
3. Revert to manual policy updates
4. Restore direct agent configuration

### Phase 4: TimescaleDB Integration (Week 4)

#### Success Criteria
- TimescaleDB data integrity 99.9%
- Migration performance meets baseline
- Fallback mechanism tested and functional
- Retention policies working correctly

#### Exit Gates
- [ ] Data integrity: 99.9% verification passed
- [ ] Performance: Migration within baseline +10%
- [ ] Fallback: PostgreSQL partition fallback tested
- [ ] Retention: Automated cleanup verified

#### Rollback Triggers
- Data integrity failures > 0.1%
- Migration performance > baseline +20%
- Fallback mechanism failures

#### Rollback Plan (15 minutes)
1. Stop TimescaleDB writes
2. Activate PostgreSQL partition fallback
3. Migrate critical data back to PostgreSQL
4. Verify data consistency

### Phase 5: Device Adapter Platform (Week 5)

#### Success Criteria
- Hikvision adapter connection success rate > 95%
- ZKTeco adapter basic functionality working
- Adapter health monitoring operational
- Failure isolation mechanism tested

#### Exit Gates
- [ ] Hikvision: 95% connection success rate
- [ ] ZKTeco: Basic CRUD operations working
- [ ] Health monitoring: Metrics exposed correctly
- [ ] Failure isolation: Adapter failures contained

#### Rollback Triggers
- Adapter connection failures > 5%
- Device communication errors > 2%
- Failure isolation not working

#### Rollback Plan (15 minutes)
1. Disable device adapter platform
2. Revert to direct device connections
3. Restore v1.0 device management
4. Verify device functionality

### Phase 6: Observability Stack (Week 6)

#### Success Criteria
- Observability stack uptime > 99.5%
- Alert response time < 30s
- Dashboard functionality complete
- Log retention and PII scrubbing working

#### Exit Gates
- [ ] Stack uptime: 99.5% over 48 hours
- [ ] Alerting: < 30s response time
- [ ] Dashboards: All metrics displaying correctly
- [ ] Compliance: PII scrubbing verified

#### Rollback Triggers
- Observability stack downtime > 0.5%
- Alert failures or false positives > 10%
- Dashboard critical errors

#### Rollback Plan (15 minutes)
1. Disable new observability stack
2. Revert to basic logging
3. Restore v1.0 monitoring
4. Verify essential monitoring working

### Automated Smoke Tests

```typescript
// Automated smoke test suite for phase transitions
export class MigrationSmokeTests {
  async runPhaseTransitionTests(phase: number): Promise<TestResults> {
    const tests = [
      this.testApiEndpoints(),
      this.testDatabaseConnectivity(),
      this.testAuthenticationFlow(),
      this.testBasicDataFlow(),
    ];
    
    if (phase >= 2) {
      tests.push(this.testGatewayConnectivity());
    }
    
    if (phase >= 3) {
      tests.push(this.testPolicyDistribution());
    }
    
    if (phase >= 4) {
      tests.push(this.testTimescaleIntegration());
    }
    
    if (phase >= 5) {
      tests.push(this.testDeviceAdapters());
    }
    
    if (phase >= 6) {
      tests.push(this.testObservabilityStack());
    }
    
    const results = await Promise.all(tests);
    return this.aggregateResults(results);
  }
  
  private async testApiEndpoints(): Promise<TestResult> {
    // Test critical API endpoints
    const endpoints = [
      '/api/health',
      '/api/auth/login',
      '/api/organizations',
      '/api/employees',
    ];
    
    for (const endpoint of endpoints) {
      const response = await this.httpClient.get(endpoint);
      if (response.status !== 200) {
        return { success: false, endpoint, error: response.statusText };
      }
    }
    
    return { success: true, message: 'All API endpoints responding' };
  }
  
  private async testDatabaseConnectivity(): Promise<TestResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { success: true, message: 'Database connectivity verified' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

## Deployment Strategy

### Development Environment

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  agent-gateway:
    build: ./apps/agent-gateway
    ports:
      - "3003:3000"
    environment:
      - NODE_ENV=development
      - AGENT_API_URL=http://agent-api:3000
      - BUFFER_PATH=/tmp/gateway-buffer.sqlite
    volumes:
      - gateway-buffer:/tmp
    depends_on:
      - agent-api

  agent-api:
    build: ./apps/agent-api
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:password@postgres:5432/staff_control
      - TIMESCALE_URL=postgresql://user:password@timescale:5432/staff_control_ts
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - timescale
      - redis

  dashboard-api:
    build: ./apps/dashboard-api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:password@postgres:5432/staff_control
      - TIMESCALE_URL=postgresql://user:password@timescale:5432/staff_control_ts
      - STORAGE_DRIVER=local
      - STORAGE_BASE_PATH=/app/uploads
    volumes:
      - uploads:/app/uploads
    depends_on:
      - postgres
      - timescale

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: staff_control
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  timescale:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_DB: staff_control_ts
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - timescale-data:/var/lib/postgresql/data
    ports:
      - "5433:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  # Observability stack
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3004:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - ./monitoring/loki.yml:/etc/loki/local-config.yaml
      - loki-data:/loki

volumes:
  postgres-data:
  timescale-data:
  redis-data:
  prometheus-data:
  grafana-data:
  loki-data:
  gateway-buffer:
  uploads:
```

### Production Deployment

```yaml
# kubernetes/agent-api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agent-api
  template:
    metadata:
      labels:
        app: agent-api
    spec:
      containers:
      - name: agent-api
        image: staff-control/agent-api:v2.0.0
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        - name: TIMESCALE_URL
          valueFrom:
            secretKeyRef:
              name: timescale-secret
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: agent-api-service
spec:
  selector:
    app: agent-api
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Gateway Deployment

```dockerfile
# apps/agent-gateway/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build agent-gateway

FROM node:18-alpine AS runtime

RUN apk add --no-cache sqlite

WORKDIR /app
COPY --from=builder /app/dist/apps/agent-gateway ./
COPY --from=builder /app/node_modules ./node_modules

# Create buffer directory
RUN mkdir -p /var/lib/staff-gateway

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "main.js"]
```

```bash
# Gateway installation script
#!/bin/bash
# install-gateway.sh

set -e

GATEWAY_VERSION=${1:-"latest"}
ORGANIZATION_ID=${2}
PROVISIONING_TOKEN=${3}

if [ -z "$ORGANIZATION_ID" ] || [ -z "$PROVISIONING_TOKEN" ]; then
    echo "Usage: $0 [version] <organization_id> <provisioning_token>"
    exit 1
fi

echo "Installing Staff Control Gateway v${GATEWAY_VERSION}..."

# Download and verify gateway package
curl -L "https://releases.staff-control.com/gateway/${GATEWAY_VERSION}/gateway-linux-$(uname -m).tar.gz" \
    -o gateway.tar.gz

# Verify signature
curl -L "https://releases.staff-control.com/gateway/${GATEWAY_VERSION}/gateway-linux-$(uname -m).tar.gz.sig" \
    -o gateway.tar.gz.sig
gpg --verify gateway.tar.gz.sig gateway.tar.gz

# Extract and install
tar -xzf gateway.tar.gz
sudo mv gateway /usr/local/bin/
sudo mkdir -p /etc/staff-gateway
sudo mkdir -p /var/lib/staff-gateway
sudo mkdir -p /var/log/staff-gateway

# Create configuration
cat > /tmp/gateway.yml <<EOF
server:
  url: https://agent-api.staff-control.com
  control_url: wss://agent-api.staff-control.com/v2/gateway/socket

organization:
  id: ${ORGANIZATION_ID}
  provisioning_token: ${PROVISIONING_TOKEN}

buffer:
  path: /var/lib/staff-gateway/buffer.sqlite
  max_size: 1GB
  retention_days: 7

adapters:
  hikvision:
    enabled: true
  zkteco:
    enabled: true

logging:
  level: info
  file: /var/log/staff-gateway/gateway.log
EOF

sudo mv /tmp/gateway.yml /etc/staff-gateway/

# Create systemd service
sudo tee /etc/systemd/system/staff-gateway.service > /dev/null <<EOF
[Unit]
Description=Staff Control Gateway
After=network.target

[Service]
Type=simple
User=staff-gateway
Group=staff-gateway
ExecStart=/usr/local/bin/gateway --config /etc/staff-gateway/gateway.yml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create user and set permissions
sudo useradd -r -s /bin/false staff-gateway
sudo chown -R staff-gateway:staff-gateway /var/lib/staff-gateway
sudo chown -R staff-gateway:staff-gateway /var/log/staff-gateway

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable staff-gateway
sudo systemctl start staff-gateway

echo "Gateway installation completed!"
echo "Status: $(sudo systemctl is-active staff-gateway)"
```

## User Communication and Training Strategy

### Pre-Migration Communication (2 weeks before)

#### Stakeholder Notification System
```typescript
@Injectable()
export class MigrationNotificationService {
  async sendPreMigrationNotifications(): Promise<void> {
    const stakeholders = await this.getStakeholders();
    
    for (const stakeholder of stakeholders) {
      const notification = {
        type: 'migration_announcement',
        recipient: stakeholder.email,
        role: stakeholder.role,
        template: this.getTemplateForRole(stakeholder.role),
        scheduledFor: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
      };
      
      await this.emailService.scheduleNotification(notification);
    }
  }
  
  private getTemplateForRole(role: string): string {
    switch (role) {
      case 'ADMIN':
        return 'migration_admin_detailed';
      case 'HR':
        return 'migration_hr_summary';
      case 'DEPARTMENT_LEAD':
        return 'migration_lead_summary';
      default:
        return 'migration_user_basic';
    }
  }
}
```

#### Real-time Status Page
```typescript
// Status page implementation
@Controller('status')
export class MigrationStatusController {
  @Get()
  async getStatus(): Promise<MigrationStatus> {
    return {
      currentPhase: await this.getCurrentPhase(),
      progress: await this.getProgress(),
      estimatedCompletion: await this.getEstimatedCompletion(),
      issues: await this.getCurrentIssues(),
      uptime: await this.getSystemUptime(),
    };
  }
  
  @Get('live')
  @Sse()
  getLiveUpdates(): Observable<MessageEvent> {
    return this.migrationService.getStatusUpdates().pipe(
      map(status => ({
        data: JSON.stringify(status),
        type: 'status_update',
      }))
    );
  }
}
```

### Training Materials and Documentation

#### Gateway Installation Guide
```bash
#!/bin/bash
# Enhanced installation script with training integration

echo "=== Staff Control Gateway v2.0 Installation ==="
echo "This script will guide you through the installation process."
echo ""

# Check prerequisites
echo "Checking prerequisites..."
check_prerequisites() {
  if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed."
    echo "📖 Please visit: https://docs.staff-control.com/gateway/docker-setup"
    exit 1
  fi
  
  if ! command -v curl &> /dev/null; then
    echo "❌ curl is required but not installed."
    exit 1
  fi
  
  echo "✅ Prerequisites check passed"
}

# Interactive configuration
configure_gateway() {
  echo ""
  echo "=== Gateway Configuration ==="
  
  read -p "Organization ID: " ORG_ID
  read -p "Provisioning Token: " PROV_TOKEN
  read -p "Gateway Location (e.g., 'Main Office'): " LOCATION
  
  # Validate inputs
  if [[ -z "$ORG_ID" || -z "$PROV_TOKEN" ]]; then
    echo "❌ Organization ID and Provisioning Token are required"
    exit 1
  fi
  
  echo "✅ Configuration completed"
}

# Installation with progress tracking
install_gateway() {
  echo ""
  echo "=== Installing Gateway ==="
  
  # Download with progress
  echo "📥 Downloading gateway package..."
  curl -L --progress-bar \
    "https://releases.staff-control.com/gateway/latest/gateway-linux-$(uname -m).tar.gz" \
    -o gateway.tar.gz
  
  # Verify signature
  echo "🔐 Verifying package signature..."
  curl -L "https://releases.staff-control.com/gateway/latest/gateway-linux-$(uname -m).tar.gz.sig" \
    -o gateway.tar.gz.sig
  
  if ! gpg --verify gateway.tar.gz.sig gateway.tar.gz; then
    echo "❌ Package signature verification failed"
    exit 1
  fi
  
  echo "✅ Package verified successfully"
  
  # Extract and install
  echo "📦 Installing gateway..."
  tar -xzf gateway.tar.gz
  sudo mv gateway /usr/local/bin/
  
  # Create configuration
  create_configuration
  
  # Setup service
  setup_service
  
  echo "✅ Gateway installation completed"
}

# Post-installation verification
verify_installation() {
  echo ""
  echo "=== Verifying Installation ==="
  
  # Check service status
  if systemctl is-active --quiet staff-gateway; then
    echo "✅ Gateway service is running"
  else
    echo "❌ Gateway service is not running"
    echo "📖 Troubleshooting guide: https://docs.staff-control.com/gateway/troubleshooting"
    exit 1
  fi
  
  # Check connectivity
  echo "🔗 Testing connectivity to cloud services..."
  if /usr/local/bin/gateway --test-connection; then
    echo "✅ Cloud connectivity verified"
  else
    echo "❌ Cloud connectivity failed"
    echo "📖 Network requirements: https://docs.staff-control.com/gateway/network"
    exit 1
  fi
  
  echo ""
  echo "🎉 Gateway installation successful!"
  echo ""
  echo "📚 Next steps:"
  echo "  1. Review the dashboard: https://dashboard.staff-control.com/gateways"
  echo "  2. Configure device adapters: https://docs.staff-control.com/gateway/adapters"
  echo "  3. Set up monitoring: https://docs.staff-control.com/gateway/monitoring"
  echo ""
  echo "🆘 Need help? Contact support: support@staff-control.com"
}

# Main installation flow
main() {
  check_prerequisites
  configure_gateway
  install_gateway
  verify_installation
}

main "$@"
```

#### User Training Materials
```typescript
// Training progress tracking
@Injectable()
export class TrainingService {
  async trackTrainingProgress(userId: number, module: string): Promise<void> {
    await this.prisma.trainingProgress.upsert({
      where: {
        userId_module: {
          userId,
          module,
        },
      },
      update: {
        completedAt: new Date(),
        progress: 100,
      },
      create: {
        userId,
        module,
        progress: 100,
        completedAt: new Date(),
      },
    });
  }
  
  async getTrainingStatus(userId: number): Promise<TrainingStatus> {
    const requiredModules = [
      'gateway_basics',
      'new_features_overview',
      'device_management',
      'policy_updates',
      'troubleshooting',
    ];
    
    const completed = await this.prisma.trainingProgress.findMany({
      where: {
        userId,
        module: { in: requiredModules },
        progress: 100,
      },
    });
    
    return {
      totalModules: requiredModules.length,
      completedModules: completed.length,
      isComplete: completed.length === requiredModules.length,
      nextModule: this.getNextModule(userId, requiredModules, completed),
    };
  }
}
```

### 24/7 Support During Migration

#### Support Ticket System
```typescript
@Injectable()
export class MigrationSupportService {
  async createSupportTicket(ticket: CreateSupportTicketDto): Promise<SupportTicket> {
    const priority = this.determinePriority(ticket);
    
    const supportTicket = await this.prisma.supportTickets.create({
      data: {
        ...ticket,
        priority,
        status: 'open',
        assignedTo: await this.getNextAvailableAgent(priority),
        createdAt: new Date(),
      },
    });
    
    // Send immediate acknowledgment
    await this.notificationService.sendTicketAcknowledgment(supportTicket);
    
    // Alert support team for high priority tickets
    if (priority === 'critical' || priority === 'high') {
      await this.alertService.notifySupportTeam(supportTicket);
    }
    
    return supportTicket;
  }
  
  private determinePriority(ticket: CreateSupportTicketDto): TicketPriority {
    const criticalKeywords = ['down', 'offline', 'data loss', 'security breach'];
    const highKeywords = ['gateway', 'connection', 'sync', 'policy'];
    
    const description = ticket.description.toLowerCase();
    
    if (criticalKeywords.some(keyword => description.includes(keyword))) {
      return 'critical';
    }
    
    if (highKeywords.some(keyword => description.includes(keyword))) {
      return 'high';
    }
    
    return 'medium';
  }
}
```

#### Knowledge Base Integration
```typescript
@Controller('support')
export class SupportController {
  @Get('kb/search')
  async searchKnowledgeBase(@Query('q') query: string): Promise<KBArticle[]> {
    // Search migration-specific articles first
    const migrationArticles = await this.kbService.search(query, {
      tags: ['migration', 'v2.0', 'gateway'],
      priority: 'high',
    });
    
    // Then search general articles
    const generalArticles = await this.kbService.search(query, {
      exclude: ['migration'],
      limit: 5,
    });
    
    return [...migrationArticles, ...generalArticles];
  }
  
  @Get('kb/migration-faq')
  async getMigrationFAQ(): Promise<FAQItem[]> {
    return [
      {
        question: 'What happens to my existing data during migration?',
        answer: 'All existing data is preserved. We create backups before migration and verify data integrity at each step.',
        category: 'data_safety',
      },
      {
        question: 'How long will the migration take?',
        answer: 'The complete migration is designed to take less than 4 hours with minimal downtime.',
        category: 'timeline',
      },
      {
        question: 'What if something goes wrong during migration?',
        answer: 'Each phase has automated rollback capabilities. We can restore to the previous state within 15 minutes.',
        category: 'safety',
      },
      // ... more FAQ items
    ];
  }
}
```

This comprehensive design document provides the detailed architecture and implementation strategy for migrating the Staff Control System from v1.0 to v2.0, covering all the key components including Agent Gateway, TimescaleDB integration, RLS implementation, device adapters, observability stack, comprehensive testing strategy, phase-based migration with exit criteria, and user communication/training systems.