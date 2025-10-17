import { Logger } from '@nestjs/common';
import {
  IDeviceAdapter,
  AdapterCapabilities,
  DeviceConfiguration,
  ConnectionResult,
  DeviceStatus,
  DeviceCommand,
  CommandResult,
  LogFetchOptions,
  DeviceLog,
  SubscriptionHandle,
  EventCallback,
  DiscoveryOptions,
  DiscoveredDevice,
  ValidationResult,
  AdapterHealth,
  AdapterConfiguration,
  ConnectionType,
  AuthenticationMethod,
  DeviceStatusType,
  CommandPriority,
  LogLevel,
  HealthStatus,
  IssueSeverity,
} from '../interfaces/device-adapter.interface';
import { HikvisionISAPIClient } from './hikvision-isapi.client';
import { HikvisionDeviceDiscovery } from './hikvision-discovery.service';
import { HikvisionEventSubscription } from './hikvision-event.service';

export class HikvisionAdapter implements IDeviceAdapter {
  readonly id = 'hikvision-adapter';
  readonly name = 'Hikvision Device Adapter';
  readonly version = '1.0.0';
  readonly supportedDevices = [
    'hikvision-camera',
    'hikvision-nvr',
    'hikvision-dvr',
    'hikvision-access-control',
    'hikvision-intercom',
  ];

  readonly capabilities: AdapterCapabilities = {
    connectionTypes: [ConnectionType.HTTP, ConnectionType.HTTPS],
    authenticationMethods: [AuthenticationMethod.BASIC, AuthenticationMethod.DIGEST],
    supportedCommands: [
      'reboot',
      'get_device_info',
      'get_system_status',
      'capture_image',
      'start_recording',
      'stop_recording',
      'ptz_control',
      'door_control',
      'get_door_status',
      'get_events',
      'set_configuration',
      'get_configuration',
    ],
    supportedEvents: [
      'motion_detection',
      'line_crossing',
      'intrusion_detection',
      'face_detection',
      'door_open',
      'door_close',
      'access_granted',
      'access_denied',
      'alarm_triggered',
      'device_offline',
      'device_online',
    ],
    supportsDiscovery: true,
    supportsRealTimeEvents: true,
    supportsLogFetching: true,
    maxConcurrentConnections: 50,
  };

  private readonly logger = new Logger(HikvisionAdapter.name);
  private readonly clients = new Map<string, HikvisionISAPIClient>();
  private readonly subscriptions = new Map<string, HikvisionEventSubscription>();
  private readonly deviceDiscovery = new HikvisionDeviceDiscovery();
  private configuration?: AdapterConfiguration;
  private healthMetrics = {
    connectionsPerSecond: 0,
    commandsPerSecond: 0,
    eventsPerSecond: 0,
    totalConnections: 0,
    successfulCommands: 0,
    failedCommands: 0,
    lastCommandTime: Date.now(),
  };

  async initialize(config: AdapterConfiguration): Promise<void> {
    this.configuration = config;
    this.logger.log(`Hikvision adapter initialized with config: ${config.name}`);
  }

  async shutdown(): Promise<void> {
    // Disconnect all devices
    const disconnectPromises = Array.from(this.clients.keys()).map(deviceId =>
      this.disconnect(deviceId).catch(error =>
        this.logger.error(`Failed to disconnect device ${deviceId}: ${error.message}`)
      )
    );

    await Promise.allSettled(disconnectPromises);
    
    // Clear all subscriptions
    this.subscriptions.clear();
    
    this.logger.log('Hikvision adapter shutdown completed');
  }

