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
  LogLevel,
  HealthStatus,
  IssueSeverity,
} from '../interfaces/device-adapter.interface';
import { ZKTecoSDKClient } from './zkteco-sdk.client';
import { ZKTecoUserManager } from './zkteco-user.service';
import { ZKTecoEventProcessor } from './zkteco-event.service';
import { ZKTecoDeviceDiscovery } from './zkteco-discovery.service';

export class ZKTecoAdapter implements IDeviceAdapter {
  readonly id = 'zkteco-adapter';
  readonly name = 'ZKTeco Device Adapter';
  readonly version = '1.0.0';
  readonly supportedDevices = [
    'zkteco-attendance',
    'zkteco-access-control',
    'zkteco-time-attendance',
    'zkteco-biometric-reader',
    'zkteco-turnstile',
  ];

  readonly capabilities: AdapterCapabilities = {
    connectionTypes: [ConnectionType.TCP, ConnectionType.UDP],
    authenticationMethods: [AuthenticationMethod.NONE, AuthenticationMethod.BASIC],
    supportedCommands: [
      'get_device_info',
      'get_device_time',
      'set_device_time',
      'restart_device',
      'get_users',
      'add_user',
      'update_user',
      'delete_user',
      'get_attendance_records',
      'clear_attendance_records',
      'get_access_records',
      'clear_access_records',
      'enable_device',
      'disable_device',
      'get_device_status',
      'backup_data',
      'restore_data',
      'update_firmware',
    ],
    supportedEvents: [
      'user_verify',
      'user_enroll',
      'attendance_record',
      'access_granted',
      'access_denied',
      'door_open',
      'door_close',
      'alarm_triggered',
      'device_startup',
      'device_shutdown',
      'finger_enrolled',
      'face_enrolled',
    ],
    supportsDiscovery: true,
    supportsRealTimeEvents: true,
    supportsLogFetching: true,
    maxConcurrentConnections: 32,
  };

  private readonly logger = new Logger(ZKTecoAdapter.name);
  private readonly clients = new Map<string, ZKTecoSDKClient>();
  private readonly userManagers = new Map<string, ZKTecoUserManager>();
  private readonly eventProcessors = new Map<string, ZKTecoEventProcessor>();
  private readonly deviceDiscovery = new ZKTecoDeviceDiscovery();
  private configuration?: AdapterConfiguration;
  
  private healthMetrics = {
    connectionsPerSecond: 0,
    commandsPerSecond: 0,
    eventsPerSecond: 0,
    totalConnections: 0,
    successfulCommands: 0,
    failedCommands: 0,
    lastCommandTime: Date.now(),
    eventCount: 0,
    lastEventTime: Date.now(),
  };

  async initialize(config: AdapterConfiguration): Promise<void> {
    this.configuration = config;
    this.logger.log(`ZKTeco adapter initialized with config: ${config.name}`);
  }

  async shutdown(): Promise<void> {
    // Disconnect all devices
    const disconnectPromises = Array.from(this.clients.keys()).map(deviceId =>
      this.disconnect(deviceId).catch(error =>
        this.logger.error(`Failed to disconnect device ${deviceId}: ${error.message}`)
      )
    );

    await Promise.allSettled(disconnectPromises);
    
    // Clear all resources
    this.clients.clear();
    this.userManagers.clear();
    this.eventProcessors.clear();
    
    this.logger.log('ZKTeco adapter shutdown completed');
  }

