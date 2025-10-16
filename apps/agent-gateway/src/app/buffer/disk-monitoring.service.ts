import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DiskUsage {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
}

export interface DiskAlert {
  level: 'warning' | 'critical';
  message: string;
  timestamp: Date;
  usagePercent: number;
}

@Injectable()
export class DiskMonitoringService {
  private readonly logger = new Logger(DiskMonitoringService.name);
  private monitoringPath: string;
  private currentUsage: DiskUsage;
  private alerts: DiskAlert[] = [];
  private readonly warningThreshold: number;
  private readonly criticalThreshold: number;
  private readonly maxAlerts: number;

  constructor(private readonly config: ConfigService) {
    this.warningThreshold = parseFloat(this.config.get('DISK_WARNING_THRESHOLD', '80'));
    this.criticalThreshold = parseFloat(this.config.get('DISK_CRITICAL_THRESHOLD', '95'));
    this.maxAlerts = parseInt(this.config.get('DISK_MAX_ALERTS', '100'));
  }

  async initialize(monitoringPath: string): Promise<void> {
    this.monitoringPath = monitoringPath;
    await this.updateDiskUsage();
    this.logger.log(`Disk monitoring initialized for: ${monitoringPath}`);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async monitorDiskUsage(): Promise<void> {
    if (!this.monitoringPath) return;

    try {
      await this.updateDiskUsage();
      await this.checkThresholds();
    } catch (error) {
      this.logger.error(`Disk monitoring failed: ${error.message}`);
    }
  }

  private async updateDiskUsage(): Promise<void> {
    try {
      const stats = await fs.stat(this.monitoringPath);
      
      // For Unix-like systems, we can use statvfs-like functionality
      // This is a simplified implementation
      const diskUsage = await this.getDiskUsageStats(this.monitoringPath);
      
      this.currentUsage = diskUsage;
      
    } catch (error) {
      this.logger.error(`Failed to update disk usage: ${error.message}`);
      throw error;
    }
  }

  private async getDiskUsageStats(dirPath: string): Promise<DiskUsage> {
    try {
      // This is a simplified implementation
      // In a real-world scenario, you'd use a library like 'node-disk-info' or system calls
      
      // Get directory size
      const usedBytes = await this.getDirectorySize(dirPath);
      
      // Estimate total and free space (this is a rough approximation)
      // In production, you'd want to use proper system calls
      const totalBytes = 100 * 1024 * 1024 * 1024; // 100GB assumption
      const freeBytes = totalBytes - usedBytes;
      const usedPercent = (usedBytes / totalBytes) * 100;

      return {
        totalBytes,
        usedBytes,
        freeBytes,
        usedPercent,
      };
    } catch (error) {
      this.logger.error(`Failed to get disk usage stats: ${error.message}`);
      
      // Return default values on error
      return {
        totalBytes: 0,
        usedBytes: 0,
        freeBytes: 0,
        usedPercent: 0,
      };
    }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          totalSize += await this.getDirectorySize(itemPath);
        } else if (item.isFile()) {
          const stats = await fs.stat(itemPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
      this.logger.debug(`Could not read directory ${dirPath}: ${error.message}`);
    }

    return totalSize;
  }

  private async checkThresholds(): Promise<void> {
    if (!this.currentUsage) return;

    const usagePercent = this.currentUsage.usedPercent;

    if (usagePercent >= this.criticalThreshold) {
      await this.createAlert('critical', `Critical disk usage: ${usagePercent.toFixed(1)}%`, usagePercent);
    } else if (usagePercent >= this.warningThreshold) {
      await this.createAlert('warning', `High disk usage: ${usagePercent.toFixed(1)}%`, usagePercent);
    }
  }

  private async createAlert(level: 'warning' | 'critical', message: string, usagePercent: number): Promise<void> {
    // Check if we already have a recent alert of the same level
    const recentAlert = this.alerts.find(alert => 
      alert.level === level && 
      Date.now() - alert.timestamp.getTime() < 5 * 60 * 1000 // 5 minutes
    );

    if (recentAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: DiskAlert = {
      level,
      message,
      timestamp: new Date(),
      usagePercent,
    };

    this.alerts.push(alert);

    // Limit alert history
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    this.logger.warn(`Disk alert [${level.toUpperCase()}]: ${message}`);

    // In a production environment, you might want to send notifications here
    // For example, to a monitoring system or via email/Slack
  }

  getDiskUsage(): DiskUsage {
    return this.currentUsage || {
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      usedPercent: 0,
    };
  }

  getRecentAlerts(hours: number = 24): DiskAlert[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.alerts.filter(alert => alert.timestamp.getTime() > cutoff);
  }

  getAllAlerts(): DiskAlert[] {
    return [...this.alerts];
  }

  clearAlerts(): void {
    this.alerts = [];
    this.logger.log('Disk alerts cleared');
  }

  async getDetailedDiskInfo(): Promise<{
    usage: DiskUsage;
    path: string;
    alerts: DiskAlert[];
    thresholds: {
      warning: number;
      critical: number;
    };
    health: 'healthy' | 'warning' | 'critical';
  }> {
    const usage = this.getDiskUsage();
    const recentAlerts = this.getRecentAlerts(1); // Last hour
    
    let health: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (usage.usedPercent >= this.criticalThreshold) {
      health = 'critical';
    } else if (usage.usedPercent >= this.warningThreshold) {
      health = 'warning';
    }

    return {
      usage,
      path: this.monitoringPath,
      alerts: recentAlerts,
      thresholds: {
        warning: this.warningThreshold,
        critical: this.criticalThreshold,
      },
      health,
    };
  }

  async estimateTimeToFull(recentHours: number = 24): Promise<{
    hoursToWarning: number | null;
    hoursToCritical: number | null;
    growthRatePerHour: number;
  }> {
    // This is a simplified implementation
    // In production, you'd want to track usage over time and calculate trends
    
    const currentUsage = this.getDiskUsage();
    
    // Estimate growth rate (this would be based on historical data)
    const estimatedGrowthRatePerHour = 0.1; // 0.1% per hour assumption
    
    const currentPercent = currentUsage.usedPercent;
    
    const hoursToWarning = currentPercent < this.warningThreshold 
      ? (this.warningThreshold - currentPercent) / estimatedGrowthRatePerHour
      : null;
      
    const hoursToCritical = currentPercent < this.criticalThreshold
      ? (this.criticalThreshold - currentPercent) / estimatedGrowthRatePerHour
      : null;

    return {
      hoursToWarning,
      hoursToCritical,
      growthRatePerHour: estimatedGrowthRatePerHour,
    };
  }

  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  async performCleanupRecommendations(): Promise<{
    canCleanup: boolean;
    recommendations: string[];
    estimatedSpaceSaved: number;
  }> {
    const recommendations: string[] = [];
    let estimatedSpaceSaved = 0;

    try {
      // Check for old log files
      const logFiles = await this.findOldFiles(this.monitoringPath, '.log', 7); // 7 days old
      if (logFiles.length > 0) {
        const logSize = logFiles.reduce((sum, file) => sum + file.size, 0);
        recommendations.push(`Remove ${logFiles.length} old log files (${this.formatBytes(logSize)})`);
        estimatedSpaceSaved += logSize;
      }

      // Check for temporary files
      const tempFiles = await this.findOldFiles(this.monitoringPath, '.tmp', 1); // 1 day old
      if (tempFiles.length > 0) {
        const tempSize = tempFiles.reduce((sum, file) => sum + file.size, 0);
        recommendations.push(`Remove ${tempFiles.length} temporary files (${this.formatBytes(tempSize)})`);
        estimatedSpaceSaved += tempSize;
      }

      // Check database size and suggest vacuum
      const dbFiles = await this.findFiles(this.monitoringPath, '.db');
      if (dbFiles.length > 0) {
        recommendations.push('Run database VACUUM to reclaim space');
        // Estimate 10-20% space savings from vacuum
        const dbSize = dbFiles.reduce((sum, file) => sum + file.size, 0);
        estimatedSpaceSaved += dbSize * 0.15;
      }

    } catch (error) {
      this.logger.error(`Failed to generate cleanup recommendations: ${error.message}`);
    }

    return {
      canCleanup: recommendations.length > 0,
      recommendations,
      estimatedSpaceSaved,
    };
  }

  private async findOldFiles(dirPath: string, extension: string, daysOld: number): Promise<Array<{ path: string; size: number }>> {
    const files: Array<{ path: string; size: number }> = [];
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        if (item.isFile() && item.name.endsWith(extension)) {
          const stats = await fs.stat(itemPath);
          if (stats.mtime.getTime() < cutoffTime) {
            files.push({ path: itemPath, size: stats.size });
          }
        } else if (item.isDirectory()) {
          const subFiles = await this.findOldFiles(itemPath, extension, daysOld);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      this.logger.debug(`Could not scan directory ${dirPath}: ${error.message}`);
    }

    return files;
  }

  private async findFiles(dirPath: string, extension: string): Promise<Array<{ path: string; size: number }>> {
    const files: Array<{ path: string; size: number }> = [];

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        if (item.isFile() && item.name.endsWith(extension)) {
          const stats = await fs.stat(itemPath);
          files.push({ path: itemPath, size: stats.size });
        } else if (item.isDirectory()) {
          const subFiles = await this.findFiles(itemPath, extension);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      this.logger.debug(`Could not scan directory ${dirPath}: ${error.message}`);
    }

    return files;
  }
}