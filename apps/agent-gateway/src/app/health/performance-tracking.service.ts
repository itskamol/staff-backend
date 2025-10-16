import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface PerformanceMetrics {
  timestamp: Date;
  responseTime: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    dataProcessedPerSecond: number;
    errorsPerSecond: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    diskIO: number;
    networkIO: number;
  };
  application: {
    activeConnections: number;
    queueSizes: Record<string, number>;
    cacheHitRate: number;
    errorRate: number;
  };
}

export interface PerformanceAlert {
  id: string;
  metric: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface PerformanceRecommendation {
  id: string;
  category: 'performance' | 'resource' | 'configuration' | 'scaling';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  timestamp: Date;
}

@Injectable()
export class PerformanceTrackingService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceTrackingService.name);
  private readonly metricsHistory: PerformanceMetrics[] = [];
  private readonly alerts = new Map<string, PerformanceAlert>();
  private readonly recommendations = new Map<string, PerformanceRecommendation>();
  private readonly responseTimes: number[] = [];
  private readonly maxHistorySize: number;
  private readonly maxResponseTimesSample: number;
  
  private readonly thresholds = {
    responseTime: {
      warning: 1000, // ms
      critical: 5000, // ms
    },
    throughput: {
      minRequestsPerSecond: 10,
      maxErrorRate: 5, // %
    },
    resources: {
      cpuWarning: 70, // %
      cpuCritical: 90, // %
      memoryWarning: 80, // %
      memoryCritical: 95, // %
    },
  };

  constructor(private readonly config: ConfigService) {
    this.maxHistorySize = parseInt(this.config.get('PERFORMANCE_HISTORY_SIZE', '2880')); // 48 hours at 1min intervals
    this.maxResponseTimesSample = parseInt(this.config.get('RESPONSE_TIMES_SAMPLE_SIZE', '1000'));
    
    // Override thresholds from config
    this.thresholds.responseTime.warning = parseInt(this.config.get('RESPONSE_TIME_WARNING_MS', '1000'));
    this.thresholds.responseTime.critical = parseInt(this.config.get('RESPONSE_TIME_CRITICAL_MS', '5000'));
    this.thresholds.throughput.minRequestsPerSecond = parseInt(this.config.get('MIN_REQUESTS_PER_SECOND', '10'));
    this.thresholds.throughput.maxErrorRate = parseInt(this.config.get('MAX_ERROR_RATE_PERCENT', '5'));
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Performance tracking service initialized');
    await this.collectMetrics();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getCurrentMetrics();
      
      // Add to history
      this.metricsHistory.push(metrics);
      
      // Trim history if needed
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }
      
      // Check for performance alerts
      await this.checkPerformanceAlerts(metrics);
      
      // Generate recommendations
      await this.generateRecommendations(metrics);
      
      this.logger.debug('Performance metrics collected');
      
    } catch (error) {
      this.logger.error(`Failed to collect performance metrics: ${error.message}`);
    }
  }

  recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);
    
    // Keep only recent response times
    if (this.responseTimes.length > this.maxResponseTimesSample) {
      this.responseTimes.shift();
    }
  }

  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    const responseTimeStats = this.calculateResponseTimeStats();
    const throughputStats = this.calculateThroughputStats();
    const resourceStats = await this.getResourceStats();
    const applicationStats = await this.getApplicationStats();

    return {
      timestamp: new Date(),
      responseTime: responseTimeStats,
      throughput: throughputStats,
      resources: resourceStats,
      application: applicationStats,
    };
  }

  private calculateResponseTimeStats(): PerformanceMetrics['responseTime'] {
    if (this.responseTimes.length === 0) {
      return {
        average: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const length = sorted.length;
    
    const average = sorted.reduce((sum, time) => sum + time, 0) / length;
    const p50 = sorted[Math.floor(length * 0.5)];
    const p95 = sorted[Math.floor(length * 0.95)];
    const p99 = sorted[Math.floor(length * 0.99)];

    return {
      average,
      p50,
      p95,
      p99,
    };
  }

  private calculateThroughputStats(): PerformanceMetrics['throughput'] {
    // This would normally be calculated from actual request/data processing metrics
    // For now, we'll use mock data based on recent history
    
    const recentMetrics = this.metricsHistory.slice(-5); // Last 5 minutes
    
    if (recentMetrics.length === 0) {
      return {
        requestsPerSecond: 0,
        dataProcessedPerSecond: 0,
        errorsPerSecond: 0,
      };
    }

    const avgRequests = recentMetrics.reduce((sum, m) => sum + (m.throughput?.requestsPerSecond || 0), 0) / recentMetrics.length;
    const avgDataProcessed = recentMetrics.reduce((sum, m) => sum + (m.throughput?.dataProcessedPerSecond || 0), 0) / recentMetrics.length;
    const avgErrors = recentMetrics.reduce((sum, m) => sum + (m.throughput?.errorsPerSecond || 0), 0) / recentMetrics.length;

    return {
      requestsPerSecond: avgRequests || Math.random() * 50 + 10, // Mock data
      dataProcessedPerSecond: avgDataProcessed || Math.random() * 1000 + 100, // Mock data
      errorsPerSecond: avgErrors || Math.random() * 2, // Mock data
    };
  }

  private async getResourceStats(): Promise<PerformanceMetrics['resources']> {
    const memUsage = process.memoryUsage();
    const cpuUsage = await this.getCpuUsage();
    
    return {
      cpuUsage,
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      diskIO: Math.random() * 100, // Mock data - would come from system monitoring
      networkIO: Math.random() * 1000, // Mock data - would come from system monitoring
    };
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime(startTime);
        
        const totalTime = endTime[0] * 1000000 + endTime[1] / 1000;
        const totalCpuTime = endUsage.user + endUsage.system;
        
        const cpuPercent = (totalCpuTime / totalTime) * 100;
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  private async getApplicationStats(): Promise<PerformanceMetrics['application']> {
    // This would normally come from various application services
    return {
      activeConnections: Math.floor(Math.random() * 100) + 10, // Mock data
      queueSizes: {
        buffer: Math.floor(Math.random() * 1000),
        uplink: Math.floor(Math.random() * 100),
        commands: Math.floor(Math.random() * 50),
      },
      cacheHitRate: Math.random() * 20 + 80, // 80-100% mock data
      errorRate: Math.random() * 5, // 0-5% mock data
    };
  }

  private async checkPerformanceAlerts(metrics: PerformanceMetrics): Promise<void> {
    // Check response time alerts
    if (metrics.responseTime.p95 >= this.thresholds.responseTime.critical) {
      this.createAlert(
        'response_time_p95',
        'response_time',
        'critical',
        `95th percentile response time is critically high: ${metrics.responseTime.p95.toFixed(0)}ms`,
        metrics.responseTime.p95,
        this.thresholds.responseTime.critical
      );
    } else if (metrics.responseTime.p95 >= this.thresholds.responseTime.warning) {
      this.createAlert(
        'response_time_p95',
        'response_time',
        'warning',
        `95th percentile response time is high: ${metrics.responseTime.p95.toFixed(0)}ms`,
        metrics.responseTime.p95,
        this.thresholds.responseTime.warning
      );
    } else {
      this.resolveAlert('response_time_p95');
    }

    // Check throughput alerts
    if (metrics.throughput.requestsPerSecond < this.thresholds.throughput.minRequestsPerSecond) {
      this.createAlert(
        'low_throughput',
        'throughput',
        'warning',
        `Low request throughput: ${metrics.throughput.requestsPerSecond.toFixed(1)} req/s`,
        metrics.throughput.requestsPerSecond,
        this.thresholds.throughput.minRequestsPerSecond
      );
    } else {
      this.resolveAlert('low_throughput');
    }

    // Check error rate alerts
    const errorRate = (metrics.throughput.errorsPerSecond / metrics.throughput.requestsPerSecond) * 100;
    if (errorRate > this.thresholds.throughput.maxErrorRate) {
      this.createAlert(
        'high_error_rate',
        'error_rate',
        'critical',
        `High error rate: ${errorRate.toFixed(1)}%`,
        errorRate,
        this.thresholds.throughput.maxErrorRate
      );
    } else {
      this.resolveAlert('high_error_rate');
    }

    // Check resource alerts
    if (metrics.resources.cpuUsage >= this.thresholds.resources.cpuCritical) {
      this.createAlert(
        'cpu_usage',
        'cpu',
        'critical',
        `CPU usage is critically high: ${metrics.resources.cpuUsage.toFixed(1)}%`,
        metrics.resources.cpuUsage,
        this.thresholds.resources.cpuCritical
      );
    } else if (metrics.resources.cpuUsage >= this.thresholds.resources.cpuWarning) {
      this.createAlert(
        'cpu_usage',
        'cpu',
        'warning',
        `CPU usage is high: ${metrics.resources.cpuUsage.toFixed(1)}%`,
        metrics.resources.cpuUsage,
        this.thresholds.resources.cpuWarning
      );
    } else {
      this.resolveAlert('cpu_usage');
    }

    if (metrics.resources.memoryUsage >= this.thresholds.resources.memoryCritical) {
      this.createAlert(
        'memory_usage',
        'memory',
        'critical',
        `Memory usage is critically high: ${metrics.resources.memoryUsage.toFixed(1)}%`,
        metrics.resources.memoryUsage,
        this.thresholds.resources.memoryCritical
      );
    } else if (metrics.resources.memoryUsage >= this.thresholds.resources.memoryWarning) {
      this.createAlert(
        'memory_usage',
        'memory',
        'warning',
        `Memory usage is high: ${metrics.resources.memoryUsage.toFixed(1)}%`,
        metrics.resources.memoryUsage,
        this.thresholds.resources.memoryWarning
      );
    } else {
      this.resolveAlert('memory_usage');
    }
  }

  private createAlert(
    id: string,
    metric: string,
    severity: PerformanceAlert['severity'],
    message: string,
    currentValue: number,
    threshold: number
  ): void {
    const existingAlert = this.alerts.get(id);
    
    if (existingAlert && !existingAlert.resolved) {
      existingAlert.message = message;
      existingAlert.currentValue = currentValue;
      existingAlert.timestamp = new Date();
      return;
    }

    const alert: PerformanceAlert = {
      id,
      metric,
      severity,
      message,
      currentValue,
      threshold,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.set(id, alert);
    this.logger.warn(`Performance alert created: ${message}`);
  }

  private resolveAlert(id: string): void {
    const alert = this.alerts.get(id);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.logger.log(`Performance alert resolved: ${alert.message}`);
    }
  }

  private async generateRecommendations(metrics: PerformanceMetrics): Promise<void> {
    // Clear old recommendations
    this.recommendations.clear();

    // Response time recommendations
    if (metrics.responseTime.p95 > 2000) {
      this.addRecommendation(
        'optimize_response_time',
        'performance',
        'high',
        'Optimize Response Time',
        'Consider implementing caching, database query optimization, or request batching to improve response times.',
        'Could reduce response times by 30-50%',
        'medium'
      );
    }

    // Memory usage recommendations
    if (metrics.resources.memoryUsage > 70) {
      this.addRecommendation(
        'memory_optimization',
        'resource',
        'medium',
        'Memory Usage Optimization',
        'Consider implementing memory pooling, garbage collection tuning, or reducing memory-intensive operations.',
        'Could reduce memory usage by 20-30%',
        'medium'
      );
    }

    // Queue size recommendations
    const maxQueueSize = Math.max(...Object.values(metrics.application.queueSizes));
    if (maxQueueSize > 500) {
      this.addRecommendation(
        'queue_optimization',
        'scaling',
        'high',
        'Queue Size Management',
        'Consider increasing processing capacity, implementing queue prioritization, or adding more workers.',
        'Could reduce queue processing delays by 40-60%',
        'high'
      );
    }

    // Error rate recommendations
    if (metrics.application.errorRate > 2) {
      this.addRecommendation(
        'error_handling',
        'performance',
        'high',
        'Error Rate Reduction',
        'Investigate and fix common error patterns, implement better error handling, and add retry mechanisms.',
        'Could reduce error rate by 50-70%',
        'medium'
      );
    }

    // Cache hit rate recommendations
    if (metrics.application.cacheHitRate < 85) {
      this.addRecommendation(
        'cache_optimization',
        'configuration',
        'medium',
        'Cache Hit Rate Improvement',
        'Review cache configuration, implement better cache warming strategies, or increase cache size.',
        'Could improve cache hit rate by 10-15%',
        'low'
      );
    }
  }

  private addRecommendation(
    id: string,
    category: PerformanceRecommendation['category'],
    priority: PerformanceRecommendation['priority'],
    title: string,
    description: string,
    impact: string,
    effort: PerformanceRecommendation['effort']
  ): void {
    const recommendation: PerformanceRecommendation = {
      id,
      category,
      priority,
      title,
      description,
      impact,
      effort,
      timestamp: new Date(),
    };

    this.recommendations.set(id, recommendation);
  }

  getHistoricalMetrics(hours: number = 1): PerformanceMetrics[] {
    const pointsNeeded = hours * 60; // 1 point per minute
    return this.metricsHistory.slice(-pointsNeeded);
  }

  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  getRecentAlerts(hours: number = 24): PerformanceAlert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Array.from(this.alerts.values())
      .filter(alert => alert.timestamp >= cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getPerformanceRecommendations(): PerformanceRecommendation[] {
    return Array.from(this.recommendations.values())
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
  }

  getPerformanceMetrics(): {
    current: PerformanceMetrics | null;
    trends: {
      responseTime: 'improving' | 'stable' | 'degrading';
      throughput: 'improving' | 'stable' | 'degrading';
      errorRate: 'improving' | 'stable' | 'degrading';
    };
    summary: {
      averageResponseTime: number;
      totalRequests: number;
      errorRate: number;
      uptime: number;
    };
  } {
    const current = this.metricsHistory[this.metricsHistory.length - 1] || null;
    const trends = this.calculateTrends();
    const summary = this.calculateSummary();

    return {
      current,
      trends,
      summary,
    };
  }

  private calculateTrends(): {
    responseTime: 'improving' | 'stable' | 'degrading';
    throughput: 'improving' | 'stable' | 'degrading';
    errorRate: 'improving' | 'stable' | 'degrading';
  } {
    const recentMetrics = this.metricsHistory.slice(-10); // Last 10 minutes
    
    if (recentMetrics.length < 5) {
      return {
        responseTime: 'stable',
        throughput: 'stable',
        errorRate: 'stable',
      };
    }

    const firstHalf = recentMetrics.slice(0, Math.floor(recentMetrics.length / 2));
    const secondHalf = recentMetrics.slice(Math.floor(recentMetrics.length / 2));

    const avgResponseTimeFirst = firstHalf.reduce((sum, m) => sum + m.responseTime.average, 0) / firstHalf.length;
    const avgResponseTimeSecond = secondHalf.reduce((sum, m) => sum + m.responseTime.average, 0) / secondHalf.length;

    const avgThroughputFirst = firstHalf.reduce((sum, m) => sum + m.throughput.requestsPerSecond, 0) / firstHalf.length;
    const avgThroughputSecond = secondHalf.reduce((sum, m) => sum + m.throughput.requestsPerSecond, 0) / secondHalf.length;

    const avgErrorRateFirst = firstHalf.reduce((sum, m) => sum + m.application.errorRate, 0) / firstHalf.length;
    const avgErrorRateSecond = secondHalf.reduce((sum, m) => sum + m.application.errorRate, 0) / secondHalf.length;

    return {
      responseTime: this.getTrend(avgResponseTimeFirst, avgResponseTimeSecond, false),
      throughput: this.getTrend(avgThroughputFirst, avgThroughputSecond, true),
      errorRate: this.getTrend(avgErrorRateFirst, avgErrorRateSecond, false),
    };
  }

  private getTrend(first: number, second: number, higherIsBetter: boolean): 'improving' | 'stable' | 'degrading' {
    const changePercent = ((second - first) / first) * 100;
    const threshold = 5; // 5% change threshold

    if (Math.abs(changePercent) < threshold) {
      return 'stable';
    }

    if (higherIsBetter) {
      return changePercent > 0 ? 'improving' : 'degrading';
    } else {
      return changePercent < 0 ? 'improving' : 'degrading';
    }
  }

  private calculateSummary(): {
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
    uptime: number;
  } {
    const recentMetrics = this.metricsHistory.slice(-60); // Last hour
    
    if (recentMetrics.length === 0) {
      return {
        averageResponseTime: 0,
        totalRequests: 0,
        errorRate: 0,
        uptime: process.uptime(),
      };
    }

    const averageResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime.average, 0) / recentMetrics.length;
    const totalRequests = recentMetrics.reduce((sum, m) => sum + m.throughput.requestsPerSecond, 0) * 60; // Convert to total
    const errorRate = recentMetrics.reduce((sum, m) => sum + m.application.errorRate, 0) / recentMetrics.length;

    return {
      averageResponseTime,
      totalRequests,
      errorRate,
      uptime: process.uptime(),
    };
  }

  clearAlerts(): void {
    this.alerts.clear();
    this.logger.log('All performance alerts cleared');
  }

  clearMetricsHistory(): void {
    this.metricsHistory.length = 0;
    this.responseTimes.length = 0;
    this.logger.log('Performance metrics history cleared');
  }

  updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    Object.assign(this.thresholds, newThresholds);
    this.logger.log('Performance monitoring thresholds updated');
  }

  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }
}