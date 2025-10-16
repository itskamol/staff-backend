import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram, register } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectMetric('http_requests_total') private readonly httpRequestsTotal: Counter<string>,
    @InjectMetric('http_request_duration_seconds') private readonly httpRequestDuration: Histogram<string>,
    @InjectMetric('buffer_records_total') private readonly bufferRecordsTotal: Gauge<string>,
    @InjectMetric('uplink_requests_total') private readonly uplinkRequestsTotal: Counter<string>,
    @InjectMetric('websocket_messages_total') private readonly websocketMessagesTotal: Counter<string>,
    @InjectMetric('system_memory_usage_bytes') private readonly systemMemoryUsage: Gauge<string>,
    @InjectMetric('system_cpu_usage_percent') private readonly systemCpuUsage: Gauge<string>,
    @InjectMetric('disk_usage_bytes') private readonly diskUsage: Gauge<string>,
  ) {
    this.initializeCustomMetrics();
  }

  private initializeCustomMetrics(): void {
    // Register custom metrics
    register.registerMetric(new Counter({
      name: 'agent_gateway_data_ingestion_total',
      help: 'Total number of data records ingested',
      labelNames: ['agent_id', 'data_type', 'status'],
    }));

    register.registerMetric(new Histogram({
      name: 'agent_gateway_processing_duration_seconds',
      help: 'Time spent processing data records',
      labelNames: ['operation', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
    }));

    register.registerMetric(new Gauge({
      name: 'agent_gateway_active_connections',
      help: 'Number of active agent connections',
      labelNames: ['connection_type'],
    }));

    register.registerMetric(new Counter({
      name: 'agent_gateway_errors_total',
      help: 'Total number of errors by type',
      labelNames: ['error_type', 'component'],
    }));

    register.registerMetric(new Gauge({
      name: 'agent_gateway_queue_size',
      help: 'Current size of various queues',
      labelNames: ['queue_type'],
    }));
  }

  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
    this.httpRequestDuration.observe({ method, route }, duration / 1000);
  }

  recordDataIngestion(agentId: string, dataType: string, status: 'success' | 'failed', count: number = 1): void {
    const metric = register.getSingleMetric('agent_gateway_data_ingestion_total') as Counter<string>;
    metric?.inc({ agent_id: agentId, data_type: dataType, status }, count);
  }

  recordProcessingDuration(operation: string, status: 'success' | 'failed', duration: number): void {
    const metric = register.getSingleMetric('agent_gateway_processing_duration_seconds') as Histogram<string>;
    metric?.observe({ operation, status }, duration / 1000);
  }

  updateBufferMetrics(totalRecords: number, recordsByTable: Record<string, number>): void {
    this.bufferRecordsTotal.set({ table: 'total' }, totalRecords);
    
    Object.entries(recordsByTable).forEach(([table, count]) => {
      this.bufferRecordsTotal.set({ table }, count);
    });
  }

  recordUplinkRequest(status: 'success' | 'failed', endpoint?: string): void {
    this.uplinkRequestsTotal.inc({ status, endpoint: endpoint || 'unknown' });
  }

  recordWebSocketMessage(direction: 'sent' | 'received', messageType: string): void {
    this.websocketMessagesTotal.inc({ direction, message_type: messageType });
  }

  updateSystemMetrics(memoryUsage: NodeJS.MemoryUsage, cpuUsage: number): void {
    this.systemMemoryUsage.set({ type: 'heap_used' }, memoryUsage.heapUsed);
    this.systemMemoryUsage.set({ type: 'heap_total' }, memoryUsage.heapTotal);
    this.systemMemoryUsage.set({ type: 'external' }, memoryUsage.external);
    this.systemMemoryUsage.set({ type: 'rss' }, memoryUsage.rss);
    
    this.systemCpuUsage.set(cpuUsage);
  }

  updateDiskUsage(path: string, usedBytes: number, totalBytes: number): void {
    this.diskUsage.set({ path, type: 'used' }, usedBytes);
    this.diskUsage.set({ path, type: 'total' }, totalBytes);
  }

  updateActiveConnections(connectionType: string, count: number): void {
    const metric = register.getSingleMetric('agent_gateway_active_connections') as Gauge<string>;
    metric?.set({ connection_type: connectionType }, count);
  }

  recordError(errorType: string, component: string, count: number = 1): void {
    const metric = register.getSingleMetric('agent_gateway_errors_total') as Counter<string>;
    metric?.inc({ error_type: errorType, component }, count);
  }

  updateQueueSize(queueType: string, size: number): void {
    const metric = register.getSingleMetric('agent_gateway_queue_size') as Gauge<string>;
    metric?.set({ queue_type: queueType }, size);
  }

  async getApplicationMetrics(): Promise<{
    httpRequests: any;
    dataIngestion: any;
    processing: any;
    errors: any;
    queues: any;
  }> {
    const metrics = await register.metrics();
    
    return {
      httpRequests: {
        total: await this.getMetricValue('http_requests_total'),
        duration: await this.getMetricValue('http_request_duration_seconds'),
      },
      dataIngestion: {
        total: await this.getMetricValue('agent_gateway_data_ingestion_total'),
        rate: await this.calculateRate('agent_gateway_data_ingestion_total'),
      },
      processing: {
        duration: await this.getMetricValue('agent_gateway_processing_duration_seconds'),
        averageDuration: await this.calculateAverage('agent_gateway_processing_duration_seconds'),
      },
      errors: {
        total: await this.getMetricValue('agent_gateway_errors_total'),
        rate: await this.calculateRate('agent_gateway_errors_total'),
      },
      queues: {
        sizes: await this.getMetricValue('agent_gateway_queue_size'),
      },
    };
  }

  private async getMetricValue(metricName: string): Promise<any> {
    try {
      const metric = register.getSingleMetric(metricName);
      if (!metric) return null;
      
      return await metric.get();
    } catch (error) {
      this.logger.error(`Failed to get metric ${metricName}: ${error.message}`);
      return null;
    }
  }

  private async calculateRate(metricName: string, windowMinutes: number = 5): Promise<number> {
    try {
      // This is a simplified rate calculation
      // In production, you'd want to use a proper time series database
      const metric = register.getSingleMetric(metricName) as Counter<string>;
      if (!metric) return 0;
      
      const value = await metric.get();
      const totalValue = Array.isArray(value.values) 
        ? value.values.reduce((sum, v) => sum + v.value, 0)
        : value.values || 0;
      
      return totalValue / (windowMinutes * 60); // per second
    } catch (error) {
      this.logger.error(`Failed to calculate rate for ${metricName}: ${error.message}`);
      return 0;
    }
  }

  private async calculateAverage(metricName: string): Promise<number> {
    try {
      const metric = register.getSingleMetric(metricName) as Histogram<string>;
      if (!metric) return 0;
      
      const value = await metric.get();
      if (!Array.isArray(value.values)) return 0;
      
      let totalSum = 0;
      let totalCount = 0;
      
      value.values.forEach(v => {
        if (v.metricName?.endsWith('_sum')) {
          totalSum += v.value;
        } else if (v.metricName?.endsWith('_count')) {
          totalCount += v.value;
        }
      });
      
      return totalCount > 0 ? totalSum / totalCount : 0;
    } catch (error) {
      this.logger.error(`Failed to calculate average for ${metricName}: ${error.message}`);
      return 0;
    }
  }

  async getPrometheusMetrics(): Promise<string> {
    return await register.metrics();
  }

  async resetMetrics(): Promise<void> {
    register.resetMetrics();
    this.logger.log('All metrics have been reset');
  }

  async getMetricsSummary(): Promise<{
    totalMetrics: number;
    metricNames: string[];
    lastUpdated: Date;
  }> {
    const metricNames = register.getMetricsAsArray().map(m => m.name);
    
    return {
      totalMetrics: metricNames.length,
      metricNames,
      lastUpdated: new Date(),
    };
  }
}