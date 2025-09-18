# Device Management Technical Specification

## 1. Device Model Architecture

### 1.1 Device Entity Structure

```typescript
interface Device {
  id: string;
  name: string;
  host: string;
  username: string;
  password: string; // Encrypted
  port: number;
  protocol: 'http' | 'https';
  type: DeviceType;
  status: DeviceStatus;

  // Organization hierarchy
  organizationId: string;
  branchId?: string;
  departmentId?: string;

  // Device specifications
  model?: string;
  manufacturer?: string;
  firmware?: string;
  macAddress?: string;

  // Connection settings
  timeout: number;
  retryAttempts: number;

  // Timestamps
  createdAt: DateTime;
  updatedAt: DateTime;
  lastSeen?: DateTime;
}
```

### 1.2 Device Types

```typescript
enum DeviceType {
  CAMERA = 'CAMERA',           // IP cameras with face recognition
  CARD_READER = 'CARD_READER', // RFID/Card readers
  FINGERPRINT = 'FINGERPRINT', // Biometric fingerprint readers
  ANPR = 'ANPR',              // License plate recognition
  ACCESS_CONTROL = 'ACCESS_CONTROL', // Door locks, turnstiles
  OTHER = 'OTHER'
}
```

### 1.3 Device Status

```typescript
enum DeviceStatus {
  ONLINE = 'ONLINE',     // Device responding normally
  OFFLINE = 'OFFLINE',   // Device not responding
  ERROR = 'ERROR',       // Device has errors
  MAINTENANCE = 'MAINTENANCE' // Under maintenance
}
```

## 2. Device Connection Management

### 2.1 Connection Configuration

```typescript
interface DeviceConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  protocol: 'http' | 'https';
  timeout: number;        // milliseconds
  retryAttempts: number;
  keepAlive: boolean;
}
```

### 2.2 Authentication Methods

```typescript
interface DeviceAuth {
  // Basic authentication
  basic: {
    username: string;
    password: string;
  };

  // Digest authentication (for some IP cameras)
  digest?: {
    username: string;
    password: string;
    realm?: string;
  };

  // API key authentication
  apiKey?: {
    key: string;
    header: string;
  };
}
```

## 3. Device Communication Protocol

### 3.1 Standard API Endpoints

```typescript
interface DeviceAPI {
  // Health check
  '/api/health': {
    method: 'GET';
    response: {
      status: 'ok' | 'error';
      timestamp: string;
      version?: string;
    };
  };

  // Device information
  '/api/device/info': {
    method: 'GET';
    response: {
      model: string;
      manufacturer: string;
      firmware: string;
      serialNumber: string;
      capabilities: string[];
    };
  };

  // Live events
  '/api/events/live': {
    method: 'GET' | 'POST';
    response: DeviceEvent[];
  };

  // Access control
  '/api/access/open': {
    method: 'POST';
    body: {
      door?: string;
      duration?: number; // seconds
    };
  };
}
```

### 3.2 Device Event Structure

```typescript
interface DeviceEvent {
  id: string;
  deviceId: string;
  eventType: EventType;
  timestamp: DateTime;

  // Person identification
  personId?: string;
  cardNumber?: string;
  employeeCode?: string;

  // Biometric data
  fingerprint?: string; // Base64 encoded
  faceImage?: string;   // Base64 encoded

  // Location context
  doorId?: string;
  zoneId?: string;
  direction?: 'IN' | 'OUT';

  // Access result
  accessGranted: boolean;
  accessReason?: string;

  // Raw device data
  rawData?: any;
}

enum EventType {
  CARD_SCAN = 'CARD_SCAN',
  FINGERPRINT_SCAN = 'FINGERPRINT_SCAN',
  FACE_RECOGNITION = 'FACE_RECOGNITION',
  DOOR_OPEN = 'DOOR_OPEN',
  DOOR_CLOSE = 'DOOR_CLOSE',
  ALARM = 'ALARM',
  TAMPER = 'TAMPER',
  NETWORK_ERROR = 'NETWORK_ERROR'
}
```

## 4. Device Service Architecture

### 4.1 Device Manager Service

```typescript
@Injectable()
class DeviceService {
  // CRUD operations
  create(dto: CreateDeviceDto): Promise<Device>;
  findAll(organizationId: string): Promise<Device[]>;
  findOne(id: string): Promise<Device>;
  update(id: string, dto: UpdateDeviceDto): Promise<Device>;
  remove(id: string): Promise<void>;

  // Connection management
  testConnection(deviceId: string): Promise<boolean>;
  connectDevice(deviceId: string): Promise<void>;
  disconnectDevice(deviceId: string): Promise<void>;

  // Status monitoring
  checkDeviceStatus(deviceId: string): Promise<DeviceStatus>;
  updateDeviceStatus(deviceId: string, status: DeviceStatus): Promise<void>;

  // Data synchronization
  syncDeviceEvents(deviceId: string): Promise<DeviceEvent[]>;
  sendEmployeeData(deviceId: string, employees: Employee[]): Promise<void>;

  // Remote control
  openDoor(deviceId: string, options?: AccessOptions): Promise<void>;
  lockDevice(deviceId: string): Promise<void>;
  rebootDevice(deviceId: string): Promise<void>;
}
```

### 4.2 Device Connection Pool

```typescript
@Injectable()
class DeviceConnectionPool {
  private connections: Map<string, DeviceConnection> = new Map();

  async getConnection(deviceId: string): Promise<DeviceConnection>;
  async createConnection(device: Device): Promise<DeviceConnection>;
  async closeConnection(deviceId: string): Promise<void>;
  async closeAllConnections(): Promise<void>;

  // Health monitoring
  async healthCheck(): Promise<ConnectionHealth[]>;
  async reconnectFailedConnections(): Promise<void>;
}

interface DeviceConnection {
  deviceId: string;
  client: AxiosInstance;
  status: 'connected' | 'disconnected' | 'error';
  lastActivity: DateTime;
  reconnectAttempts: number;
}
```

