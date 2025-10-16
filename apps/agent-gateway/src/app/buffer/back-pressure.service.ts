import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiskMonitoringService } from './disk-monitoring.service';

export interface BackPressureStatus {
  shouldWarn: boolean;
  shouldReject: boolean;
  reason: string;
  metrics: {
    diskUsagePercent: number;
    recordCount: number;
    memoryUsagePercent: number;
  };
}

export interface BackPressureConfig {
  diskWarningThreshold: number;
  diskCriticalThreshold: number;
  maxRecords: number;
  memoryWarningThreshold: number;
  memoryCriticalThreshold: number;
}

@Injectable()
export class BackPressureService {
  private readonly logger = new Logger(BackPressureService.name);
  private readonly config: BackPressureConfig;
  private recordCount = 0;
  private rejectionCount = 0;
  private warningCount = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly diskMonitoring: DiskMonitoringService,
  ) {
    this.config = {
      diskWarningThreshold: parseFloat(this.configService.get('BACKPRESSURE_DISK_WARNING', '80')),
      diskCriticalThreshold: parseFloat(this.configService.get('BACKPRESSURE_DISK_CRITICAL', '95')),
      maxRecords: parseInt(this.configService.get('BACKPRESSURE_MAX_RECORDS', '100000')),
      memoryWarningThreshold: parseFloat(this.configService.get('BACKPRESSURE_MEMORY_WARNING', '80')),
      memoryCriticalThreshold: parseFloat(this.configService.get('BACKPRESSURE_MEMORY_CRITICAL', '90')),
    };
  }

  async checkBackPressure(): Promise<BackPressureStatus> {
    const diskUsage = this.diskMonitoring.getDiskUsage();
    const memoryUsage = this.getMemoryUsage();
    
    const metrics = {
      diskUsagePercent: diskUsage.usedPercent,
      recordCount: this.recordCount,
      memoryUsagePercent: memoryUsage,
    };

    // Check critical conditions (should reject)
    if (diskUsage.usedPercent >= this.config.diskCriticalThreshold) {
      this.rejectionCount++;
      return {
        shouldWarn: false,
        shouldReject: true,
        reason: `Disk usage critical: ${diskUsage.usedPercent.toFixed(1)}%`,
        metrics,
      };
    }

    if (memoryUsage >= this.config.memoryCriticalThreshold) {
      this.rejectionCount++;
      return {
        shouldWarn: false,
        shouldReject: true,
        reason: `Memory usage critical: ${memoryUsage.toFixed(1)}%`,
        metrics,
      };
    }

    if (this.recordCount >= this.config.maxRecords) {
      this.rejectionCount++;
      return {
        shouldWarn: false,
        shouldReject: true,
        reason: `Maximum record count reached: ${this.recordCount}`,
        metrics,
      };
    }

    // Check warning conditions
    if (diskUsage.usedPercent >= this.config.diskWarningThreshold) {
      this.warningCount++;
      return {
        shouldWarn: true,
        shouldReject: false,
        reason: `Disk usage high: ${diskUsage.usedPercent.toFixed(1)}%`,
        metrics,
      };
    }

    if (memoryUsage >= this.config.memoryWarningThreshold) {
      this.warningCount++;
      return {
        shouldWarn: true,
        shouldReject: false,
        reason: `Memory usage high: ${memoryUsage.toFixed(1)}%`,
        metrics,
      };
    }

    // All good
    return {
      shouldWarn: false,
      shouldReject: false,
      reason: 'Normal operation',
      metrics,
    };
  }

  private getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal + memUsage.external;
    const usedMemory = memUsage.heapUsed;
    
    // This is a simplified calculation
    // In production, you might want to use system memory instead of just heap
    return (usedMemory / totalMemory) * 100;
  }

  updateRecordCount(count: number): void {
    this.recordCount = count;
  }

  incrementRecordCount(increment: number = 1): void {
    this.recordCount += increment;
  }

  decrementRecordCount(decrement: number = 1): void {
    this.recordCount = Math.max(0, this.recordCount - decrement);
  }

  getBackPressureStats(): {
    config: BackPressureConfig;
    currentMetrics: {
      diskUsagePercent: number;
      recordCount: number;
      memoryUsagePercent: number;
    };
    counters: {
      rejections: number;
      warnings: number;
    };
    status: 'normal' | 'warning' | 'critical';
  } {
    const diskUsage = this.diskMonitoring.getDiskUsage();
    const memoryUsage = this.getMemoryUsage();
    
    const currentMetrics = {
      diskUsagePercent: diskUsage.usedPercent,
      recordCount: this.recordCount,
      memoryUsagePercent: memoryUsage,
    };

    let status: 'normal' | 'warning' | 'critical' = 'normal';
    
    if (diskUsage.usedPercent >= this.config.diskCriticalThreshold ||
        memoryUsage >= this.config.memoryCriticalThreshold ||
        this.recordCount >= this.config.maxRecords) {
      status = 'critical';
    } else if (diskUsage.usedPercent >= this.config.diskWarningThreshold ||
               memoryUsage >= this.config.memoryWarningThreshold) {
      status = 'warning';
    }

    return {
      config: { ...this.config },
      currentMetrics,
      counters: {
        rejections: this.rejectionCount,
        warnings: this.warningCount,
      },
      status,
    };
  }

  resetCounters(): void {
    this.rejectionCount = 0;
    this.warningCount = 0;
    this.logger.log('Back-pressure counters reset');
  }

  updateConfig(newConfig: Partial<BackPressureConfig>): void {
    Object.assign(this.config, newConfig);
    this.logger.log('Back-pressure configuration updated', this.config);
  }

  async getCapacityPlan(): Promise<{
    currentCapacity: number; // percentage
    estimatedTimeToWarning: number | null; // hours
    estimatedTimeToCritical: number | null; // hours
    recommendations: string[];
  }> {
    const diskUsage = this.diskMonitoring.getDiskUsage();
    const memoryUsage = this.getMemoryUsage();
    
    // Calculate current capacity as the highest usage percentage
    const currentCapacity = Math.max(
      diskUsage.usedPercent,
      memoryUsage,
      (this.recordCount / this.config.maxRecords) * 100
    );

    // Get disk time estimates
    const diskEstimates = await this.diskMonitoring.estimateTimeToFull();
    
    // Estimate memory growth (simplified)
    const memoryGrowthRate = 0.5; // 0.5% per hour assumption
    const memoryTimeToWarning = memoryUsage < this.config.memoryWarningThreshold
      ? (this.config.memoryWarningThreshold - memoryUsage) / memoryGrowthRate
      : null;
    const memoryTimeToCritical = memoryUsage < this.config.memoryCriticalThreshold
      ? (this.config.memoryCriticalThreshold - memoryUsage) / memoryGrowthRate
      : null;

    // Take the minimum time estimates
    const estimatedTimeToWarning = Math.min(
      ...[diskEstimates.hoursToWarning, memoryTimeToWarning].filter(t => t !== null)
    ) || null;
    
    const estimatedTimeToCritical = Math.min(
      ...[diskEstimates.hoursToCritical, memoryTimeToCritical].filter(t => t !== null)
    ) || null;

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (currentCapacity > 70) {
      recommendations.push('Consider increasing buffer retention cleanup frequency');
    }
    
    if (diskUsage.usedPercent > 60) {
      recommendations.push('Monitor disk usage closely and consider cleanup');
    }
    
    if (memoryUsage > 60) {
      recommendations.push('Monitor memory usage and consider optimizing buffer operations');
    }
    
    if (this.recordCount > this.config.maxRecords * 0.7) {
      recommendations.push('High record count detected, consider increasing processing rate');
    }

    if (estimatedTimeToCritical && estimatedTimeToCritical < 24) {
      recommendations.push('Critical capacity will be reached within 24 hours - immediate action required');
    } else if (estimatedTimeToWarning && estimatedTimeToWarning < 48) {
      recommendations.push('Warning capacity will be reached within 48 hours - plan maintenance');
    }

    return {
      currentCapacity,
      estimatedTimeToWarning,
      estimatedTimeToCritical,
      recommendations,
    };
  }

  async shouldThrottleIngestion(): Promise<{
    shouldThrottle: boolean;
    throttlePercent: number; // 0-100, how much to throttle
    reason: string;
  }> {
    const backPressureStatus = await this.checkBackPressure();
    
    if (backPressureStatus.shouldReject) {
      return {
        shouldThrottle: true,
        throttlePercent: 100, // Complete throttling
        reason: `Complete throttling: ${backPressureStatus.reason}`,
      };
    }
    
    if (backPressureStatus.shouldWarn) {
      // Gradual throttling based on usage
      const diskPercent = backPressureStatus.metrics.diskUsagePercent;
      const memoryPercent = backPressureStatus.metrics.memoryUsagePercent;
      
      // Calculate throttle percentage based on highest usage
      const maxUsage = Math.max(diskPercent, memoryPercent);
      const throttlePercent = Math.min(50, Math.max(0, (maxUsage - this.config.diskWarningThreshold) * 2));
      
      return {
        shouldThrottle: throttlePercent > 0,
        throttlePercent,
        reason: `Gradual throttling (${throttlePercent.toFixed(1)}%): ${backPressureStatus.reason}`,
      };
    }
    
    return {
      shouldThrottle: false,
      throttlePercent: 0,
      reason: 'No throttling needed',
    };
  }
}