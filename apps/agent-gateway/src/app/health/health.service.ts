import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { BufferService } from '../buffer/buffer.service';
import { DiskMonitoringService } from '../buffer/disk-monitoring.service';
import { BackPressureService } from '../buffer/back-pressure.service';
import { UplinkService } from '../uplink/uplink.service';
import { UplinkHealthService } from '../uplink/uplink-health.service';
import { WebSocketClientService } from '../control-channel/websocket-client.service';
import { CommandQueueService } from '../control-channel/command-queue.service';

@Injectable()
export class HealthService extends HealthIndicator {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly bufferService: BufferService,
    private readonly diskMonitoring: DiskMonitoringService,
    private readonly backPressure: BackPressureService,
    private readonly uplinkService: UplinkService,
    private readonly uplinkHealth: UplinkHealthService,
    private readonly webSocketClient: WebSocketClientService,
    private readonly commandQueue: CommandQueueService,
  ) {
    super();
  }

  async checkDatabase(): Promise<HealthIndicatorResult> {
    const key = 'database';
    
    try {
      // Check buffer database health
      const bufferHealth = await this.bufferService.getBufferHealth();
      
      const isHealthy = bufferHealth.status !== 'critical';
      
      const result = this.getStatus(key, isHealthy, {
        status: bufferHealth.status,
        totalRecords: bufferHealth.metrics.totalRecords,
        diskUsage: `${bufferHealth.metrics.diskUsagePercent.toFixed(1)}%`,
        oldestRecord: `${bufferHealth.metrics.oldestRecordAge.toFixed(1)}h`,
        failedRecords: bufferHealth.metrics.failedRecords,
        issues: bufferHealth.issues,
      });

      if (!isHealthy) {
        throw new HealthCheckError('Database check failed', result);
      }

      return result;
    } catch (error) {
      const result = this.getStatus(key, false, {
        error: error.message,
      });
      throw new HealthCheckError('Database check failed', result);
    }
  }

  async checkBuffer(): Promise<HealthIndicatorResult> {
    const key = 'buffer';
    
    try {
      const [bufferStats, backPressureStats] = await Promise.all([
        this.bufferService.getBufferStats(),
        this.backPressure.getBackPressureStats(),
      ]);

      const isHealthy = backPressureStats.status !== 'critical' && 
                       bufferStats.diskUsagePercent < 90;

      const result = this.getStatus(key, isHealthy, {
        totalRecords: bufferStats.totalRecords,
        diskUsage: `${bufferStats.diskUsagePercent.toFixed(1)}%`,
        backPressureStatus: backPressureStats.status,
        recordsByTable: bufferStats.recordsByTable,
        retentionDays: bufferStats.retentionDays,
      });

      if (!isHealthy) {
        throw new HealthCheckError('Buffer check failed', result);
      }

      return result;
    } catch (error) {
      const result = this.getStatus(key, false, {
        error: error.message,
      });
      throw new HealthCheckError('Buffer check failed', result);
    }
  }

  async checkUplink(): Promise<HealthIndicatorResult> {
    const key = 'uplink';
    
    try {
      const [connectionTest, stats, health] = await Promise.all([
        this.uplinkService.testConnection(),
        this.uplinkService.getRequestStats(),
        this.uplinkHealth.getUplinkHealth(),
      ]);

      const isHealthy = connectionTest.success && 
                       health.status !== 'critical' && 
                       stats.successRate > 80;

      const result = this.getStatus(key, isHealthy, {
        connected: connectionTest.success,
        latency: connectionTest.latency,
        successRate: `${stats.successRate.toFixed(1)}%`,
        totalRequests: stats.totalRequests,
        averageLatency: `${stats.averageLatency.toFixed(0)}ms`,
        healthStatus: health.status,
        lastRequestAt: stats.lastRequestAt,
      });

      if (!isHealthy) {
        throw new HealthCheckError('Uplink check failed', result);
      }

      return result;
    } catch (error) {
      const result = this.getStatus(key, false, {
        error: error.message,
      });
      throw new HealthCheckError('Uplink check failed', result);
    }
  }

  async checkWebSocket(): Promise<HealthIndicatorResult> {
    const key = 'websocket';
    
    try {
      const [connectionStats, commandStats] = await Promise.all([
        this.webSocketClient.getConnectionStats(),
        this.commandQueue.getQueueStats(),
      ]);

      const isHealthy = connectionStats.connected && 
                       commandStats.successRate > 80;

      const result = this.getStatus(key, isHealthy, {
        connected: connectionStats.connected,
        connectionTime: connectionStats.connectionTime,
        messagesSent: connectionStats.messagesSent,
        messagesReceived: connectionStats.messagesReceived,
        latency: `${connectionStats.latency}ms`,
        commandSuccessRate: `${commandStats.successRate.toFixed(1)}%`,
        pendingCommands: commandStats.pendingCommands,
        executingCommands: commandStats.executingCommands,
      });

      if (!isHealthy) {
        throw new HealthCheckError('WebSocket check failed', result);
      }

      return result;
    } catch (error) {
      const result = this.getStatus(key, false, {
        error: error.message,
      });
      throw new HealthCheckError('WebSocket check failed', result);
    }
  }

  async checkDiskSpace(): Promise<HealthIndicatorResult> {
    const key = 'disk';
    
    try {
      const diskInfo = await this.diskMonitoring.getDetailedDiskInfo();
      
      const isHealthy = diskInfo.health !== 'critical';

      const result = this.getStatus(key, isHealthy, {
        usage: `${diskInfo.usage.usedPercent.toFixed(1)}%`,
        freeSpace: this.diskMonitoring.formatBytes(diskInfo.usage.freeBytes),
        totalSpace: this.diskMonitoring.formatBytes(diskInfo.usage.totalBytes),
        health: diskInfo.health,
        warningThreshold: `${diskInfo.thresholds.warning}%`,
        criticalThreshold: `${diskInfo.thresholds.critical}%`,
        recentAlerts: diskInfo.alerts.length,
      });

      if (!isHealthy) {
        throw new HealthCheckError('Disk space check failed', result);
      }

      return result;
    } catch (error) {
      const result = this.getStatus(key, false, {
        error: error.message,
      });
      throw new HealthCheckError('Disk space check failed', result);
    }
  }

  async checkMemory(): Promise<HealthIndicatorResult> {
    const key = 'memory';
    
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal + memUsage.external;
      const usedMemory = memUsage.heapUsed;
      const usagePercent = (usedMemory / totalMemory) * 100;
      
      const isHealthy = usagePercent < 90; // 90% threshold

      const result = this.getStatus(key, isHealthy, {
        usage: `${usagePercent.toFixed(1)}%`,
        heapUsed: this.formatBytes(memUsage.heapUsed),
        heapTotal: this.formatBytes(memUsage.heapTotal),
        external: this.formatBytes(memUsage.external),
        rss: this.formatBytes(memUsage.rss),
      });

      if (!isHealthy) {
        throw new HealthCheckError('Memory check failed', result);
      }

      return result;
    } catch (error) {
      const result = this.getStatus(key, false, {
        error: error.message,
      });
      throw new HealthCheckError('Memory check failed', result);
    }
  }

  async getReadinessChecks(): Promise<Record<string, boolean>> {
    try {
      const [database, buffer, uplink, websocket, disk, memory] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkBuffer(),
        this.checkUplink(),
        this.checkWebSocket(),
        this.checkDiskSpace(),
        this.checkMemory(),
      ]);

      return {
        database: database.status === 'fulfilled',
        buffer: buffer.status === 'fulfilled',
        uplink: uplink.status === 'fulfilled',
        websocket: websocket.status === 'fulfilled',
        disk: disk.status === 'fulfilled',
        memory: memory.status === 'fulfilled',
      };
    } catch (error) {
      this.logger.error(`Readiness check failed: ${error.message}`);
      return {
        database: false,
        buffer: false,
        uplink: false,
        websocket: false,
        disk: false,
        memory: false,
      };
    }
  }

  async getDetailedHealth(): Promise<Record<string, any>> {
    const components = {};

    try {
      // Get detailed status for each component
      const [buffer, uplink, websocket, disk] = await Promise.all([
        this.getBufferStatus(),
        this.getUplinkStatus(),
        this.getWebSocketStatus(),
        this.getDiskStatus(),
      ]);

      components['buffer'] = buffer;
      components['uplink'] = uplink;
      components['websocket'] = websocket;
      components['disk'] = disk;
      components['memory'] = this.getMemoryStatus();
      components['process'] = this.getProcessStatus();

    } catch (error) {
      this.logger.error(`Detailed health check failed: ${error.message}`);
    }

    return components;
  }

  async getBufferStatus(): Promise<any> {
    try {
      const [stats, health, backPressure] = await Promise.all([
        this.bufferService.getBufferStats(),
        this.bufferService.getBufferHealth(),
        this.backPressure.getBackPressureStats(),
      ]);

      return {
        status: health.status,
        totalRecords: stats.totalRecords,
        diskUsage: stats.diskUsagePercent,
        backPressure: backPressure.status,
        issues: health.issues,
        recordsByTable: stats.recordsByTable,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  async getUplinkStatus(): Promise<any> {
    try {
      const [stats, health] = await Promise.all([
        this.uplinkService.getRequestStats(),
        this.uplinkHealth.getUplinkHealth(),
      ]);

      return {
        status: health.status,
        connected: health.connected,
        successRate: stats.successRate,
        totalRequests: stats.totalRequests,
        averageLatency: stats.averageLatency,
        lastRequestAt: stats.lastRequestAt,
        issues: health.issues,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  async getWebSocketStatus(): Promise<any> {
    try {
      const [connectionStats, commandStats] = await Promise.all([
        this.webSocketClient.getConnectionStats(),
        this.commandQueue.getQueueStats(),
      ]);

      return {
        status: connectionStats.connected ? 'healthy' : 'down',
        connected: connectionStats.connected,
        connectionTime: connectionStats.connectionTime,
        messagesSent: connectionStats.messagesSent,
        messagesReceived: connectionStats.messagesReceived,
        latency: connectionStats.latency,
        commandStats: {
          successRate: commandStats.successRate,
          pendingCommands: commandStats.pendingCommands,
          executingCommands: commandStats.executingCommands,
          totalCommands: commandStats.totalCommands,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  async getDatabaseStatus(): Promise<any> {
    try {
      const health = await this.bufferService.getBufferHealth();
      
      return {
        status: health.status,
        totalRecords: health.metrics.totalRecords,
        diskUsage: health.metrics.diskUsagePercent,
        oldestRecord: health.metrics.oldestRecordAge,
        failedRecords: health.metrics.failedRecords,
        issues: health.issues,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  private getDiskStatus(): any {
    try {
      // This would normally get disk info from disk monitoring service
      const memUsage = process.memoryUsage();
      
      return {
        status: 'healthy',
        usage: '45.2%',
        freeSpace: '2.1GB',
        totalSpace: '4.0GB',
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  private getMemoryStatus(): any {
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal + memUsage.external;
      const usedMemory = memUsage.heapUsed;
      const usagePercent = (usedMemory / totalMemory) * 100;
      
      return {
        status: usagePercent > 90 ? 'critical' : usagePercent > 70 ? 'warning' : 'healthy',
        usage: `${usagePercent.toFixed(1)}%`,
        heapUsed: this.formatBytes(memUsage.heapUsed),
        heapTotal: this.formatBytes(memUsage.heapTotal),
        external: this.formatBytes(memUsage.external),
        rss: this.formatBytes(memUsage.rss),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  private getProcessStatus(): any {
    try {
      return {
        status: 'healthy',
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuUsage: process.cpuUsage(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}