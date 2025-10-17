import { Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as https from 'https';
import { AuthenticationMethod } from '../interfaces/device-adapter.interface';

export interface HikvisionClientConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
  ssl?: boolean;
  authMethod?: AuthenticationMethod;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface DeviceInfo {
  deviceName?: string;
  deviceID?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  isapiVersion?: string;
  deviceType?: string;
  supportsPTZ?: boolean;
  supportsRecording?: boolean;
  supportsAudio?: boolean;
  supportsMotionDetection?: boolean;
  supportsDoorControl?: boolean;
  supportsEvents?: boolean;
}

export interface SystemStatus {
  status: string;
  uptime?: number;
  temperature?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  networkConnected?: boolean;
  ipAddress?: string;
  macAddress?: string;
  signalStrength?: number;
  errors?: string[];
  warnings?: string[];
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
  category?: string;
  metadata?: Record<string, any>;
}

export class HikvisionISAPIClient {
  private readonly logger = new Logger(HikvisionISAPIClient.name);
  private readonly client: AxiosInstance;
  private readonly config: HikvisionClientConfig;
  private sessionId?: string;

  constructor(config: HikvisionClientConfig) {
    this.config = {
      timeout: 30000,
      ssl: false,
      authMethod: AuthenticationMethod.BASIC,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };

    const baseURL = `${this.config.ssl ? 'https' : 'http'}://${this.config.host}:${this.config.port}`;

    this.client = axios.create({
      baseURL,
      timeout: this.config.timeout,
      auth: {
        username: this.config.username,
        password: this.config.password,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // For self-signed certificates
      }),
    });

    this.setupInterceptors();
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    try {
      const response = await this.request('GET', '/ISAPI/System/deviceInfo');
      const data = response.data;

      return {
        deviceName: data.DeviceInfo?.deviceName,
        deviceID: data.DeviceInfo?.deviceID,
        model: data.DeviceInfo?.model,
        serialNumber: data.DeviceInfo?.serialNumber,
        firmwareVersion: data.DeviceInfo?.firmwareVersion,
        isapiVersion: data.DeviceInfo?.isapiVersion,
        deviceType: data.DeviceInfo?.deviceType,
        supportsPTZ: this.checkCapability(data, 'PTZ'),
        supportsRecording: this.checkCapability(data, 'Recording'),
        supportsAudio: this.checkCapability(data, 'Audio'),
        supportsMotionDetection: this.checkCapability(data, 'MotionDetection'),
        supportsDoorControl: this.checkCapability(data, 'AccessControl'),
        supportsEvents: this.checkCapability(data, 'Event'),
      };
    } catch (error) {
      this.logger.error(`Failed to get device info: ${error.message}`);
      throw new Error(`Failed to get device info: ${error.message}`);
    }
  }

  async getSystemStatus(): Promise<SystemStatus> {
    try {
      const [deviceStatus, systemInfo] = await Promise.allSettled([
        this.request('GET', '/ISAPI/System/status'),
        this.request('GET', '/ISAPI/System/deviceInfo'),
      ]);

      const status: SystemStatus = {
        status: 'online',
        networkConnected: true,
      };

      if (deviceStatus.status === 'fulfilled') {
        const statusData = deviceStatus.value.data;
        status.uptime = statusData.DeviceStatus?.upTime;
        status.temperature = statusData.DeviceStatus?.temperature;
        status.cpuUsage = statusData.DeviceStatus?.cpuUsage;
        status.memoryUsage = statusData.DeviceStatus?.memoryUsage;
        status.diskUsage = statusData.DeviceStatus?.diskUsage;
      }

      if (systemInfo.status === 'fulfilled') {
        const infoData = systemInfo.value.data;
        status.ipAddress = infoData.DeviceInfo?.ipAddress;
        status.macAddress = infoData.DeviceInfo?.macAddress;
      }

      return status;
    } catch (error) {
      this.logger.error(`Failed to get system status: ${error.message}`);
      throw new Error(`Failed to get system status: ${error.message}`);
    }
  }

  async reboot(): Promise<{ success: boolean; message: string }> {
    try {
      await this.request('PUT', '/ISAPI/System/reboot');
      return {
        success: true,
        message: 'Device reboot initiated',
      };
    } catch (error) {
      this.logger.error(`Failed to reboot device: ${error.message}`);
      throw new Error(`Failed to reboot device: ${error.message}`);
    }
  }

  async captureImage(params: any): Promise<{ success: boolean; imageUrl?: string; imageData?: Buffer }> {
    try {
      const channel = params.channel || 1;
      const response = await this.request('GET', `/ISAPI/Streaming/channels/${channel}/picture`, {
        responseType: 'arraybuffer',
      });

      return {
        success: true,
        imageData: Buffer.from(response.data),
      };
    } catch (error) {
      this.logger.error(`Failed to capture image: ${error.message}`);
      throw new Error(`Failed to capture image: ${error.message}`);
    }
  }

  async startRecording(params: any): Promise<{ success: boolean; recordingId?: string }> {
    try {
      const channel = params.channel || 1;
      const recordingConfig = {
        enabled: true,
        streamType: params.streamType || 'mainStream',
        recordType: params.recordType || 'continuous',
      };

      await this.request('PUT', `/ISAPI/ContentMgmt/record/control/manual/start/tracks/${channel}01`, {
        data: recordingConfig,
      });

      return {
        success: true,
        recordingId: `recording_${channel}_${Date.now()}`,
      };
    } catch (error) {
      this.logger.error(`Failed to start recording: ${error.message}`);
      throw new Error(`Failed to start recording: ${error.message}`);
    }
  }

  async stopRecording(params: any): Promise<{ success: boolean }> {
    try {
      const channel = params.channel || 1;
      await this.request('PUT', `/ISAPI/ContentMgmt/record/control/manual/stop/tracks/${channel}01`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to stop recording: ${error.message}`);
      throw new Error(`Failed to stop recording: ${error.message}`);
    }
  }

  async ptzControl(params: any): Promise<{ success: boolean }> {
    try {
      const channel = params.channel || 1;
      const ptzData = {
        PTZData: {
          pan: params.pan || 0,
          tilt: params.tilt || 0,
          zoom: params.zoom || 0,
          speed: params.speed || 50,
        },
      };

      await this.request('PUT', `/ISAPI/PTZCtrl/channels/${channel}/continuous`, {
        data: ptzData,
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to control PTZ: ${error.message}`);
      throw new Error(`Failed to control PTZ: ${error.message}`);
    }
  }

  async doorControl(params: any): Promise<{ success: boolean }> {
    try {
      const doorId = params.doorId || 1;
      const action = params.action || 'open'; // open, close, lock, unlock

      const controlData = {
        RemoteControlDoor: {
          cmd: action,
        },
      };

      await this.request('PUT', `/ISAPI/AccessControl/RemoteControl/door/${doorId}`, {
        data: controlData,
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to control door: ${error.message}`);
      throw new Error(`Failed to control door: ${error.message}`);
    }
  }

  async getDoorStatus(params: any): Promise<{ status: string; locked: boolean; lastAccess?: Date }> {
    try {
      const doorId = params.doorId || 1;
      const response = await this.request('GET', `/ISAPI/AccessControl/Door/${doorId}/status`);
      
      const doorData = response.data.DoorStatus;
      
      return {
        status: doorData.doorState || 'unknown',
        locked: doorData.locked === 'true',
        lastAccess: doorData.lastAccessTime ? new Date(doorData.lastAccessTime) : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to get door status: ${error.message}`);
      throw new Error(`Failed to get door status: ${error.message}`);
    }
  }

  async getEvents(params: any): Promise<any[]> {
    try {
      const startTime = params.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endTime = params.endTime || new Date();
      const maxResults = params.maxResults || 100;

      const searchParams = {
        searchID: `search_${Date.now()}`,
        searchResultPosition: 0,
        maxResults,
        metadataList: {
          metadataDescriptor: {
            fieldIDList: {
              fieldID: [1, 2, 3], // Event type, time, description
            },
          },
        },
        timeSpanList: {
          timeSpan: {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          },
        },
      };

      const response = await this.request('POST', '/ISAPI/ContentMgmt/search', {
        data: searchParams,
      });

      return response.data.matchList?.searchMatchItem || [];
    } catch (error) {
      this.logger.error(`Failed to get events: ${error.message}`);
      throw new Error(`Failed to get events: ${error.message}`);
    }
  }

  async setConfiguration(params: any): Promise<{ success: boolean }> {
    try {
      const configPath = params.configPath || '/ISAPI/System/deviceInfo';
      const configData = params.configData;

      await this.request('PUT', configPath, { data: configData });

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to set configuration: ${error.message}`);
      throw new Error(`Failed to set configuration: ${error.message}`);
    }
  }

  async getConfiguration(params: any): Promise<any> {
    try {
      const configPath = params.configPath || '/ISAPI/System/deviceInfo';
      const response = await this.request('GET', configPath);

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get configuration: ${error.message}`);
      throw new Error(`Failed to get configuration: ${error.message}`);
    }
  }

  async getLogs(options: {
    startTime?: Date;
    endTime?: Date;
    logLevel?: string;
    maxEntries?: number;
    filter?: string;
  }): Promise<LogEntry[]> {
    try {
      const searchParams = {
        searchID: `log_search_${Date.now()}`,
        searchResultPosition: 0,
        maxResults: options.maxEntries || 1000,
        logList: {
          searchResultPosition: 0,
          maxResults: options.maxEntries || 1000,
        },
      };

      if (options.startTime || options.endTime) {
        searchParams['timeSpanList'] = {
          timeSpan: {
            startTime: (options.startTime || new Date(0)).toISOString(),
            endTime: (options.endTime || new Date()).toISOString(),
          },
        };
      }

      const response = await this.request('POST', '/ISAPI/ContentMgmt/logSearch', {
        data: searchParams,
      });

      const logs = response.data.LogList?.LogInfo || [];
      
      return logs.map((log: any) => ({
        timestamp: log.time,
        level: log.type || 'info',
        message: log.description || '',
        source: 'hikvision-device',
        category: log.majorType,
        metadata: {
          minorType: log.minorType,
          channel: log.channel,
        },
      }));
    } catch (error) {
      this.logger.error(`Failed to get logs: ${error.message}`);
      return []; // Return empty array instead of throwing
    }
  }

  async disconnect(): Promise<void> {
    // Hikvision ISAPI doesn't require explicit disconnection
    // Just clear any session data
    this.sessionId = undefined;
    this.logger.debug('Disconnected from Hikvision device');
  }

  private async request(method: string, path: string, options: AxiosRequestConfig = {}): Promise<any> {
    const config: AxiosRequestConfig = {
      method: method as any,
      url: path,
      ...options,
    };

    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts!; attempt++) {
      try {
        const response = await this.client.request(config);
        return response;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retryAttempts!) {
          this.logger.warn(`Request failed (attempt ${attempt}/${this.config.retryAttempts}): ${error.message}`);
          await this.delay(this.config.retryDelay! * attempt);
        }
      }
    }

    throw lastError!;
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug(`ISAPI Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error(`ISAPI Request Error: ${error.message}`);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug(`ISAPI Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        if (error.response) {
          this.logger.error(`ISAPI Response Error: ${error.response.status} ${error.response.statusText}`);
        } else if (error.request) {
          this.logger.error(`ISAPI Network Error: ${error.message}`);
        } else {
          this.logger.error(`ISAPI Error: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  private checkCapability(deviceData: any, capability: string): boolean {
    // Check if device supports specific capability
    const capabilities = deviceData.DeviceInfo?.supportList?.supportListItem || [];
    return capabilities.some((item: any) => 
      item.supportType?.toLowerCase().includes(capability.toLowerCase())
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}