## 5. Device Data Synchronization

### 5.1 Employee Sync to Device

```typescript
interface EmployeeSyncService {
  // Sync single employee
  syncEmployeeToDevice(employeeId: string, deviceId: string): Promise<void>;

  // Sync all employees to device
  syncAllEmployeesToDevice(deviceId: string): Promise<void>;

  // Sync employees by department/branch
  syncEmployeesByBranch(branchId: string, deviceId: string): Promise<void>;

  // Remove employee from device
  removeEmployeeFromDevice(employeeId: string, deviceId: string): Promise<void>;
}

interface DeviceEmployeeData {
  employeeCode: string;
  cardNumber?: string;
  fingerprints?: string[]; // Base64 encoded templates
  faceTemplates?: string[]; // Base64 encoded templates
  accessLevel: number;
  validFrom: DateTime;
  validTo?: DateTime;
  enabled: boolean;
}
```

### 5.2 Event Processing Pipeline

```typescript
@Injectable()
class DeviceEventProcessor {
  // Process raw device events
  async processRawEvent(deviceId: string, rawData: any): Promise<void>;

  // Convert to attendance record
  private async createAttendanceRecord(event: DeviceEvent): Promise<Attendance>;

  // Handle access control
  private async processAccessControl(event: DeviceEvent): Promise<void>;

  // Send notifications
  private async sendEventNotifications(event: DeviceEvent): Promise<void>;
}

// Queue job for async processing
@Processor('device-events')
class DeviceEventQueue {
  @Process('process-raw-event')
  async processRawEvent(job: Job<{deviceId: string, rawData: any}>): Promise<void>;

  @Process('sync-employee-data')
  async syncEmployeeData(job: Job<{deviceId: string, employeeId: string}>): Promise<void>;
}
```

## 6. Device Configuration Management

### 6.1 Device Settings

```typescript
interface DeviceSettings {
  // Network settings
  network: {
    dhcp: boolean;
    staticIp?: string;
    subnet?: string;
    gateway?: string;
    dns?: string[];
  };

  // Time settings
  time: {
    timezone: string;
    ntpServer?: string;
    syncInterval: number; // minutes
  };

  // Access control
  access: {
    defaultAccessLevel: number;
    allowUnknownCards: boolean;
    offlineMode: boolean;
    maxUsers: number;
  };

  // Biometric settings
  biometric?: {
    threshold: number; // 1-9
    duressFingerEnabled: boolean;
    antiPassbackEnabled: boolean;
  };

  // Event settings
  events: {
    bufferSize: number;
    uploadInterval: number; // seconds
    retryAttempts: number;
  };
}
```

### 6.2 Device Templates

```typescript
interface DeviceTemplate {
  id: string;
  name: string;
  manufacturer: string;
  model: string;

  // Default settings
  defaultSettings: DeviceSettings;

  // API endpoints mapping
  endpoints: {
    health: string;
    events: string;
    users: string;
    settings: string;
    control: string;
  };

  // Feature capabilities
  capabilities: {
    biometric: boolean;
    camera: boolean;
    accessControl: boolean;
    offlineMode: boolean;
    battery: boolean;
  };

  // Communication protocol
  protocol: {
    method: 'http' | 'sdk' | 'tcp';
    auth: 'basic' | 'digest' | 'custom';
    dataFormat: 'json' | 'xml' | 'binary';
  };
}
```

## 7. API Endpoints

### 7.1 Device Management

```http
# Get all devices
GET /api/devices
Authorization: Bearer {jwt}

# Get single device
GET /api/devices/{id}
Authorization: Bearer {jwt}

# Create device
POST /api/devices
Authorization: Bearer {jwt}
Content-Type: application/json
{
  "name": "Main Door Reader",
  "host": "192.168.1.100",
  "username": "admin",
  "password": "admin123",
  "port": 80,
  "type": "CARD_READER",
  "branchId": "branch-id"
}

# Update device
PUT /api/devices/{id}
Authorization: Bearer {jwt}

# Delete device
DELETE /api/devices/{id}
Authorization: Bearer {jwt}
```

### 7.2 Device Control

```http
# Test connection
POST /api/devices/{id}/test-connection
Authorization: Bearer {jwt}

# Get device status
GET /api/devices/{id}/status
Authorization: Bearer {jwt}

# Sync employees to device
POST /api/devices/{id}/sync-employees
Authorization: Bearer {jwt}

# Open door/access
POST /api/devices/{id}/access/open
Authorization: Bearer {jwt}
{
  "duration": 5
}

# Get device events
GET /api/devices/{id}/events?from=2024-01-01&to=2024-01-31
Authorization: Bearer {jwt}
```

## 8. Security Considerations

### 8.1 Device Authentication
- Device passwords are encrypted using AES-256
- Support for device certificates (future)
- Regular password rotation (configurable)

### 8.2 Network Security
- HTTPS communication preferred
- VPN support for remote devices
- IP whitelisting for device access

### 8.3 Data Protection
- Biometric templates are hashed before storage
- Personal data encryption at rest
- Audit logging for all device operations

## 9. Monitoring and Alerting

### 9.1 Device Health Monitoring
- Real-time connection status
- Response time monitoring
- Error rate tracking
- Storage capacity alerts

### 9.2 Event Notifications
- Device offline alerts
- Failed authentication attempts
- Hardware malfunction notifications
- Maintenance reminders
