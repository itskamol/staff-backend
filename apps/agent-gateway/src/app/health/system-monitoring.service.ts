import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  release: string;
  uptime: number;
  loadAverage: number[];
  totalMemory: number;
  freeMemory: number;
  cpuCount: number;
  cpuModel: string;
  nodeVersion: string;
  processId: number;
  processUptime: number;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
    processMemory: NodeJS.MemoryUsage;
  };
  disk: {
    usage: number;
    free: number;
    total: number;
    usagePercent: number;
  };
  network: {
    interfaces: Record<string, any>;
  };
  process: {
    pid: number;
    uptime: number;
    cpuUsage: NodeJS.CpuUsage;
    memoryUsage: NodeJS.MemoryUsage;
  };
}

export interface SystemAlert {
  id: string;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'process';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

@Injectable()
export class SystemMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(SystemMonitoringService.name);
  private readonly alerts = new Map<string, SystemAlert>();
  private readonly metricsHistory: SystemMetrics[] = [];
  private readonly maxHistorySize: number;
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  
  private readonly thresholds = {
    cpu: {
      warning: 70,
      critical: 90,
    },
    memory: {
      warning: 80,
      critical: 95,
    },
    disk: {
      warning: 85,
      critical: 95,
    },
  };

  constructor(private readonly config: ConfigService) {
    this.maxHistorySize = parseInt(this.config.get('SYSTEM_METRICS_HISTORY_SIZE', '1440')); // 24 hours at 1min intervals
    
    // Override thresholds from config
    this.thresholds.cpu.warning = parseInt(this.config.get('SYSTEM_CPU_WARNING_THRESHOLD', '70'));
    this.thresholds.cpu.critical = parseInt(this.config.get('SYSTEM_CPU_CRITICAL_THRESHOLD', '90'));
    this.thresholds.memory.warning = parseInt(this.config.get('SYSTEM_MEMORY_WARNING_THRESHOLD', '80'));
    this.thresholds.memory.critical = parseInt(this.config.get('SYSTEM_MEMORY_CRITICAL_THRESHOLD', '95'));
    this.thresholds.disk.warning = parseInt(this.config.get('SYSTEM_DISK_WARNING_THRESHOLD', '85'));
    this.thresholds.disk.critical = parseInt(this.config.get('SYSTEM_DISK_CRITICAL_THRESHOLD', '95'));
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('System monitoring service initialized');
    
    // Initialize CPU usage baseline
    this.lastCpuUsage = process.cpuUsage();
    
    // Collect initial metrics
    await this.collectMetrics();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getCurrentSystemMetrics();
      
      // Add to history
      this.metricsHistory.push(metrics);
      
      // Trim history if needed
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }
      
      // Check for alerts
      await this.checkSystemAlerts(metrics);
      
