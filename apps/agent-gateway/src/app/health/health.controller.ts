import { Controller, Get, Logger } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import { HealthService } from './health.service';
import { MetricsService } from './metrics.service';
import { SystemMonitoringService } from './system-monitoring.service';
import { PerformanceTrackingService } from './performance-tracking.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
    private readonly systemMonitoring: SystemMonitoringService,
    private readonly performanceTracking: PerformanceTrackingService,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.healthService.checkDatabase(),
      () => this.healthService.checkBuffer(),
      () => this.healthService.checkUplink(),
      () => this.healthService.checkWebSocket(),
      () => this.healthService.checkDiskSpace(),
      () => this.healthService.checkMemory(),
    ]);
  }

  @Get('liveness')
  async liveness(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('readiness')
  async readiness(): Promise<{
    status: string;
    ready: boolean;
    checks: Record<string, boolean>;
    timestamp: string;
  }> {
    const checks = await this.healthService.getReadinessChecks();
    const ready = Object.values(checks).every(check => check);

    return {
      status: ready ? 'ready' : 'not_ready',
      ready,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('detailed')
  async detailed(): Promise<{
    status: string;
    components: Record<string, any>;
    system: any;
    performance: any;
    timestamp: string;
  }> {
    const [components, system, performance] = await Promise.all([
      this.healthService.getDetailedHealth(),
      this.systemMonitoring.getSystemInfo(),
      this.performanceTracking.getCurrentMetrics(),
    ]);

    const overallStatus = this.determineOverallStatus(components);

    return {
      status: overallStatus,
      components,
      system,
      performance,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  async metrics(): Promise<{
    application: any;
    system: any;
    performance: any;
    timestamp: string;
  }> {
    const [application, system, performance] = await Promise.all([
      this.metricsService.getApplicationMetrics(),
      this.systemMonitoring.getSystemMetrics(),
      this.performanceTracking.getPerformanceMetrics(),
    ]);

    return {
      application,
      system,
      performance,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('status')
  async status(): Promise<{
    gateway: {
      status: string;
      uptime: number;
      version: string;
    };
    components: {
      buffer: any;
      uplink: any;
      websocket: any;
      database: any;
    };
    timestamp: string;
  }> {
    const startTime = process.uptime();
    const version = process.env.npm_package_version || '1.0.0';

    const [buffer, uplink, websocket, database] = await Promise.all([
      this.healthService.getBufferStatus(),
      this.healthService.getUplinkStatus(),
      this.healthService.getWebSocketStatus(),
      this.healthService.getDatabaseStatus(),
    ]);

    return {
      gateway: {
        status: 'running',
        uptime: startTime,
        version,
      },
      components: {
        buffer,
        uplink,
        websocket,
        database,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('performance')
  async performance(): Promise<{
    current: any;
    history: any;
    alerts: any[];
    recommendations: string[];
    timestamp: string;
  }> {
    const [current, history, alerts, recommendations] = await Promise.all([
      this.performanceTracking.getCurrentMetrics(),
      this.performanceTracking.getHistoricalMetrics(24), // Last 24 hours
      this.performanceTracking.getActiveAlerts(),
      this.performanceTracking.getPerformanceRecommendations(),
    ]);

    return {
      current,
      history,
      alerts,
      recommendations: recommendations.map(r => r.title),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('alerts')
  async alerts(): Promise<{
    active: any[];
    recent: any[];
    summary: {
      total: number;
      critical: number;
      warning: number;
      info: number;
    };
    timestamp: string;
  }> {
    const [active, recent] = await Promise.all([
      this.performanceTracking.getActiveAlerts(),
      this.performanceTracking.getRecentAlerts(24), // Last 24 hours
    ]);

    const summary = {
      total: active.length,
      critical: active.filter(alert => alert.severity === 'critical').length,
      warning: active.filter(alert => alert.severity === 'warning').length,
      info: active.filter(alert => alert.severity === 'info').length,
    };

    return {
      active,
      recent,
      summary,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('prometheus')
  async prometheus(): Promise<string> {
    return await this.metricsService.getPrometheusMetrics();
  }

  private determineOverallStatus(components: Record<string, any>): string {
    const statuses = Object.values(components).map(component => component.status);
    
    if (statuses.some(status => status === 'critical' || status === 'down')) {
      return 'critical';
    }
    
    if (statuses.some(status => status === 'warning' || status === 'degraded')) {
      return 'warning';
    }
    
    return 'healthy';
  }
}