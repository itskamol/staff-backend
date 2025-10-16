import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/database';
import { ConfigService } from '@nestjs/config';

export interface BaselineMetrics {
  apiResponseTime95th: number;
  dbQueryLatency: number;
  throughputRps: number;
  memoryUsage: number;
  cpuUsage: number;
  timestamp: Date;
  environment: string;
  version: string;
}

export interface PerformanceComparison {
  current: BaselineMetrics;
  baseline: BaselineMetrics;
  improvements: {
    apiResponseTime: number; // percentage improvement
    dbQueryLatency: number;
    throughputRps: number;
  };
  meetsTargets: boolean;
}

@Injectable()
export class BaselineMeasurementService {
  private readonly logger = new Logger(BaselineMeasurementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async captureBaseline(): Promise<BaselineMetrics> {
    this.logger.log('Starting baseline metrics capture');

    const startTime = Date.now();
    
    // Measure API response time (95th percentile)
    const apiMetrics = await this.measureApiResponseTime();
    
    // Measure database query latency
    const dbMetrics = await this.measureDatabaseLatency();
    
    // Measure throughput
    const throughputMetrics = await this.measureThroughput();
    
    // Measure system resources
    const systemMetrics = await this.measureSystemResources();

    const baseline: BaselineMetrics = {
      apiResponseTime95th: apiMetrics.p95,
      dbQueryLatency: dbMetrics.avgLatency,
      throughputRps: throughputMetrics.requestsPerSecond,
      memoryUsage: systemMetrics.memoryUsage,
      cpuUsage: systemMetrics.cpuUsage,
      timestamp: new Date(),
      environment: this.config.get('NODE_ENV', 'development'),
      version: this.config.get('APP_VERSION', '1.0.0'),
    };

    // Store baseline in dedicated metrics database
    await this.storeBaseline(baseline);

    const duration = Date.now() - startTime;
    this.logger.log(`Baseline capture completed in ${duration}ms`);

    return baseline;
  }

  private async measureApiResponseTime(): Promise<{ p95: number; avg: number }> {
    const testEndpoints = [
      '/api/health',
      '/api/organizations',
      '/api/employees',
      '/api/devices',
    ];

    const measurements: number[] = [];
    const iterations = 100;

    for (const endpoint of testEndpoints) {
      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        
        try {
          // Simulate API call measurement
          await this.simulateApiCall(endpoint);
          
          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
          measurements.push(duration);
        } catch (error) {
          this.logger.warn(`API measurement failed for ${endpoint}: ${error.message}`);
        }
      }
    }

    measurements.sort((a, b) => a - b);
    const p95Index = Math.floor(measurements.length * 0.95);
    const avg = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;

    return {
      p95: measurements[p95Index] || 0,
      avg,
    };
  }

  private async measureDatabaseLatency(): Promise<{ avgLatency: number; maxLatency: number }> {
    const queries = [
      () => this.prisma.organization.findMany({ take: 10 }),
      () => this.prisma.employee.findMany({ take: 10 }),
      () => this.prisma.device.findMany({ take: 10 }),
      () => this.prisma.user.findMany({ take: 10 }),
    ];

    const measurements: number[] = [];
    const iterations = 50;

    for (const query of queries) {
      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        
        try {
          await query();
          
          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
          measurements.push(duration);
        } catch (error) {
          this.logger.warn(`Database measurement failed: ${error.message}`);
        }
      }
    }

    const avgLatency = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
    const maxLatency = Math.max(...measurements);