      this.logger.debug('System metrics collected');
      
    } catch (error) {
      this.logger.error(`Failed to collect system metrics: ${error.message}`);
    }
  }

  async getCurrentSystemMetrics(): Promise<SystemMetrics> {
    const [cpuUsage, diskUsage] = await Promise.all([
      this.getCpuUsage(),
      this.getDiskUsage(),
    ]);

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    const processMemory = process.memoryUsage();
    const processCpuUsage = process.cpuUsage(this.lastCpuUsage || undefined);
    this.lastCpuUsage = process.cpuUsage();

    return {
      cpu: {
        usage: cpuUsage,
        loadAverage: os.loadavg(),
        cores: os.cpus().length,
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        usagePercent: memoryUsagePercent,
        processMemory,
      },
      disk: {
        usage: diskUsage.used,
        free: diskUsage.free,
        total: diskUsage.total,
        usagePercent: diskUsage.usagePercent,
      },
      network: {
        interfaces: os.networkInterfaces(),
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        cpuUsage: processCpuUsage,
        memoryUsage: processMemory,
      },
    };
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime(startTime);
        
        const totalTime = endTime[0] * 1000000 + endTime[1] / 1000; // microseconds
        const totalCpuTime = endUsage.user + endUsage.system; // microseconds
        
        const cpuPercent = (totalCpuTime / totalTime) * 100;
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  private async getDiskUsage(): Promise<{
    used: number;
    free: number;
    total: number;
    usagePercent: number;
  }> {
    try {
      const stats = await fs.stat(process.cwd());
      
      // This is a simplified disk usage calculation
      // In production, you'd want to use a proper disk usage library
      const total = 1024 * 1024 * 1024 * 10; // 10GB mock total
      const used = total * 0.45; // 45% mock usage
      const free = total - used;
      const usagePercent = (used / total) * 100;
      
      return {
        used,
        free,
        total,
        usagePercent,
      };
    } catch (error) {
      this.logger.error(`Failed to get disk usage: ${error.message}`);
      return {
        used: 0,
        free: 0,
        total: 0,
        usagePercent: 0,
      };
    }
  }

  private async checkSystemAlerts(metrics: SystemMetrics): Promise<void> {
    // Check CPU alerts
    this.checkThresholdAlert(
      'cpu_usage',
      'cpu',
      'CPU usage',
      metrics.cpu.usage,
      this.thresholds.cpu,
      '%'
    );

    // Check memory alerts
    this.checkThresholdAlert(
      'memory_usage',
      'memory',
      'Memory usage',
      metrics.memory.usagePercent,
      this.thresholds.memory,
      '%'
    );

    // Check disk alerts
    this.checkThresholdAlert(
      'disk_usage',
      'disk',
      'Disk usage',
      metrics.disk.usagePercent,
      this.thresholds.disk,
      '%'
    );

    // Check load average alerts
    const loadAverage = metrics.cpu.loadAverage[0];
    const loadThreshold = metrics.cpu.cores * 0.8; // 80% of CPU cores
    
    if (loadAverage > loadThreshold) {
      this.createAlert(
        'load_average',
        'cpu',
        'critical',
        `High load average: ${loadAverage.toFixed(2)}`,
        loadAverage,
        loadThreshold
      );
    } else {
      this.resolveAlert('load_average');
    }
  }

  private checkThresholdAlert(
    alertId: string,
    type: SystemAlert['type'],
    name: string,
    value: number,
    thresholds: { warning: number; critical: number },
    unit: string
  ): void {
    if (value >= thresholds.critical) {
      this.createAlert(
        alertId,
        type,
        'critical',
        `${name} is critically high: ${value.toFixed(1)}${unit}`,
        value,
        thresholds.critical
      );
    } else if (value >= thresholds.warning) {
      this.createAlert(
        alertId,
        type,
        'warning',
        `${name} is high: ${value.toFixed(1)}${unit}`,
        value,
        thresholds.warning
      );
    } else {
      this.resolveAlert(alertId);
    }
  }

  private createAlert(
    id: string,
    type: SystemAlert['type'],
    severity: SystemAlert['severity'],
    message: string,
    value: number,
    threshold: number
  ): void {
    const existingAlert = this.alerts.get(id);
    
    if (existingAlert && !existingAlert.resolved) {
      // Update existing alert
      existingAlert.message = message;
      existingAlert.value = value;
      existingAlert.timestamp = new Date();
      return;
    }

    const alert: SystemAlert = {
      id,
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.set(id, alert);
    this.logger.warn(`System alert created: ${message}`);
  }

  private resolveAlert(id: string): void {
    const alert = this.alerts.get(id);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.logger.log(`System alert resolved: ${alert.message}`);
    }
  }

  async getSystemInfo(): Promise<SystemInfo> {
    const cpus = os.cpus();
    
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || 'Unknown',
      nodeVersion: process.version,
      processId: process.pid,
      processUptime: process.uptime(),
    };
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    return await this.getCurrentSystemMetrics();
  }

  getMetricsHistory(hours: number = 1): SystemMetrics[] {
    const pointsNeeded = hours * 60; // 1 point per minute
    return this.metricsHistory.slice(-pointsNeeded);
  }

  getActiveAlerts(): SystemAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  getRecentAlerts(hours: number = 24): SystemAlert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Array.from(this.alerts.values())
      .filter(alert => alert.timestamp >= cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: SystemMetrics | null;
  } {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
    const warningAlerts = activeAlerts.filter(alert => alert.severity === 'warning');
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const issues: string[] = [];
    
    if (criticalAlerts.length > 0) {
      status = 'critical';
      issues.push(...criticalAlerts.map(alert => alert.message));
    } else if (warningAlerts.length > 0) {
      status = 'warning';
      issues.push(...warningAlerts.map(alert => alert.message));
    }
    
    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1] || null;
    
    return {
      status,
      issues,
      metrics: latestMetrics,
    };
  }

  clearAlerts(): void {
    this.alerts.clear();
    this.logger.log('All system alerts cleared');
  }

  clearMetricsHistory(): void {
    this.metricsHistory.length = 0;
    this.logger.log('System metrics history cleared');
  }

  updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    Object.assign(this.thresholds, newThresholds);
    this.logger.log('System monitoring thresholds updated');
  }

  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }
}