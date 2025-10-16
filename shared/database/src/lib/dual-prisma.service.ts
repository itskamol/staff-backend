import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { Client as TimescaleClient } from 'pg';

export interface ConnectionHealth {
  postgresql: {
    connected: boolean;
    latency?: number;
    error?: string;
  };
  timescale: {
    connected: boolean;
    latency?: number;
    error?: string;
  };
}

export interface QueryRoutingConfig {
  useTimescale: boolean;
  fallbackToPostgres: boolean;
  healthCheckInterval: number;
  maxRetries: number;
}

@Injectable()
export class DualPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DualPrismaService.name);

  // Primary PostgreSQL client for transactional data
  private postgresClient: PrismaClient;

  // TimescaleDB client for time-series data
  private timescaleClient: TimescaleClient;

  // Connection health tracking
  private connectionHealth: ConnectionHealth = {
    postgresql: { connected: false },
    timescale: { connected: false },
  };

  // Query routing configuration
  private routingConfig: QueryRoutingConfig;

  // Health check interval
  private healthCheckTimer: NodeJS.Timeout;

  // Failure counters for circuit breaker pattern
  private postgresFailures = 0;
  private timescaleFailures = 0;
  private readonly maxFailures = 3;

  constructor(private readonly config: ConfigService) {
    this.routingConfig = {
      useTimescale: this.config.get('TIMESCALE_ENABLED', 'true') === 'true',
      fallbackToPostgres: this.config.get('TIMESCALE_FALLBACK_ENABLED', 'true') === 'true',
      healthCheckInterval: parseInt(this.config.get('DB_HEALTH_CHECK_INTERVAL', '60000')),
      maxRetries: parseInt(this.config.get('DB_MAX_RETRIES', '3')),
    };

    this.initializeClients();
  }

  private initializeClients(): void {
    // Initialize PostgreSQL client
    this.postgresClient = new PrismaClient({
      datasources: {
        db: {
          url: this.config.get('DATABASE_URL'),
        },
      },
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    // Initialize TimescaleDB client
    this.timescaleClient = new TimescaleClient({
      connectionString: this.config.get('TIMESCALE_URL'),
      ssl: this.config.get('TIMESCALE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      max: parseInt(this.config.get('TIMESCALE_POOL_SIZE', '10')),
      idleTimeoutMillis: parseInt(this.config.get('TIMESCALE_IDLE_TIMEOUT', '30000')),
      connectionTimeoutMillis: parseInt(this.config.get('TIMESCALE_CONNECTION_TIMEOUT', '5000')),
    });

    // Set up logging for PostgreSQL
    this.postgresClient.$on('query', (e) => {
      this.logger.debug(`PostgreSQL Query: ${e.query} - Duration: ${e.duration}ms`);
    });

    this.postgresClient.$on('error', (e) => {
      this.logger.error(`PostgreSQL Error: ${e.message}`);
      this.handlePostgresError();
    });

    // Set up error handling for TimescaleDB
    this.timescaleClient.on('error', (err) => {
      this.logger.error(`TimescaleDB Error: ${err.message}`);
      this.handleTimescaleError();
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      // Connect to PostgreSQL
      await this.connectPostgreSQL();

      // Connect to TimescaleDB if enabled
      if (this.routingConfig.useTimescale) {
        await this.connectTimescaleDB();
      }

      // Start health monitoring
      this.startHealthMonitoring();

      this.logger.log('Dual Prisma service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize dual Prisma service: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      // Stop health monitoring
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }

      // Disconnect from databases
      await this.postgresClient.$disconnect();
      await this.timescaleClient.end();

      this.logger.log('Dual Prisma service destroyed');
    } catch (error) {
      this.logger.error(`Error during service destruction: ${error.message}`);
    }
  }

  private async connectPostgreSQL(): Promise<void> {
    try {
      const startTime = Date.now();
      await this.postgresClient.$connect();
      const latency = Date.now() - startTime;

      this.connectionHealth.postgresql = {
        connected: true,
        latency,
      };

      this.postgresFailures = 0;
      this.logger.log(`Connected to PostgreSQL (latency: ${latency}ms)`);
    } catch (error) {
      this.connectionHealth.postgresql = {
        connected: false,
        error: error.message,
      };

      this.handlePostgresError();
      throw error;
    }
  }

  private async connectTimescaleDB(): Promise<void> {
    try {
      const startTime = Date.now();
      await this.timescaleClient.connect();
      const latency = Date.now() - startTime;

      this.connectionHealth.timescale = {
        connected: true,
        latency,
      };

      this.timescaleFailures = 0;
      this.logger.log(`Connected to TimescaleDB (latency: ${latency}ms)`);
    } catch (error) {
      this.connectionHealth.timescale = {
        connected: false,
        error: error.message,
      };

      this.handleTimescaleError();

      if (!this.routingConfig.fallbackToPostgres) {
        throw error;
      }

      this.logger.warn(`TimescaleDB connection failed, fallback enabled: ${error.message}`);
    }
  }

  private handlePostgresError(): void {
    this.postgresFailures++;
    this.connectionHealth.postgresql.connected = false;

    if (this.postgresFailures >= this.maxFailures) {
      this.logger.error(`PostgreSQL circuit breaker activated after ${this.postgresFailures} failures`);
    }
  }

  private handleTimescaleError(): void {
    this.timescaleFailures++;
    this.connectionHealth.timescale.connected = false;

    if (this.timescaleFailures >= this.maxFailures) {
      this.logger.error(`TimescaleDB circuit breaker activated after ${this.timescaleFailures} failures`);
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.routingConfig.healthCheckInterval);

    this.logger.log(`Health monitoring started (interval: ${this.routingConfig.healthCheckInterval}ms)`);
  }

  private async performHealthCheck(): Promise<void> {
    // Check PostgreSQL health
    try {
      const startTime = Date.now();
      await this.postgresClient.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;

      if (!this.connectionHealth.postgresql.connected) {
        this.logger.log('PostgreSQL connection recovered');
        this.postgresFailures = 0;
      }

      this.connectionHealth.postgresql = {
        connected: true,
        latency,
      };
    } catch (error) {
      this.connectionHealth.postgresql = {
        connected: false,
        error: error.message,
      };
      this.handlePostgresError();
    }

    // Check TimescaleDB health if enabled
    if (this.routingConfig.useTimescale) {
      try {
        const startTime = Date.now();
        await this.timescaleClient.query('SELECT 1');
        const latency = Date.now() - startTime;

        if (!this.connectionHealth.timescale.connected) {
          this.logger.log('TimescaleDB connection recovered');
          this.timescaleFailures = 0;
        }

        this.connectionHealth.timescale = {
          connected: true,
          latency,
        };
      } catch (error) {
        this.connectionHealth.timescale = {
          connected: false,
          error: error.message,
        };
        this.handleTimescaleError();
      }
    }
  }

  // Query routing methods
  shouldUseTimescale(operation: string): boolean {
    // Don't use TimescaleDB if it's disabled
    if (!this.routingConfig.useTimescale) {
      return false;
    }

    // Don't use TimescaleDB if circuit breaker is active
    if (this.timescaleFailures >= this.maxFailures) {
      return false;
    }

    // Don't use TimescaleDB if not connected and fallback is disabled
    if (!this.connectionHealth.timescale.connected && !this.routingConfig.fallbackToPostgres) {
      return false;
    }

    // Route time-series operations to TimescaleDB
    const timescaleOperations = [
      'activeWindow',
      'visitedSite',
      'screenshot',
      'userSession',
      'monitoring',
    ];

    return timescaleOperations.some(op => operation.toLowerCase().includes(op.toLowerCase()));
  }

  // PostgreSQL client access (for transactional data)
  get postgres(): PrismaClient {
    if (this.postgresFailures >= this.maxFailures) {
      throw new Error('PostgreSQL circuit breaker is active');
    }

    if (!this.connectionHealth.postgresql.connected) {
      throw new Error('PostgreSQL is not connected');
    }

    return this.postgresClient;
  }

  // TimescaleDB client access (for time-series data)
  get timescale(): TimescaleClient {
    if (this.timescaleFailures >= this.maxFailures) {
      if (this.routingConfig.fallbackToPostgres) {
        this.logger.warn('TimescaleDB circuit breaker active, falling back to PostgreSQL');
        return null; // Caller should handle fallback
      }
      throw new Error('TimescaleDB circuit breaker is active');
    }

    if (!this.connectionHealth.timescale.connected) {
      if (this.routingConfig.fallbackToPostgres) {
        this.logger.warn('TimescaleDB not connected, falling back to PostgreSQL');
        return null; // Caller should handle fallback
      }
      throw new Error('TimescaleDB is not connected');
    }

    return this.timescaleClient;
  }

  // Monitoring data operations with automatic routing
  async insertActiveWindow(data: any): Promise<any> {
    const operation = 'activeWindow.create';

    if (this.shouldUseTimescale(operation)) {
      try {
        const query = `
          INSERT INTO monitoring.active_windows (
            id, agent_id, computer_uid, user_sid, window_title, 
            process_name, url, datetime, duration_seconds, organization_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *;
        `;

        const values = [
          data.id,
          data.agentId,
          data.computerUid,
          data.userSid,
          data.windowTitle,
          data.processName,
          data.url,
          data.datetime,
          data.durationSeconds,
          data.organizationId,
        ];

        const result = await this.timescaleClient.query(query, values);
        return result.rows[0];
      } catch (error) {
        this.logger.error(`TimescaleDB insert failed: ${error.message}`);

        if (this.routingConfig.fallbackToPostgres) {
          this.logger.warn('Falling back to PostgreSQL for active window insert');
          // Fallback to PostgreSQL partition table
          return await this.insertActiveWindowFallback(data);
        }

        throw error;
      }
    } else {
      return await this.insertActiveWindowFallback(data);
    }
  }

  private async insertActiveWindowFallback(data: any): Promise<any> {
    // Insert into PostgreSQL partition table as fallback
    const query = `
      INSERT INTO active_windows_fallback (
        id, agent_id, computer_uid, user_sid, window_title, 
        process_name, url, datetime, duration_seconds, organization_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;

    const values = [
      data.id,
      data.agentId,
      data.computerUid,
      data.userSid,
      data.windowTitle,
      data.processName,
      data.url,
      data.datetime,
      data.durationSeconds,
      data.organizationId,
    ];

    const result = await this.postgresClient.$queryRawUnsafe(query, ...values);
    return result;
  }

  async queryActiveWindows(filters: any): Promise<any[]> {
    const operation = 'activeWindow.findMany';

    if (this.shouldUseTimescale(operation)) {
      try {
        let query = `
          SELECT * FROM monitoring.active_windows 
          WHERE organization_id = $1
        `;
        const params = [filters.organizationId];
        let paramIndex = 2;

        if (filters.agentId) {
          query += ` AND agent_id = $${paramIndex}`;
          params.push(filters.agentId);
          paramIndex++;
        }

        if (filters.startDate) {
          query += ` AND datetime >= $${paramIndex}`;
          params.push(filters.startDate);
          paramIndex++;
        }

        if (filters.endDate) {
          query += ` AND datetime <= $${paramIndex}`;
          params.push(filters.endDate);
          paramIndex++;
        }

        query += ` ORDER BY datetime DESC`;

        if (filters.limit) {
          query += ` LIMIT $${paramIndex}`;
          params.push(filters.limit);
        }

        const result = await this.timescaleClient.query(query, params);
        return result.rows;
      } catch (error) {
        this.logger.error(`TimescaleDB query failed: ${error.message}`);

        if (this.routingConfig.fallbackToPostgres) {
          this.logger.warn('Falling back to PostgreSQL for active window query');
          return await this.queryActiveWindowsFallback(filters);
        }

        throw error;
      }
    } else {
      return await this.queryActiveWindowsFallback(filters);
    }
  }

  private async queryActiveWindowsFallback(filters: any): Promise<any[]> {
    // Query PostgreSQL partition table as fallback
    let query = `
      SELECT * FROM active_windows_fallback 
      WHERE organization_id = $1
    `;
    const params = [filters.organizationId];
    let paramIndex = 2;

    if (filters.agentId) {
      query += ` AND agent_id = $${paramIndex}`;
      params.push(filters.agentId);
      paramIndex++;
    }

    if (filters.startDate) {
      query += ` AND datetime >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND datetime <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    query += ` ORDER BY datetime DESC`;

    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
    }

    const result = await this.postgresClient.$queryRawUnsafe(query, ...params);
    return result as any[];
  }

  // Batch insert for high-throughput scenarios
  async batchInsertMonitoringData(tableName: string, records: any[]): Promise<number> {
    const operation = `${tableName}.batchInsert`;

    if (this.shouldUseTimescale(operation)) {
      try {
        return await this.batchInsertTimescale(tableName, records);
      } catch (error) {
        this.logger.error(`TimescaleDB batch insert failed: ${error.message}`);

        if (this.routingConfig.fallbackToPostgres) {
          this.logger.warn(`Falling back to PostgreSQL for ${tableName} batch insert`);
          return await this.batchInsertPostgres(`${tableName}_fallback`, records);
        }

        throw error;
      }
    } else {
      return await this.batchInsertPostgres(`${tableName}_fallback`, records);
    }
  }

  private async batchInsertTimescale(tableName: string, records: any[]): Promise<number> {
    if (records.length === 0) return 0;

    const columns = Object.keys(records[0]);
    const placeholders = records.map((_, index) => {
      const start = index * columns.length + 1;
      const end = start + columns.length - 1;
      return `(${Array.from({ length: columns.length }, (_, i) => `$${start + i}`).join(', ')})`;
    }).join(', ');

    const query = `
      INSERT INTO monitoring.${tableName} (${columns.join(', ')})
      VALUES ${placeholders}
    `;

    const values = records.flatMap(record => columns.map(col => record[col]));

    const result = await this.timescaleClient.query(query, values);
    return result.rowCount;
  }

  private async batchInsertPostgres(tableName: string, records: any[]): Promise<number> {
    if (records.length === 0) return 0;

    const columns = Object.keys(records[0]);
    const placeholders = records.map((_, index) => {
      const start = index * columns.length + 1;
      const end = start + columns.length - 1;
      return `(${Array.from({ length: columns.length }, (_, i) => `$${start + i}`).join(', ')})`;
    }).join(', ');

    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${placeholders}
    `;

    const values = records.flatMap(record => columns.map(col => record[col]));

    const result = await this.postgresClient.$executeRawUnsafe(query, ...values);
    return result;
  }

  // Health and status methods
  getConnectionHealth(): ConnectionHealth {
    return { ...this.connectionHealth };
  }

  getRoutingConfig(): QueryRoutingConfig {
    return { ...this.routingConfig };
  }

  async getConnectionStats(): Promise<{
    postgresql: { activeConnections: number; totalConnections: number };
    timescale: { activeConnections: number; totalConnections: number };
  }> {
    const stats = {
      postgresql: { activeConnections: 0, totalConnections: 0 },
      timescale: { activeConnections: 0, totalConnections: 0 },
    };

    try {
      // Get PostgreSQL connection stats
      const pgStats = await this.postgresClient.$queryRaw<Array<{ count: number }>>`
        SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()
      `;
      stats.postgresql.activeConnections = Number(pgStats[0].count);

      // Get TimescaleDB connection stats
      if (this.connectionHealth.timescale.connected) {
        const tsStats = await this.timescaleClient.query(
          'SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()'
        );
        stats.timescale.activeConnections = parseInt(tsStats.rows[0].count);
      }
    } catch (error) {
      this.logger.error(`Failed to get connection stats: ${error.message}`);
    }

    return stats;
  }

  // Force reconnection methods
  async reconnectPostgreSQL(): Promise<void> {
    try {
      await this.postgresClient.$disconnect();
      await this.connectPostgreSQL();
      this.logger.log('PostgreSQL reconnection successful');
    } catch (error) {
      this.logger.error(`PostgreSQL reconnection failed: ${error.message}`);
      throw error;
    }
  }

  async reconnectTimescaleDB(): Promise<void> {
    try {
      await this.timescaleClient.end();
      this.timescaleClient = new TimescaleClient({
        connectionString: this.config.get('TIMESCALE_URL'),
        ssl: this.config.get('TIMESCALE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      });
      await this.connectTimescaleDB();
      this.logger.log('TimescaleDB reconnection successful');
    } catch (error) {
      this.logger.error(`TimescaleDB reconnection failed: ${error.message}`);
      throw error;
    }
  }

  // Configuration update methods
  updateRoutingConfig(config: Partial<QueryRoutingConfig>): void {
    this.routingConfig = { ...this.routingConfig, ...config };
    this.logger.log('Query routing configuration updated', this.routingConfig);
  }

  // Circuit breaker reset
  resetCircuitBreakers(): void {
    this.postgresFailures = 0;
    this.timescaleFailures = 0;
    this.logger.log('Circuit breakers reset');
  }
}