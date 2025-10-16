import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DualPrismaService } from './dual-prisma.service';
import { QueryRoutingService } from './query-routing.service';
import { DatasourceHealthService } from './datasource-health.service';
import { FallbackRecoveryService } from './fallback-recovery.service';
import { BufferedSyncService } from './buffered-sync.service';

export interface TimescaleIntegrationStatus {
  timescaleAvailable: boolean;
  fallbackActive: boolean;
  syncQueueSize: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck: Date;
  connectionStats: {
    postgresql: { connected: boolean; latency: number };
    timescale: { connected: boolean; latency: number };
  };
  routingStats: {
    efficiency: number;
    fallbackRate: number;
    errorRate: number;
  };
}

export interface MonitoringDataInsert {
  tableName: 'active_windows' | 'visited_sites' | 'screenshots' | 'user_sessions';
  data: any;
  priority?: number;
}

export interface MonitoringDataQuery {
  tableName: string;
  filters: {
    organizationId: number;
    agentId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  };
  useUnifiedView?: boolean; // Query both TimescaleDB and fallback data
}

@Injectable()
export class TimescaleIntegrationService implements OnModuleInit {
  private readonly logger = new Logger(TimescaleIntegrationService.name);
  private initialized = false;

  constructor(
    private readonly config: ConfigService,
    private readonly dualPrisma: DualPrismaService,
    private readonly queryRouting: QueryRoutingService,
    private readonly datasourceHealth: DatasourceHealthService,
    private readonly fallbackRecovery: FallbackRecoveryService,
    private readonly bufferedSync: BufferedSyncService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Initializing TimescaleDB integration');

      // Wait for dual Prisma service to be ready
      await this.waitForDualPrismaReady();

      // Perform initial health check
      await this.datasourceHealth.performHealthCheck();

      // Initialize fallback partitions if needed
      await this.initializeFallbackPartitions();

      this.initialized = true;
      this.logger.log('TimescaleDB integration initialized successfully');

    } catch (error) {
      this.logger.error(`Failed to initialize TimescaleDB integration: ${error.message}`);
      throw error;
    }
  }

  private async waitForDualPrismaReady(maxWaitTime: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const health = this.dualPrisma.getConnectionHealth();
        if (health.postgresql.connected) {
          return; // At least PostgreSQL is ready
        }
      } catch (error) {
        // Continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Timeout waiting for dual Prisma service to be ready');
  }

  private async initializeFallbackPartitions(): Promise<void> {
    try {
      const postgresClient = this.dualPrisma.postgres;
      await postgresClient.$executeRawUnsafe('SELECT fallback.ensure_future_partitions()');
      this.logger.log('Fallback partitions initialized');
    } catch (error) {
      this.logger.warn(`Failed to initialize fallback partitions: ${error.message}`);
    }
  }

  /**
   * Inserts monitoring data with automatic routing and fallback
   */
  async insertMonitoringData(insert: MonitoringDataInsert): Promise<string> {
    this.ensureInitialized();

    try {
      // Validate data
      this.validateMonitoringData(insert);

      // Check if we should use direct TimescaleDB or queue for sync
      const route = this.queryRouting.routeQuery(`INSERT INTO monitoring.${insert.tableName}`, 'INSERT', insert.tableName);
      
      if (route.datasource === 'timescale') {
        // Direct insert to TimescaleDB
        return await this.directInsertToTimescale(insert);
      } else if (route.datasource === 'fallback') {
        // Insert to PostgreSQL fallback
        return await this.insertToFallback(insert);
      } else {
        // Queue for buffered sync
        return this.bufferedSync.queueOperation(
          'INSERT',
          insert.tableName,
          insert.data,
          insert.priority || 3
        );
      }

    } catch (error) {
      this.logger.error(`Failed to insert monitoring data: ${error.message}`);
      
      // Fallback to PostgreSQL if TimescaleDB fails
      if (this.fallbackRecovery.getFallbackState().isActive) {
        return await this.insertToFallback(insert);
      }
      
      throw error;
    }
  }

  /**
   * Batch inserts monitoring data for high throughput
   */
  async batchInsertMonitoringData(inserts: MonitoringDataInsert[]): Promise<string[]> {
    this.ensureInitialized();

    if (inserts.length === 0) {
      return [];
    }

    try {
      // Group by table name for efficient processing
      const groupedInserts = this.groupInsertsByTable(inserts);
      const results: string[] = [];

      for (const [tableName, tableInserts] of groupedInserts.entries()) {
        const route = this.queryRouting.routeQuery(`INSERT INTO monitoring.${tableName}`, 'BATCH_INSERT', tableName);
        
        if (route.datasource === 'timescale') {
          // Direct batch insert to TimescaleDB
          const result = await this.directBatchInsertToTimescale(tableName, tableInserts);
          results.push(result);
        } else if (route.datasource === 'fallback') {
          // Batch insert to PostgreSQL fallback
          const result = await this.batchInsertToFallback(tableName, tableInserts);
          results.push(result);
        } else {
          // Queue for buffered sync
          const queueId = this.bufferedSync.queueOperation(
            'BATCH_INSERT',
            tableName,
            tableInserts.map(i => i.data),
            Math.min(...tableInserts.map(i => i.priority || 3))
          );
          results.push(queueId);
        }
      }

      return results;

    } catch (error) {
      this.logger.error(`Failed to batch insert monitoring data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Queries monitoring data with automatic routing and fallback
   */
  async queryMonitoringData(query: MonitoringDataQuery): Promise<any[]> {
    this.ensureInitialized();

    try {
      const route = this.queryRouting.routeQuery(`SELECT FROM monitoring.${query.tableName}`, 'SELECT', query.tableName);
      
      if (query.useUnifiedView) {
        // Query unified view that combines TimescaleDB and fallback data
        return await this.queryUnifiedView(query);
      } else if (route.datasource === 'timescale') {
        // Query TimescaleDB directly
        return await this.queryTimescale(query);
      } else {
        // Query PostgreSQL fallback
        return await this.queryFallback(query);
      }

    } catch (error) {
      this.logger.error(`Failed to query monitoring data: ${error.message}`);
      
      // Fallback to PostgreSQL if TimescaleDB fails
      if (route.datasource === 'timescale' && route.fallbackAvailable) {
        this.logger.warn('Falling back to PostgreSQL for query');
        return await this.queryFallback(query);
      }
      
      throw error;
    }
  }

  private async directInsertToTimescale(insert: MonitoringDataInsert): Promise<string> {
    const timescaleClient = this.dualPrisma.timescale;
    if (!timescaleClient) {
      throw new Error('TimescaleDB client not available');
    }

    const columns = Object.keys(insert.data);
    const values = Object.values(insert.data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO monitoring.${insert.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING id
    `;

    const result = await timescaleClient.query(query, values);
    return result.rows[0]?.id || 'inserted';
  }

  private async directBatchInsertToTimescale(tableName: string, inserts: MonitoringDataInsert[]): Promise<string> {
    const timescaleClient = this.dualPrisma.timescale;
    if (!timescaleClient) {
      throw new Error('TimescaleDB client not available');
    }

    const records = inserts.map(i => i.data);
    const columns = Object.keys(records[0]);
    const values = records.flatMap(record => columns.map(col => record[col]));
    
    const placeholders = records.map((_, recordIndex) => {
      const start = recordIndex * columns.length + 1;
      const recordPlaceholders = columns.map((_, colIndex) => `$${start + colIndex}`);
      return `(${recordPlaceholders.join(', ')})`;
    }).join(', ');

    const query = `
      INSERT INTO monitoring.${tableName} (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT DO NOTHING
    `;

    await timescaleClient.query(query, values);
    return `batch_inserted_${records.length}`;
  }

  private async insertToFallback(insert: MonitoringDataInsert): Promise<string> {
    const postgresClient = this.dualPrisma.postgres;
    const fallbackTableName = `${insert.tableName}_fallback`;

    const columns = Object.keys(insert.data);
    const values = Object.values(insert.data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO fallback.${fallbackTableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING id
    `;

    const result = await postgresClient.$queryRawUnsafe(query, ...values);
    return (result as any)[0]?.id || 'inserted_fallback';
  }

  private async batchInsertToFallback(tableName: string, inserts: MonitoringDataInsert[]): Promise<string> {
    const postgresClient = this.dualPrisma.postgres;
    const fallbackTableName = `${tableName}_fallback`;

    const records = inserts.map(i => i.data);
    const columns = Object.keys(records[0]);
    const values = records.flatMap(record => columns.map(col => record[col]));
    
    const placeholders = records.map((_, recordIndex) => {
      const start = recordIndex * columns.length + 1;
      const recordPlaceholders = columns.map((_, colIndex) => `$${start + colIndex}`);
      return `(${recordPlaceholders.join(', ')})`;
    }).join(', ');

    const query = `
      INSERT INTO fallback.${fallbackTableName} (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT DO NOTHING
    `;

    await postgresClient.$executeRawUnsafe(query, ...values);
    return `batch_inserted_fallback_${records.length}`;
  }

  private async queryTimescale(query: MonitoringDataQuery): Promise<any[]> {
    const timescaleClient = this.dualPrisma.timescale;
    if (!timescaleClient) {
      throw new Error('TimescaleDB client not available');
    }

    let sql = `SELECT * FROM monitoring.${query.tableName} WHERE organization_id = $1`;
    const params = [query.filters.organizationId];
    let paramIndex = 2;

    if (query.filters.agentId) {
      sql += ` AND agent_id = $${paramIndex}`;
      params.push(query.filters.agentId);
      paramIndex++;
    }

    if (query.filters.startDate) {
      sql += ` AND datetime >= $${paramIndex}`;
      params.push(query.filters.startDate);
      paramIndex++;
    }

    if (query.filters.endDate) {
      sql += ` AND datetime <= $${paramIndex}`;
      params.push(query.filters.endDate);
      paramIndex++;
    }

    sql += ` ORDER BY datetime DESC`;

    if (query.filters.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(query.filters.limit);
      paramIndex++;
    }

    if (query.filters.offset) {
      sql += ` OFFSET $${paramIndex}`;
      params.push(query.filters.offset);
    }

    const result = await timescaleClient.query(sql, params);
    return result.rows;
  }

  private async queryFallback(query: MonitoringDataQuery): Promise<any[]> {
    const postgresClient = this.dualPrisma.postgres;
    const fallbackTableName = `${query.tableName}_fallback`;

    let sql = `SELECT * FROM fallback.${fallbackTableName} WHERE organization_id = $1`;
    const params = [query.filters.organizationId];
    let paramIndex = 2;

    if (query.filters.agentId) {
      sql += ` AND agent_id = $${paramIndex}`;
      params.push(query.filters.agentId);
      paramIndex++;
    }

    if (query.filters.startDate) {
      sql += ` AND datetime >= $${paramIndex}`;
      params.push(query.filters.startDate);
      paramIndex++;
    }

    if (query.filters.endDate) {
      sql += ` AND datetime <= $${paramIndex}`;
      params.push(query.filters.endDate);
      paramIndex++;
    }

    sql += ` ORDER BY datetime DESC`;

    if (query.filters.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(query.filters.limit);
      paramIndex++;
    }

    if (query.filters.offset) {
      sql += ` OFFSET $${paramIndex}`;
      params.push(query.filters.offset);
    }

    const result = await postgresClient.$queryRawUnsafe(sql, ...params);
    return result as any[];
  }

  private async queryUnifiedView(query: MonitoringDataQuery): Promise<any[]> {
    const postgresClient = this.dualPrisma.postgres;
    const unifiedViewName = `${query.tableName}_unified`;

    let sql = `SELECT * FROM public.${unifiedViewName} WHERE organization_id = $1`;
    const params = [query.filters.organizationId];
    let paramIndex = 2;

    if (query.filters.agentId) {
      sql += ` AND agent_id = $${paramIndex}`;
      params.push(query.filters.agentId);
      paramIndex++;
    }

    if (query.filters.startDate) {
      sql += ` AND datetime >= $${paramIndex}`;
      params.push(query.filters.startDate);
      paramIndex++;
    }

    if (query.filters.endDate) {
      sql += ` AND datetime <= $${paramIndex}`;
      params.push(query.filters.endDate);
      paramIndex++;
    }

    sql += ` ORDER BY datetime DESC`;

    if (query.filters.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(query.filters.limit);
      paramIndex++;
    }

    if (query.filters.offset) {
      sql += ` OFFSET $${paramIndex}`;
      params.push(query.filters.offset);
    }

    const result = await postgresClient.$queryRawUnsafe(sql, ...params);
    return result as any[];
  }

  private groupInsertsByTable(inserts: MonitoringDataInsert[]): Map<string, MonitoringDataInsert[]> {
    const grouped = new Map<string, MonitoringDataInsert[]>();

    inserts.forEach(insert => {
      if (!grouped.has(insert.tableName)) {
        grouped.set(insert.tableName, []);
      }
      grouped.get(insert.tableName)!.push(insert);
    });

    return grouped;
  }

  private validateMonitoringData(insert: MonitoringDataInsert): void {
    if (!insert.tableName || !insert.data) {
      throw new Error('Invalid monitoring data: tableName and data are required');
    }

    // Validate required fields based on table
    const requiredFields = this.getRequiredFields(insert.tableName);
    for (const field of requiredFields) {
      if (!(field in insert.data)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  private getRequiredFields(tableName: string): string[] {
    const commonFields = ['agent_id', 'computer_uid', 'user_sid', 'datetime', 'organization_id'];
    
    switch (tableName) {
      case 'active_windows':
        return [...commonFields];
      case 'visited_sites':
        return [...commonFields, 'url'];
      case 'screenshots':
        return [...commonFields, 'file_path'];
      case 'user_sessions':
        return [...commonFields, 'session_type'];
      default:
        return commonFields;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('TimescaleDB integration service not initialized');
    }
  }

  /**
   * Gets comprehensive integration status
   */
  async getIntegrationStatus(): Promise<TimescaleIntegrationStatus> {
    const healthResult = await this.datasourceHealth.getCurrentHealth();
    const fallbackState = this.fallbackRecovery.getFallbackState();
    const syncMetrics = this.bufferedSync.getSyncMetrics();
    const queryMetrics = this.queryRouting.getQueryMetrics();

    return {
      timescaleAvailable: healthResult.timescale.status !== 'unhealthy',
      fallbackActive: fallbackState.isActive,
      syncQueueSize: syncMetrics.queueSize,
      healthStatus: healthResult.overall,
      lastHealthCheck: healthResult.timestamp,
      connectionStats: {
        postgresql: {
          connected: healthResult.postgresql.status !== 'unhealthy',
          latency: healthResult.postgresql.latency,
        },
        timescale: {
          connected: healthResult.timescale.status !== 'unhealthy',
          latency: healthResult.timescale.latency,
        },
      },
      routingStats: {
        efficiency: queryMetrics.totalQueries > 0 
          ? ((queryMetrics.timescaleQueries + queryMetrics.postgresQueries) / queryMetrics.totalQueries) * 100
          : 100,
        fallbackRate: queryMetrics.totalQueries > 0 
          ? (queryMetrics.fallbackQueries / queryMetrics.totalQueries) * 100
          : 0,
        errorRate: queryMetrics.errorRate * 100,
      },
    };
  }

  /**
   * Manually triggers fallback activation
   */
  async activateFallback(reason: string): Promise<void> {
    await this.fallbackRecovery.manuallyActivateFallback(reason);
  }

  /**
   * Manually triggers recovery
   */
  async triggerRecovery(): Promise<void> {
    await this.fallbackRecovery.manuallyTriggerRecovery();
  }

  /**
   * Forces sync queue processing
   */
  async forceSyncProcessing(): Promise<void> {
    await this.bufferedSync.forceProcessQueue();
  }

  /**
   * Gets detailed system metrics
   */
  getDetailedMetrics(): {
    health: any;
    fallback: any;
    sync: any;
    routing: any;
  } {
    return {
      health: this.datasourceHealth.getHealthStatistics(),
      fallback: this.fallbackRecovery.getFallbackStatistics(),
      sync: this.bufferedSync.getSyncMetrics(),
      routing: this.queryRouting.getQueryMetrics(),
    };
  }
}