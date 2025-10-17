export interface IDeviceAdapter {
  /**
   * Unique identifier for the adapter
   */
  readonly id: string;

  /**
   * Human-readable name of the adapter
   */
  readonly name: string;

  /**
   * Version of the adapter
   */
  readonly version: string;

  /**
   * Supported device types/models
   */
  readonly supportedDevices: string[];

  /**
   * Adapter capabilities
   */
  readonly capabilities: AdapterCapabilities;

  /**
   * Connect to a device
   */
  connect(deviceConfig: DeviceConfiguration): Promise<ConnectionResult>;

  /**
   * Disconnect from a device
   */
  disconnect(deviceId: string): Promise<void>;

  /**
   * Get device status
   */
  getStatus(deviceId: string): Promise<DeviceStatus>;

  /**
   * Execute a command on the device
   */
  executeCommand(deviceId: string, command: DeviceCommand): Promise<CommandResult>;

  /**
   * Fetch logs from the device
   */
  fetchLogs(deviceId: string, options?: LogFetchOptions): Promise<DeviceLog[]>;

  /**
   * Subscribe to device events
   */
  subscribe(deviceId: string, eventTypes: string[], callback: EventCallback): Promise<SubscriptionHandle>;

  /**
   * Unsubscribe from device events
   */
  unsubscribe(subscriptionHandle: SubscriptionHandle): Promise<void>;

  /**
   * Discover devices on the network
   */
  discoverDevices(discoveryOptions?: DiscoveryOptions): Promise<DiscoveredDevice[]>;

  /**
   * Validate device configuration
   */
  validateConfiguration(config: DeviceConfiguration): Promise<ValidationResult>;

  /**
   * Get adapter health status
   */
  getHealth(): Promise<AdapterHealth>;

  /**
   * Initialize the adapter
   */
  initialize(config: AdapterConfiguration): Promise<void>;

  /**
   * Shutdown the adapter gracefully
   */
  shutdown(): Promise<void>;
}

export interface AdapterCapabilities {
  /**
   * Supported connection types
   */
  connectionTypes: ConnectionType[];

  /**
   * Supported authentication methods
   */
  authenticationMethods: AuthenticationMethod[];

  /**
   * Supported commands
   */
  supportedCommands: string[];

  /**
   * Event types the adapter can subscribe to
   */
  supportedEvents: string[];

  /**
   * Whether the adapter supports device discovery
   */
  supportsDiscovery: boolean;

  /**
   * Whether the adapter supports real-time events
   */
  supportsRealTimeEvents: boolean;

  /**
   * Whether the adapter supports log fetching
   */
  supportsLogFetching: boolean;

  /**
   * Maximum number of concurrent connections
   */
  maxConcurrentConnections: number;
}

export interface DeviceConfiguration {
  deviceId: string;
  deviceType: string;
  connectionConfig: ConnectionConfiguration;
  authConfig: AuthenticationConfiguration;
  settings: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ConnectionConfiguration {
  type: ConnectionType;
  host: string;
  port: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  ssl?: SSLConfiguration;
}

export interface SSLConfiguration {
  enabled: boolean;
  certificatePath?: string;
  keyPath?: string;
  caPath?: string;
  verifyPeer?: boolean;
}

export interface AuthenticationConfiguration {
  method: AuthenticationMethod;
  username?: string;
  password?: string;
  apiKey?: string;
  certificate?: string;
  token?: string;
  customAuth?: Record<string, any>;
}

export interface ConnectionResult {
  success: boolean;
  deviceId: string;
  connectionId: string;
  deviceInfo?: DeviceInfo;
  error?: string;
  metadata?: Record<string, any>;
}

export interface DeviceInfo {
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  serialNumber: string;
  capabilities: string[];
  status: DeviceStatusType;
  lastSeen: Date;
}

export interface DeviceStatus {
  deviceId: string;
  status: DeviceStatusType;
  lastSeen: Date;
  uptime?: number;
  temperature?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  networkStatus?: NetworkStatus;
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, any>;
}

export interface NetworkStatus {
  connected: boolean;
  ipAddress?: string;
  macAddress?: string;
  signalStrength?: number;
  bandwidth?: number;
  latency?: number;
}

export interface DeviceCommand {
  type: string;
  parameters: Record<string, any>;
  timeout?: number;
  priority?: CommandPriority;
  metadata?: Record<string, any>;
}

export interface CommandResult {
  success: boolean;
  commandId: string;
  result?: any;
  error?: string;
  executionTime: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface LogFetchOptions {
  startTime?: Date;
  endTime?: Date;
  logLevel?: LogLevel;
  maxEntries?: number;
  filter?: string;
  includeMetadata?: boolean;
}

export interface DeviceLog {
  timestamp: Date;
  level: LogLevel;
  message: string;
  source: string;
  deviceId: string;
  category?: string;
  metadata?: Record<string, any>;
}

export interface DiscoveryOptions {
  networkRange?: string;
  timeout?: number;
  maxDevices?: number;
  deviceTypes?: string[];
  includeOffline?: boolean;
}

export interface DiscoveredDevice {
  deviceId: string;
  deviceType: string;
  manufacturer: string;
  model: string;
  ipAddress: string;
  macAddress?: string;
  firmwareVersion?: string;
  status: DeviceStatusType;
  capabilities: string[];
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface AdapterHealth {
  status: HealthStatus;
  connectedDevices: number;
  totalConnections: number;
  errorRate: number;
  averageResponseTime: number;
  lastHealthCheck: Date;
  issues: HealthIssue[];
  metrics: HealthMetrics;
}

export interface HealthIssue {
  severity: IssueSeverity;
  message: string;
  code: string;
  timestamp: Date;
  deviceId?: string;
}

export interface HealthMetrics {
  connectionsPerSecond: number;
  commandsPerSecond: number;
  eventsPerSecond: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
}

export interface AdapterConfiguration {
  adapterId: string;
  name: string;
  version: string;
  enabled: boolean;
  settings: Record<string, any>;
  connectionPoolSize?: number;
  healthCheckInterval?: number;
  logLevel?: LogLevel;
  metadata?: Record<string, any>;
}

export interface SubscriptionHandle {
  id: string;
  deviceId: string;
  eventTypes: string[];
  callback: EventCallback;
  createdAt: Date;
}

export type EventCallback = (event: DeviceEvent) => void | Promise<void>;

export interface DeviceEvent {
  eventId: string;
  deviceId: string;
  eventType: string;
  timestamp: Date;
  data: any;
  severity?: EventSeverity;
  metadata?: Record<string, any>;
}

// Enums
export enum ConnectionType {
  TCP = 'tcp',
  UDP = 'udp',
  HTTP = 'http',
  HTTPS = 'https',
  WEBSOCKET = 'websocket',
  SERIAL = 'serial',
  MODBUS = 'modbus',
  SNMP = 'snmp',
}

export enum AuthenticationMethod {
  NONE = 'none',
  BASIC = 'basic',
  DIGEST = 'digest',
  API_KEY = 'api_key',
  CERTIFICATE = 'certificate',
  TOKEN = 'token',
  OAUTH2 = 'oauth2',
  CUSTOM = 'custom',
}

export enum DeviceStatusType {
  ONLINE = 'online',
  OFFLINE = 'offline',
  CONNECTING = 'connecting',
  DISCONNECTING = 'disconnecting',
  ERROR = 'error',
  MAINTENANCE = 'maintenance',
  UNKNOWN = 'unknown',
}

export enum CommandPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown',
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum EventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}