import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DualPrismaService, ConnectionHealth } from './dual-prisma.service';
import { QueryRoutingService, QueryMetrics } from './query-routing.service';

export interface HealthCheckResult {
  timestamp: Date;
  postgresql: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    connectionCount: number;
    error?: string;
  };
  timescale: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    connectionCount: number;
    error?: string;
  };
  routing: {
    efficiency: number;
    fallbackRate: number;
    errorRate: number;
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

export interface HealthAlert {
  id: string;
  severity: 'warning' | 'critical';
  component: 'postgresql' | 'timescale' | 'routing' | 'overall';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

@Injectable()
export class DatasourceHealthService {
  private readonly logger = new Logger(DatasourceHealthService.name);
  
  private healthHistory: HealthCheckResult[] = [];
  private activeAlerts: Map<string, HealthAlert> = new Map();
  private alertCounter = 0;
  
  // Health thresholds
  private readonly thresholds = {
    latency: {
      warning: 100, // ms
      critical: 500, // ms
    },
    errorRate: {
      warning: 0.05, // 5%
      critical: 0.1,  // 10%
    },
    fallbackRate: {
      warning: 0.1,  // 10%
      critical: 0.3,  // 30%
    },
    efficiency: {
      warning: 90,   // 90%
      critical: 80,  // 80%
    },
  };

  constructor(
    private readonly config: ConfigService,
    private readonly dualPrisma: DualPrismaService,
    private readonly queryRouting: QueryRoutingService,
  ) {
    // Keep last 24 hours of health data (assuming 1-minute intervals)
    const maxHistorySize = parseInt(this.config.get('HEALTH_HISTORY_SIZE', '1440'));
    this.healthHistory = [];
  }

  /**
   * Performs comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date();
    
    try {
      // Get connection health
      const connectionHealth = this.dualPrisma.getConnectionHealth();
      const connectionStats = await this.dualPrisma.getConnectionStats();
      const queryMetrics = this.queryRouting.getQueryMetrics();

      // Evaluate PostgreSQL health
      const postgresqlHealth = this.evaluatePostgreSQLHealth(
        connectionHealth.postgresql,
        connectionStats.postgresql
      );

      // Evaluate TimescaleDB health
      const timescaleHealth = this.evaluateTimescaleHealth(
        connectionHealth.timescale,
        connectionStats.timescale
      );

      // Evaluate routing health
      const routingHealth = this.evaluateRoutingHealth(queryMetrics);

      // Determine overall health
      const overall = this.determineOverallHealth(
        postgresqlHealth.status,
        timescaleHealth.status,
        routingHealth
      );

      const result: HealthCheckResult = {
        timestamp,
        postgresql: postgresqlHealth,
        timescale: timescaleHealth,
        routing: routingHealth,
        overall,
      };

      // Store in history
      this.addToHistory(result);

      // Check for alerts
      await this.checkAndGenerateAlerts(result);

      return result;

    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      
      const errorResult: HealthCheckResult = {
        timestamp,
        postgresql: {
          status: 'unhealthy',
          latency: 0,
          connectionCount: 0,
          error: error.message,
        },
        timescale: {
          status: 'unhealthy',
          latency: 0,
          connectionCount: 0,
          error: error.message,
        },
        routing: {
          efficiency: 0,
          fallbackRate: 1,
          errorRate: 1,
        },
        overall: 'unhealthy',
      };

      this.addToHistory(errorResult);
      return errorResult;
    }
  }

  private evaluatePostgreSQLHealth(
    connectionHealth: ConnectionHealth['postgresql'],
    connectionStats: { activeConnections: number; totalConnections: number }
  ) {
    if (!connectionHealth.connected) {
      return {
        status: 'unhealthy' as const,
        latency: 0,
        connectionCount: connectionStats.activeConnections,
        error: connectionHealth.error,
      };
    }

    const latency = connectionHealth.latency || 0;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (latency > this.thresholds.latency.critical) {
      status = 'unhealthy';
    } else if (latency > this.thresholds.latency.warning) {
      status = 'degraded';
    }

    return {
      status,
      latency,
      connectionCount: connectionStats.activeConnections,
    };
  }

  private evaluateTimescaleHealth(
    connectionHealth: ConnectionHealth['timescale'],
    connectionStats: { activeConnections: number; totalConnections: number }
  ) {
    if (!connectionHealth.connected) {
      return {
        status: 'unhealthy' as const,
        latency: 0,
        connectionCount: connectionStats.activeConnections,
        error: connectionHealth.error,
      };
    }

    const latency = connectionHealth.latency || 0;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (latency > this.thresholds.latency.critical) {
      status = 'unhealthy';
    } else if (latency > this.thresholds.latency.warning) {
      status = 'degraded';
    }

    return {
      status,
      latency,
      connectionCount: connectionStats.activeConnections,
    };
  }

  private evaluateRoutingHealth(queryMetrics: QueryMetrics) {
    const totalQueries = queryMetrics.totalQueries;
    
    if (totalQueries === 0) {
      return {
        efficiency: 100,
        fallbackRate: 0,
        errorRate: 0,
      };
    }

    const fallbackRate = queryMetrics.fallbackQueries / totalQueries;
    const efficiency = ((queryMetrics.timescaleQueries + queryMetrics.postgresQueries) / totalQueries) * 100;

    return {
      efficiency,
      fallbackRate,
      errorRate: queryMetrics.errorRate,
    };
  }

  private determineOverallHealth(
    postgresqlStatus: 'healthy' | 'degraded' | 'unhealthy',
    timescaleStatus: 'healthy' | 'degraded' | 'unhealthy',
    routingHealth: { efficiency: number; fallbackRate: number; errorRate: number }
  ): 'healthy' | 'degraded' | 'unhealthy' {
    // If PostgreSQL is unhealthy, overall is unhealthy
    if (postgresqlStatus === 'unhealthy') {
      return 'unhealthy';
    }

    // If routing has critical issues, overall is unhealthy
    if (routingHealth.errorRate > this.thresholds.errorRate.critical ||
        routingHealth.efficiency < this.thresholds.efficiency.critical) {
      return 'unhealthy';
    }

    // If TimescaleDB is unhealthy but fallback rate is acceptable, degraded
    if (timescaleStatus === 'unhealthy' && 
        routingHealth.fallbackRate < this.thresholds.fallbackRate.critical) {
      return 'degraded';
    }

    // If any component is degraded, overall is degraded
    if (postgresqlStatus === 'degraded' || 
        timescaleStatus === 'degraded' ||
        routingHealth.errorRate > this.thresholds.errorRate.warning ||
        routingHealth.fallbackRate > this.thresholds.fallbackRate.warning ||
        routingHealth.efficiency < this.thresholds.efficiency.warning) {
      return 'degraded';
    }

    return 'healthy';
  }

  private addToHistory(result: HealthCheckResult): void {
    this.healthHistory.push(result);
    
    // Keep only recent history
    const maxSize = parseInt(this.config.get('HEALTH_HISTORY_SIZE', '1440'));
    if (this.healthHistory.length > maxSize) {
      this.healthHistory = this.healthHistory.slice(-maxSize);
    }
  }

  private async checkAndGenerateAlerts(result: HealthCheckResult): Promise<void> {
    // Check PostgreSQL alerts
    this.checkComponentAlert(
      'postgresql-latency',
      'postgresql',
      result.postgresql.latency > this.thresholds.latency.critical ? 'critical' : 
      result.postgresql.latency > this.thresholds.latency.warning ? 'warning' : null,
      `PostgreSQL latency is ${result.postgresql.latency}ms`
    );

    this.checkComponentAlert(
      'postgresql-connection',
      'postgresql',
      !result.postgresql.error ? null : 'critical',
      `PostgreSQL connection error: ${result.postgresql.error}`
    );

    // Check TimescaleDB alerts
    this.checkComponentAlert(
      'timescale-latency',
      'timescale',
      result.timescale.latency > this.thresholds.latency.critical ? 'critical' : 
      result.timescale.latency > this.thresholds.latency.warning ? 'warning' : null,
      `TimescaleDB latency is ${result.timescale.latency}ms`
    );

    this.checkComponentAlert(
      'timescale-connection',
      'timescale',
      !result.timescale.error ? null : 'critical',
      `TimescaleDB connection error: ${result.timescale.error}`
    );

    // Check routing alerts
    this.checkComponentAlert(
      'routing-efficiency',
      'routing',
      result.routing.efficiency < this.thresholds.efficiency.critical ? 'critical' :
      result.routing.efficiency < this.thresholds.efficiency.warning ? 'warning' : null,
      `Query routing efficiency is ${result.routing.efficiency.toFixed(1)}%`
    );

    this.checkComponentAlert(
      'routing-fallback',
      'routing',
      result.routing.fallbackRate > this.thresholds.fallbackRate.critical ? 'critical' :
      result.routing.fallbackRate > this.thresholds.fallbackRate.warning ? 'warning' : null,
      `Fallback rate is ${(result.routing.fallbackRate * 100).toFixed(1)}%`
    );

    this.checkComponentAlert(
      'routing-errors',
      'routing',
      result.routing.errorRate > this.thresholds.errorRate.critical ? 'critical' :
      result.routing.errorRate > this.thresholds.errorRate.warning ? 'warning' : null,
      `Query error rate is ${(result.routing.errorRate * 100).toFixed(1)}%`
    );

    // Check overall health alert
    this.checkComponentAlert(
      'overall-health',
      'overall',
      result.overall === 'unhealthy' ? 'critical' :
      result.overall === 'degraded' ? 'warning' : null,
      `Overall system health is ${result.overall}`
    );
  }

  private checkComponentAlert(
    alertId: string,
    component: 'postgresql' | 'timescale' | 'routing' | 'overall',
    severity: 'warning' | 'critical' | null,
    message: string
  ): void {
    const existingAlert = this.activeAlerts.get(alertId);

    if (severity) {
      if (!existingAlert) {
        // Create new alert
        const alert: HealthAlert = {
          id: alertId,
          severity,
          component,
          message,
          timestamp: new Date(),
          resolved: false,
        };

        this.activeAlerts.set(alertId, alert);
        this.logger.warn(`Health alert created: ${alertId} - ${message}`);
        
        // Emit alert event (could be used for notifications)
        this.emitAlertEvent('created', alert);
      } else if (existingAlert.severity !== severity) {
        // Update alert severity
        existingAlert.severity = severity;
        existingAlert.message = message;
        existingAlert.timestamp = new Date();
        
        this.logger.warn(`Health alert updated: ${alertId} - ${message}`);
        this.emitAlertEvent('updated', existingAlert);
      }
    } else if (existingAlert && !existingAlert.resolved) {
      // Resolve alert
      existingAlert.resolved = true;
      existingAlert.resolvedAt = new Date();
      
      this.logger.log(`Health alert resolved: ${alertId}`);
      this.emitAlertEvent('resolved', existingAlert);
      
      // Remove resolved alerts after some time
      setTimeout(() => {
        this.activeAlerts.delete(alertId);
      }, 300000); // 5 minutes
    }
  }

  private emitAlertEvent(type: 'created' | 'updated' | 'resolved', alert: HealthAlert): void {
    // This could be extended to send notifications via email, Slack, etc.
    this.logger.log(`Alert event: ${type} - ${alert.id} (${alert.severity})`);
  }

  /**
   * Scheduled health check (runs every minute)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledHealthCheck(): Promise<void> {
    try {
      await this.performHealthCheck();
    } catch (error) {
      this.logger.error(`Scheduled health check failed: ${error.message}`);
    }
  }

  /**
   * Gets current health status
   */
  async getCurrentHealth(): Promise<HealthCheckResult> {
    return await this.performHealthCheck();
  }

  /**
   * Gets health history
   */
  getHealthHistory(hours: number = 24): HealthCheckResult[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.healthHistory.filter(h => h.timestamp >= cutoff);
  }

  /**
   * Gets active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return Array.from(this.activeAlerts.values()).filter(a => !a.resolved);
  }

  /**
   * Gets all alerts (including resolved)
   */
  getAllAlerts(): HealthAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Manually resolves an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      
      this.logger.log(`Alert manually resolved: ${alertId}`);
      this.emitAlertEvent('resolved', alert);
      
      return true;
    }
    
    return false;
  }

  /**
   * Gets health statistics
   */
  getHealthStatistics(hours: number = 24): {
    uptime: {
      postgresql: number;
      timescale: number;
      overall: number;
    };
    averageLatency: {
      postgresql: number;
      timescale: number;
    };
    alertCounts: {
      total: number;
      critical: number;
      warning: number;
      resolved: number;
    };
  } {
    const history = this.getHealthHistory(hours);
    
    if (history.length === 0) {
      return {
        uptime: { postgresql: 0, timescale: 0, overall: 0 },
        averageLatency: { postgresql: 0, timescale: 0 },
        alertCounts: { total: 0, critical: 0, warning: 0, resolved: 0 },
      };
    }

    // Calculate uptime percentages
    const postgresqlHealthy = history.filter(h => h.postgresql.status !== 'unhealthy').length;
    const timescaleHealthy = history.filter(h => h.timescale.status !== 'unhealthy').length;
    const overallHealthy = history.filter(h => h.overall !== 'unhealthy').length;

    const uptime = {
      postgresql: (postgresqlHealthy / history.length) * 100,
      timescale: (timescaleHealthy / history.length) * 100,
      overall: (overallHealthy / history.length) * 100,
    };

    // Calculate average latencies
    const avgPostgresLatency = history.reduce((sum, h) => sum + h.postgresql.latency, 0) / history.length;
    const avgTimescaleLatency = history.reduce((sum, h) => sum + h.timescale.latency, 0) / history.length;

    const averageLatency = {
      postgresql: avgPostgresLatency,
      timescale: avgTimescaleLatency,
    };

    // Count alerts
    const allAlerts = this.getAllAlerts();
    const alertCounts = {
      total: allAlerts.length,
      critical: allAlerts.filter(a => a.severity === 'critical').length,
      warning: allAlerts.filter(a => a.severity === 'warning').length,
      resolved: allAlerts.filter(a => a.resolved).length,
    };

    return {
      uptime,
      averageLatency,
      alertCounts,
    };
  }

  /**
   * Clears health history
   */
  clearHistory(): void {
    this.healthHistory = [];
    this.logger.log('Health history cleared');
  }

  /**
   * Updates health thresholds
   */
  updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    Object.assign(this.thresholds, newThresholds);
    this.logger.log('Health thresholds updated', this.thresholds);
  }

  /**
   * Gets current thresholds
   */
  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }
}