  async connect(deviceConfig: DeviceConfiguration): Promise<ConnectionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Connecting to ZKTeco device: ${deviceConfig.deviceId}`);

      // Validate configuration
      const validation = await this.validateConfiguration(deviceConfig);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Create SDK client
      const client = new ZKTecoSDKClient({
        host: deviceConfig.connectionConfig.host,
        port: deviceConfig.connectionConfig.port,
        timeout: deviceConfig.connectionConfig.timeout || 30000,
        password: deviceConfig.authConfig.password,
        commKey: deviceConfig.settings.commKey || 0,
        encoding: deviceConfig.settings.encoding || 'utf8',
      });

      // Connect to device
      await client.connect();
      
      // Get device information
      const deviceInfo = await client.getDeviceInfo();
      
      // Store client and create managers
      this.clients.set(deviceConfig.deviceId, client);
      this.userManagers.set(deviceConfig.deviceId, new ZKTecoUserManager(client));
      this.eventProcessors.set(deviceConfig.deviceId, new ZKTecoEventProcessor(client, deviceConfig.deviceId));
      
      // Update metrics
      this.healthMetrics.totalConnections++;
      this.updateConnectionRate();

      const connectionResult: ConnectionResult = {
        success: true,
        deviceId: deviceConfig.deviceId,
        connectionId: `zkteco_${deviceConfig.deviceId}_${Date.now()}`,
        deviceInfo: {
          manufacturer: 'ZKTeco',
          model: deviceInfo.model || 'Unknown',
          firmwareVersion: deviceInfo.firmwareVersion || 'Unknown',
          serialNumber: deviceInfo.serialNumber || 'Unknown',
          capabilities: this.getDeviceCapabilities(deviceInfo),
          status: DeviceStatusType.ONLINE,
          lastSeen: new Date(),
        },
        metadata: {
          connectionTime: Date.now() - startTime,
          platform: deviceInfo.platform,
          deviceName: deviceInfo.deviceName,
          userCount: deviceInfo.userCount,
          recordCount: deviceInfo.recordCount,
        },
      };

      this.logger.log(`Successfully connected to ZKTeco device: ${deviceConfig.deviceId}`);
      return connectionResult;

    } catch (error) {
      this.logger.error(`Failed to connect to ZKTeco device ${deviceConfig.deviceId}: ${error.message}`);
      
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

      // Clean up managers
      this.userManagers.delete(deviceId);
      
      const eventProcessor = this.eventProcessors.get(deviceId);
      if (eventProcessor) {
        await eventProcessor.stopListening();
        this.eventProcessors.delete(deviceId);
      }

      this.logger.debug(`Disconnected from ZKTeco device: ${deviceId}`);
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
      const [deviceInfo, deviceTime] = await Promise.all([
        client.getDeviceInfo(),
        client.getDeviceTime(),
      ]);

      return {
        deviceId,
        status: client.isConnected() ? DeviceStatusType.ONLINE : DeviceStatusType.OFFLINE,
        lastSeen: new Date(),
        uptime: deviceInfo.uptime,
        networkStatus: {
          connected: client.isConnected(),
          ipAddress: deviceInfo.ipAddress,
          macAddress: deviceInfo.macAddress,
        },
        metadata: {
          deviceTime: deviceTime,
          userCount: deviceInfo.userCount,
          recordCount: deviceInfo.recordCount,
          freeSpace: deviceInfo.freeSpace,
          firmwareVersion: deviceInfo.firmwareVersion,
          platform: deviceInfo.platform,
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
        case 'get_device_info':
          result = await client.getDeviceInfo();
          break;

        case 'get_device_time':
          result = await client.getDeviceTime();
          break;

        case 'set_device_time':
          result = await client.setDeviceTime(command.parameters.time || new Date());
          break;

        case 'restart_device':
          result = await client.restartDevice();
          break;

        case 'get_users':
          const userManager = this.userManagers.get(deviceId)!;
          result = await userManager.getUsers(command.parameters);
          break;

        case 'add_user':
          const addUserManager = this.userManagers.get(deviceId)!;
          result = await addUserManager.addUser(command.parameters);
          break;

        case 'update_user':
          const updateUserManager = this.userManagers.get(deviceId)!;
          result = await updateUserManager.updateUser(command.parameters);
          break;

        case 'delete_user':
          const deleteUserManager = this.userManagers.get(deviceId)!;
          result = await deleteUserManager.deleteUser(command.parameters.userId);
          break;

        case 'get_attendance_records':
          result = await client.getAttendanceRecords(command.parameters);
          break;

        case 'clear_attendance_records':
          result = await client.clearAttendanceRecords();
          break;

        case 'get_access_records':
          result = await client.getAccessRecords(command.parameters);
          break;

        case 'clear_access_records':
          result = await client.clearAccessRecords();
          break;

        case 'enable_device':
          result = await client.enableDevice();
          break;

        case 'disable_device':
          result = await client.disableDevice();
          break;

        case 'get_device_status':
          result = await this.getStatus(deviceId);
          break;

        case 'backup_data':
          result = await client.backupData(command.parameters);
          break;

        case 'restore_data':
          result = await client.restoreData(command.parameters);
          break;

        case 'update_firmware':
          result = await client.updateFirmware(command.parameters);
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
      const records = await client.getAttendanceRecords({
        startTime: options?.startTime,
        endTime: options?.endTime,
        maxEntries: options?.maxEntries || 1000,
      });

      return records.map(record => ({
        timestamp: new Date(record.timestamp),
        level: LogLevel.INFO,
        message: `User ${record.userId} ${this.getVerifyTypeText(record.verifyType)} at ${record.timestamp}`,
        source: 'zkteco-device',
        deviceId,
        category: 'attendance',
        metadata: {
          userId: record.userId,
          verifyType: record.verifyType,
          inOutMode: record.inOutMode,
          workCode: record.workCode,
        },
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch logs for device ${deviceId}: ${error.message}`);
      throw error;
    }
  }

  async subscribe(deviceId: string, eventTypes: string[], callback: EventCallback): Promise<SubscriptionHandle> {
    const eventProcessor = this.eventProcessors.get(deviceId);
    if (!eventProcessor) {
      throw new Error(`Device not connected: ${deviceId}`);
    }

    try {
      const subscriptionId = `sub_${deviceId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await eventProcessor.subscribe(subscriptionId, eventTypes, (event) => {
        this.healthMetrics.eventCount++;
        this.updateEventRate();
        callback(event);
      });

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
    const eventProcessor = this.eventProcessors.get(subscriptionHandle.deviceId);
    if (!eventProcessor) {
      throw new Error(`Device not connected: ${subscriptionHandle.deviceId}`);
    }

    try {
      await eventProcessor.unsubscribe(subscriptionHandle.id);
      this.logger.debug(`Unsubscribed from events: ${subscriptionHandle.id}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe: ${error.message}`);
      throw error;
    }
  }

  async discoverDevices(discoveryOptions?: DiscoveryOptions): Promise<DiscoveredDevice[]> {
    try {
      this.logger.debug('Starting ZKTeco device discovery');
      
      const devices = await this.deviceDiscovery.discover({
        networkRange: discoveryOptions?.networkRange,
        timeout: discoveryOptions?.timeout || 30000,
        maxDevices: discoveryOptions?.maxDevices || 100,
        includeOffline: discoveryOptions?.includeOffline || false,
      });

      return devices.map(device => ({
        deviceId: device.serialNumber || device.ipAddress,
        deviceType: this.mapDeviceType(device.deviceType),
        manufacturer: 'ZKTeco',
        model: device.model,
        ipAddress: device.ipAddress,
        macAddress: device.macAddress,
        firmwareVersion: device.firmwareVersion,
        status: device.online ? DeviceStatusType.ONLINE : DeviceStatusType.OFFLINE,
        capabilities: this.getDeviceCapabilities(device),
        metadata: {
          platform: device.platform,
          deviceName: device.deviceName,
          userCount: device.userCount,
          recordCount: device.recordCount,
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

    // Validate device type
    if (!this.supportedDevices.includes(config.deviceType)) {
      errors.push({ field: 'deviceType', message: `Unsupported device type: ${config.deviceType}`, code: 'UNSUPPORTED_DEVICE_TYPE' });
    }

    // ZKTeco specific validations
    if (config.settings.commKey !== undefined && (config.settings.commKey < 0 || config.settings.commKey > 999999)) {
      errors.push({ field: 'settings.commKey', message: 'Communication key must be between 0 and 999999', code: 'INVALID_COMM_KEY' });
    }

    // Warnings
    if (config.connectionConfig.timeout && config.connectionConfig.timeout < 5000) {
      warnings.push({ field: 'connectionConfig.timeout', message: 'Timeout is very low, may cause connection issues', code: 'LOW_TIMEOUT' });
    }

    if (!config.authConfig.password) {
      warnings.push({ field: 'authConfig.password', message: 'No password set, device may reject connection', code: 'NO_PASSWORD' });
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
    const averageResponseTime = 200; // Mock value

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

  private mapDeviceType(deviceType: string): string {
    const typeMap: Record<string, string> = {
      'attendance': 'zkteco-attendance',
      'access_control': 'zkteco-access-control',
      'time_attendance': 'zkteco-time-attendance',
      'biometric': 'zkteco-biometric-reader',
      'turnstile': 'zkteco-turnstile',
    };

    return typeMap[deviceType?.toLowerCase()] || 'zkteco-attendance';
  }

  private getDeviceCapabilities(deviceInfo: any): string[] {
    const capabilities: string[] = [];

    if (deviceInfo.supportsFinger) capabilities.push('fingerprint_verification');
    if (deviceInfo.supportsFace) capabilities.push('face_verification');
    if (deviceInfo.supportsCard) capabilities.push('card_verification');
    if (deviceInfo.supportsPassword) capabilities.push('password_verification');
    if (deviceInfo.supportsAttendance) capabilities.push('attendance_tracking');
    if (deviceInfo.supportsAccessControl) capabilities.push('access_control');
    if (deviceInfo.supportsRealTime) capabilities.push('real_time_events');

    return capabilities;
  }

  private getVerifyTypeText(verifyType: number): string {
    const verifyTypes: Record<number, string> = {
      0: 'password',
      1: 'fingerprint',
      2: 'card',
      3: 'password+fingerprint',
      4: 'password+card',
      5: 'fingerprint+card',
      15: 'face',
    };

    return verifyTypes[verifyType] || 'unknown';
  }

  private updateConnectionRate(): void {
    // Simplified rate calculation
    this.healthMetrics.connectionsPerSecond = this.healthMetrics.totalConnections / 60;
  }

  private updateCommandRate(): void {
    const now = Date.now();
    const timeDiff = (now - this.healthMetrics.lastCommandTime) / 1000;
    this.healthMetrics.commandsPerSecond = 1 / timeDiff;
    this.healthMetrics.lastCommandTime = now;
  }

  private updateEventRate(): void {
    const now = Date.now();
    const timeDiff = (now - this.healthMetrics.lastEventTime) / 1000;
    this.healthMetrics.eventsPerSecond = 1 / timeDiff;
    this.healthMetrics.lastEventTime = now;
  }
}