  async connect(deviceConfig: DeviceConfiguration): Promise<ConnectionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Connecting to Hikvision device: ${deviceConfig.deviceId}`);

      // Validate configuration
      const validation = await this.validateConfiguration(deviceConfig);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Create ISAPI client
      const client = new HikvisionISAPIClient({
        host: deviceConfig.connectionConfig.host,
        port: deviceConfig.connectionConfig.port,
        username: deviceConfig.authConfig.username!,
        password: deviceConfig.authConfig.password!,
        timeout: deviceConfig.connectionConfig.timeout || 30000,
        ssl: deviceConfig.connectionConfig.ssl?.enabled || false,
        authMethod: deviceConfig.authConfig.method,
      });

      // Test connection and get device info
      const deviceInfo = await client.getDeviceInfo();
      
      // Store client
      this.clients.set(deviceConfig.deviceId, client);
      
      // Update metrics
      this.healthMetrics.totalConnections++;
      this.updateConnectionRate();

      const connectionResult: ConnectionResult = {
        success: true,
        deviceId: deviceConfig.deviceId,
        connectionId: `hikvision_${deviceConfig.deviceId}_${Date.now()}`,
        deviceInfo: {
          manufacturer: 'Hikvision',
          model: deviceInfo.model || 'Unknown',
          firmwareVersion: deviceInfo.firmwareVersion || 'Unknown',
          serialNumber: deviceInfo.serialNumber || 'Unknown',
          capabilities: this.getDeviceCapabilities(deviceInfo),
          status: DeviceStatusType.ONLINE,
          lastSeen: new Date(),
        },
        metadata: {
          connectionTime: Date.now() - startTime,
          isapiVersion: deviceInfo.isapiVersion,
          deviceType: deviceInfo.deviceType,
        },
      };

      this.logger.log(`Successfully connected to Hikvision device: ${deviceConfig.deviceId}`);
      return connectionResult;

    } catch (error) {
      this.logger.error(`Failed to connect to Hikvision device ${deviceConfig.deviceId}: ${error.message}`);
      
      return {
        success: false,
        deviceId: deviceConfig.deviceId,
        connectionId: '',
        error: error.message,
        metadata: {
          connectionTime: Date.now() - startTime,
        },
      };
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    try {
      const client = this.clients.get(deviceId);
      if (client) {
        await client.disconnect();
        this.clients.delete(deviceId);
      }

      // Remove any subscriptions for this device
      const deviceSubscriptions = Array.from(this.subscriptions.entries())
        .filter(([_, sub]) => sub.deviceId === deviceId);
      
      for (const [subId, subscription] of deviceSubscriptions) {
        await subscription.unsubscribe();
        this.subscriptions.delete(subId);
      }

      this.logger.debug(`Disconnected from Hikvision device: ${deviceId}`);
    } catch (error) {
      this.logger.error(`Error disconnecting from device ${deviceId}: ${error.message}`);
      throw error;
    }
  }

  async getStatus(deviceId: string): Promise<DeviceStatus> {
    const client = this.clients.get(deviceId);
    if (!client) {
      throw new Error(`Device not connected: ${deviceId}`);
    }

    try {
      const [deviceInfo, systemStatus] = await Promise.all([
        client.getDeviceInfo(),
        client.getSystemStatus(),
      ]);

      return {
        deviceId,
        status: this.mapDeviceStatus(systemStatus.status),
        lastSeen: new Date(),
        uptime: systemStatus.uptime,
        temperature: systemStatus.temperature,
        cpuUsage: systemStatus.cpuUsage,
        memoryUsage: systemStatus.memoryUsage,
        diskUsage: systemStatus.diskUsage,
        networkStatus: {
          connected: systemStatus.networkConnected,
          ipAddress: systemStatus.ipAddress,
          macAddress: systemStatus.macAddress,
          signalStrength: systemStatus.signalStrength,
        },
        errors: systemStatus.errors || [],
        warnings: systemStatus.warnings || [],
        metadata: {
          firmwareVersion: deviceInfo.firmwareVersion,
          model: deviceInfo.model,
          serialNumber: deviceInfo.serialNumber,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get status for device ${deviceId}: ${error.message}`);
      throw error;
    }
  }

  async executeCommand(deviceId: string, command: DeviceCommand): Promise<CommandResult> {
    const startTime = Date.now();
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const client = this.clients.get(deviceId);
      if (!client) {
        throw new Error(`Device not connected: ${deviceId}`);
      }

      this.logger.debug(`Executing command ${command.type} on device ${deviceId}`);

      let result: any;

      switch (command.type) {
        case 'reboot':
          result = await client.reboot();
          break;

        case 'get_device_info':
          result = await client.getDeviceInfo();
          break;

        case 'get_system_status':
          result = await client.getSystemStatus();
          break;

        case 'capture_image':
          result = await client.captureImage(command.parameters);
          break;

        case 'start_recording':
          result = await client.startRecording(command.parameters);
          break;

        case 'stop_recording':
          result = await client.stopRecording(command.parameters);
          break;

        case 'ptz_control':
          result = await client.ptzControl(command.parameters);
          break;

        case 'door_control':
          result = await client.doorControl(command.parameters);
          break;

        case 'get_door_status':
          result = await client.getDoorStatus(command.parameters);
          break;

        case 'get_events':
          result = await client.getEvents(command.parameters);
          break;

        case 'set_configuration':
          result = await client.setConfiguration(command.parameters);
          break;

        case 'get_configuration':
          result = await client.getConfiguration(command.parameters);
          break;

        default:
          throw new Error(`Unsupported command type: ${command.type}`);
      }

      const executionTime = Date.now() - startTime;
      
      // Update metrics
      this.healthMetrics.successfulCommands++;
      this.updateCommandRate();

      return {
        success: true,
        commandId,
        result,
        executionTime,
        timestamp: new Date(),
        metadata: {
          deviceId,
          commandType: command.type,
        },
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Update metrics
      this.healthMetrics.failedCommands++;
      this.updateCommandRate();

      this.logger.error(`Command ${command.type} failed on device ${deviceId}: ${error.message}`);

      return {
        success: false,
        commandId,
        error: error.message,
        executionTime,
        timestamp: new Date(),
        metadata: {
          deviceId,
          commandType: command.type,
        },
      };
    }
  }

  async fetchLogs(deviceId: string, options?: LogFetchOptions): Promise<DeviceLog[]> {
    const client = this.clients.get(deviceId);
    if (!client) {
      throw new Error(`Device not connected: ${deviceId}`);
    }

    try {
      const logs = await client.getLogs({
        startTime: options?.startTime,
        endTime: options?.endTime,
        logLevel: options?.logLevel,
        maxEntries: options?.maxEntries || 1000,
        filter: options?.filter,
      });

      return logs.map(log => ({
        timestamp: new Date(log.timestamp),
        level: this.mapLogLevel(log.level),
        message: log.message,
        source: log.source || 'hikvision-device',
        deviceId,
        category: log.category,
        metadata: log.metadata,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch logs for device ${deviceId}: ${error.message}`);
      throw error;
    }
  }

  async subscribe(deviceId: string, eventTypes: string[], callback: EventCallback): Promise<SubscriptionHandle> {
    const client = this.clients.get(deviceId);
    if (!client) {
      throw new Error(`Device not connected: ${deviceId}`);
    }

    try {
      const subscriptionId = `sub_${deviceId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const subscription = new HikvisionEventSubscription(
        subscriptionId,
        deviceId,
        client,
        eventTypes,
        callback
      );

      await subscription.subscribe();
      this.subscriptions.set(subscriptionId, subscription);

      return {
        id: subscriptionId,
        deviceId,
        eventTypes,
        callback,
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to subscribe to events for device ${deviceId}: ${error.message}`);
      throw error;
    }
  }

  async unsubscribe(subscriptionHandle: SubscriptionHandle): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionHandle.id);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionHandle.id}`);
    }

    try {
      await subscription.unsubscribe();
      this.subscriptions.delete(subscriptionHandle.id);
      
      this.logger.debug(`Unsubscribed from events: ${subscriptionHandle.id}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe: ${error.message}`);
      throw error;
    }
  }

  async discoverDevices(discoveryOptions?: DiscoveryOptions): Promise<DiscoveredDevice[]> {
    try {
      this.logger.debug('Starting Hikvision device discovery');
      
      const devices = await this.deviceDiscovery.discover({
        networkRange: discoveryOptions?.networkRange,
        timeout: discoveryOptions?.timeout || 30000,
        maxDevices: discoveryOptions?.maxDevices || 100,
        includeOffline: discoveryOptions?.includeOffline || false,
      });

      return devices.map(device => ({
        deviceId: device.serialNumber || device.ipAddress,
        deviceType: this.mapDeviceType(device.deviceType),
        manufacturer: 'Hikvision',
        model: device.model,
        ipAddress: device.ipAddress,
        macAddress: device.macAddress,
        firmwareVersion: device.firmwareVersion,
        status: this.mapDeviceStatus(device.status),
        capabilities: this.getDeviceCapabilities(device),
        metadata: {
          isapiVersion: device.isapiVersion,
          deviceName: device.deviceName,
          discoveryMethod: device.discoveryMethod,
        },
      }));
    } catch (error) {
      this.logger.error(`Device discovery failed: ${error.message}`);
      throw error;
    }
  }

  async validateConfiguration(config: DeviceConfiguration): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Validate connection configuration
    if (!config.connectionConfig.host) {
      errors.push({ field: 'connectionConfig.host', message: 'Host is required', code: 'MISSING_HOST' });
    }

    if (!config.connectionConfig.port || config.connectionConfig.port < 1 || config.connectionConfig.port > 65535) {
      errors.push({ field: 'connectionConfig.port', message: 'Valid port number is required', code: 'INVALID_PORT' });
    }

    // Validate authentication
    if (!config.authConfig.username) {
      errors.push({ field: 'authConfig.username', message: 'Username is required', code: 'MISSING_USERNAME' });
    }

    if (!config.authConfig.password) {
      errors.push({ field: 'authConfig.password', message: 'Password is required', code: 'MISSING_PASSWORD' });
    }

    // Validate device type
    if (!this.supportedDevices.includes(config.deviceType)) {
      errors.push({ field: 'deviceType', message: `Unsupported device type: ${config.deviceType}`, code: 'UNSUPPORTED_DEVICE_TYPE' });
    }

    // Warnings
    if (config.connectionConfig.timeout && config.connectionConfig.timeout < 5000) {
      warnings.push({ field: 'connectionConfig.timeout', message: 'Timeout is very low, may cause connection issues', code: 'LOW_TIMEOUT' });
    }

    if (!config.connectionConfig.ssl?.enabled) {
      warnings.push({ field: 'connectionConfig.ssl', message: 'SSL is not enabled, connection may not be secure', code: 'NO_SSL' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async getHealth(): Promise<AdapterHealth> {
    const connectedDevices = this.clients.size;
    const totalCommands = this.healthMetrics.successfulCommands + this.healthMetrics.failedCommands;
    const errorRate = totalCommands > 0 ? (this.healthMetrics.failedCommands / totalCommands) * 100 : 0;
    
    // Calculate average response time (simplified)
    const averageResponseTime = 150; // Mock value, would be calculated from actual metrics

    const issues: any[] = [];
    let status: HealthStatus = HealthStatus.HEALTHY;

    // Check error rate
    if (errorRate > 20) {
      status = HealthStatus.CRITICAL;
      issues.push({
        severity: IssueSeverity.CRITICAL,
        message: `High error rate: ${errorRate.toFixed(1)}%`,
        code: 'HIGH_ERROR_RATE',
        timestamp: new Date(),
      });
    } else if (errorRate > 10) {
      status = HealthStatus.WARNING;
      issues.push({
        severity: IssueSeverity.MEDIUM,
        message: `Elevated error rate: ${errorRate.toFixed(1)}%`,
        code: 'ELEVATED_ERROR_RATE',
        timestamp: new Date(),
      });
    }

    // Check connection count
    if (connectedDevices === 0) {
      if (status !== HealthStatus.CRITICAL) status = HealthStatus.WARNING;
      issues.push({
        severity: IssueSeverity.MEDIUM,
        message: 'No devices connected',
        code: 'NO_CONNECTIONS',
        timestamp: new Date(),
      });
    }

    return {
      status,
      connectedDevices,
      totalConnections: this.healthMetrics.totalConnections,
      errorRate,
      averageResponseTime,
      lastHealthCheck: new Date(),
      issues,
      metrics: {
        connectionsPerSecond: this.healthMetrics.connectionsPerSecond,
        commandsPerSecond: this.healthMetrics.commandsPerSecond,
        eventsPerSecond: this.healthMetrics.eventsPerSecond,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        cpuUsage: 0, // Would need actual CPU monitoring
        networkLatency: averageResponseTime,
      },
    };
  }

  private mapDeviceStatus(status: string): DeviceStatusType {
    switch (status?.toLowerCase()) {
      case 'online':
      case 'active':
        return DeviceStatusType.ONLINE;
      case 'offline':
      case 'inactive':
        return DeviceStatusType.OFFLINE;
      case 'connecting':
        return DeviceStatusType.CONNECTING;
      case 'error':
      case 'fault':
        return DeviceStatusType.ERROR;
      case 'maintenance':
        return DeviceStatusType.MAINTENANCE;
      default:
        return DeviceStatusType.UNKNOWN;
    }
  }

  private mapLogLevel(level: string): LogLevel {
    switch (level?.toLowerCase()) {
      case 'trace':
        return LogLevel.TRACE;
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
      case 'information':
        return LogLevel.INFO;
      case 'warn':
      case 'warning':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      case 'fatal':
      case 'critical':
        return LogLevel.FATAL;
      default:
        return LogLevel.INFO;
    }
  }

  private mapDeviceType(deviceType: string): string {
    const typeMap: Record<string, string> = {
      'ipc': 'hikvision-camera',
      'nvr': 'hikvision-nvr',
      'dvr': 'hikvision-dvr',
      'access_control': 'hikvision-access-control',
      'intercom': 'hikvision-intercom',
    };

    return typeMap[deviceType?.toLowerCase()] || 'hikvision-camera';
  }

  private getDeviceCapabilities(deviceInfo: any): string[] {
    const capabilities: string[] = [];

    if (deviceInfo.supportsPTZ) capabilities.push('ptz_control');
    if (deviceInfo.supportsRecording) capabilities.push('recording');
    if (deviceInfo.supportsAudio) capabilities.push('audio');
    if (deviceInfo.supportsMotionDetection) capabilities.push('motion_detection');
    if (deviceInfo.supportsDoorControl) capabilities.push('door_control');
    if (deviceInfo.supportsEvents) capabilities.push('event_subscription');

    return capabilities;
  }

  private updateConnectionRate(): void {
    // Simplified rate calculation
    this.healthMetrics.connectionsPerSecond = this.healthMetrics.totalConnections / 60; // Per minute average
  }

  private updateCommandRate(): void {
    const now = Date.now();
    const timeDiff = (now - this.healthMetrics.lastCommandTime) / 1000;
    this.healthMetrics.commandsPerSecond = 1 / timeDiff;
    this.healthMetrics.lastCommandTime = now;
  }
}