    return { avgLatency, maxLatency };
  }

  private async measureThroughput(): Promise<{ requestsPerSecond: number }> {
    const duration = 10000; // 10 seconds
    const startTime = Date.now();
    let requestCount = 0;

    // Simulate concurrent requests
    const promises: Promise<void>[] = [];
    
    while (Date.now() - startTime < duration) {
      const promise = this.simulateApiCall('/api/health').then(() => {
        requestCount++;
      }).catch(() => {
        // Ignore errors for throughput measurement
      });
      
      promises.push(promise);
      
      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    await Promise.allSettled(promises);

    const actualDuration = (Date.now() - startTime) / 1000; // Convert to seconds
    const requestsPerSecond = requestCount / actualDuration;

    return { requestsPerSecond };
  }

  private async measureSystemResources(): Promise<{ memoryUsage: number; cpuUsage: number }> {
    const memoryUsage = process.memoryUsage();
    
    // Simple CPU usage measurement
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 1000));
    const endUsage = process.cpuUsage(startUsage);
    
    const cpuUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds

    return {
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // Convert to MB
      cpuUsage,
    };
  }

  private async simulateApiCall(endpoint: string): Promise<void> {
    // Simulate API call with actual database query
    switch (endpoint) {
      case '/api/health':
        await this.prisma.$queryRaw`SELECT 1`;
        break;
      case '/api/organizations':
        await this.prisma.organization.findMany({ take: 1 });
        break;
      case '/api/employees':
        await this.prisma.employee.findMany({ take: 1 });
        break;
      case '/api/devices':
        await this.prisma.device.findMany({ take: 1 });
        break;
      default:
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    }
  }

  private async storeBaseline(baseline: BaselineMetrics): Promise<void> {
    try {
      await this.prisma.performanceBaseline.create({
        data: {
          apiResponseTime95th: baseline.apiResponseTime95th,
          dbQueryLatency: baseline.dbQueryLatency,
          throughputRps: baseline.throughputRps,
          memoryUsage: baseline.memoryUsage,
          cpuUsage: baseline.cpuUsage,
          timestamp: baseline.timestamp,
          environment: baseline.environment,
          version: baseline.version,
        },
      });

      this.logger.log('Baseline metrics stored successfully');
    } catch (error) {
      this.logger.error('Failed to store baseline metrics', error);
      throw error;
    }
  }

  async getLatestBaseline(environment?: string): Promise<BaselineMetrics | null> {
    const baseline = await this.prisma.performanceBaseline.findFirst({
      where: environment ? { environment } : undefined,
      orderBy: { timestamp: 'desc' },
    });

    if (!baseline) {
      return null;
    }

    return {
      apiResponseTime95th: baseline.apiResponseTime95th,
      dbQueryLatency: baseline.dbQueryLatency,
      throughputRps: baseline.throughputRps,
      memoryUsage: baseline.memoryUsage,
      cpuUsage: baseline.cpuUsage,
      timestamp: baseline.timestamp,
      environment: baseline.environment,
      version: baseline.version,
    };
  }

  async compareWithBaseline(current: BaselineMetrics): Promise<PerformanceComparison> {
    const baseline = await this.getLatestBaseline(current.environment);
    
    if (!baseline) {
      throw new Error('No baseline found for comparison');
    }

    const improvements = {
      apiResponseTime: ((baseline.apiResponseTime95th - current.apiResponseTime95th) / baseline.apiResponseTime95th) * 100,
      dbQueryLatency: ((baseline.dbQueryLatency - current.dbQueryLatency) / baseline.dbQueryLatency) * 100,
      throughputRps: ((current.throughputRps - baseline.throughputRps) / baseline.throughputRps) * 100,
    };

    // Check if meets 20% improvement target for API response time and 15% for DB latency
    const meetsTargets = improvements.apiResponseTime >= 20 && improvements.dbQueryLatency >= 15;

    return {
      current,
      baseline,
      improvements,
      meetsTargets,
    };
  }

  async validatePerformanceTargets(current: BaselineMetrics): Promise<{
    valid: boolean;
    details: string[];
  }> {
    const comparison = await this.compareWithBaseline(current);
    const details: string[] = [];

    if (comparison.improvements.apiResponseTime < 20) {
      details.push(`API response time improvement: ${comparison.improvements.apiResponseTime.toFixed(2)}% (target: 20%)`);
    }

    if (comparison.improvements.dbQueryLatency < 15) {
      details.push(`DB query latency improvement: ${comparison.improvements.dbQueryLatency.toFixed(2)}% (target: 15%)`);
    }

    if (comparison.improvements.throughputRps < 0) {
      details.push(`Throughput decreased by ${Math.abs(comparison.improvements.throughputRps).toFixed(2)}%`);
    }

    return {
      valid: comparison.meetsTargets,
      details,
    };
  }
}