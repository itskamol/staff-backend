import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';

export interface HypertableConfig {
  tableName: string;
  timeColumn: string;
  chunkTimeInterval: string;
  compressionEnabled?: boolean;
  compressionAfter?: string;
  retentionPeriod?: string;
}

export interface TimescaleStats {
  tableName: string;
  totalChunks: number;
  compressedChunks: number;
  uncompressedChunks: number;
  totalSize: string;
  compressedSize: string;
  compressionRatio: number;
  oldestData: Date;
  newestData: Date;
}

@Injectable()
export class TimescaleService implements OnModuleInit {
  private readonly logger = new Logger(TimescaleService.name);
  private client: Client;

  constructor(private readonly config: ConfigService) {
    this.client = new Client({
      connectionString: this.config.get('TIMESCALE_URL'),
      ssl: this.config.get('TIMESCALE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      await this.ensureTimescaleExtension();
      this.logger.log('TimescaleDB connection established');
    } catch (error) {
      this.logger.error(`Failed to connect to TimescaleDB: ${error.message}`);
      throw error;
    }
  }

  private async ensureTimescaleExtension(): Promise<void> {
    try {
      await this.client.query('CREATE EXTENSION IF NOT EXISTS timescaledb;');
      this.logger.log('TimescaleDB extension ensured');
    } catch (error) {
      this.logger.error(`Failed to create TimescaleDB extension: ${error.message}`);
      throw error;
    }
  }

  async createMonitoringSchema(): Promise<void> {
    try {
      await this.client.query('CREATE SCHEMA IF NOT EXISTS monitoring;');
      this.logger.log('Monitoring schema created');
    } catch (error) {
      this.logger.error(`Failed to create monitoring schema: ${error.message}`);
      throw error;
    }
  }

  async createHypertable(config: HypertableConfig): Promise<void> {
    try {
      // Check if table is already a hypertable
      const isHypertable = await this.isHypertable(config.tableName);
      if (isHypertable) {
        this.logger.log(`Table ${config.tableName} is already a hypertable`);
        return;
      }

      // Create hypertable
      const query = `
        SELECT create_hypertable(
          '${config.tableName}',
          '${config.timeColumn}',
          chunk_time_interval => INTERVAL '${config.chunkTimeInterval}'
        );
      `;

      await this.client.query(query);
      this.logger.log(`Created hypertable: ${config.tableName}`);

      // Enable compression if requested
      if (config.compressionEnabled) {
        await this.enableCompression(config.tableName, config.compressionAfter);
      }

      // Set retention policy if specified
      if (config.retentionPeriod) {
        await this.setRetentionPolicy(config.tableName, config.retentionPeriod);
      }
    } catch (error) {
      this.logger.error(`Failed to create hypertable ${config.tableName}: ${error.message}`);
      throw error;
    }
  }

  private async isHypertable(tableName: string): Promise<boolean> {
    try {
      const result = await this.client.query(`
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = $1
      `, [tableName.split('.').pop()]); // Remove schema prefix if present

      return result.rows.length > 0;
    } catch (error) {
      this.logger.error(`Failed to check if ${tableName} is hypertable: ${error.message}`);
      return false;
    }
  }

  async enableCompression(tableName: string, compressAfter: string = '7 days'): Promise<void> {
    try {
      // Enable compression
      await this.client.query(`
        ALTER TABLE ${tableName} SET (
          timescaledb.compress,
          timescaledb.compress_segmentby = 'organization_id'
        );
      `);

      // Add compression policy
      await this.client.query(`
        SELECT add_compression_policy('${tableName}', INTERVAL '${compressAfter}');
      `);

      this.logger.log(`Enabled compression for ${tableName} after ${compressAfter}`);
    } catch (error) {
      this.logger.error(`Failed to enable compression for ${tableName}: ${error.message}`);
      throw error;
    }
  }

  async setRetentionPolicy(tableName: string, retentionPeriod: string): Promise<void> {
    try {
      await this.client.query(`
        SELECT add_retention_policy('${tableName}', INTERVAL '${retentionPeriod}');
      `);

      this.logger.log(`Set retention policy for ${tableName}: ${retentionPeriod}`);
    } catch (error) {
      this.logger.error(`Failed to set retention policy for ${tableName}: ${error.message}`);
      throw error;
    }
  }

  async createActiveWindowsTable(): Promise<void> {
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS monitoring.active_windows (
          id UUID DEFAULT gen_random_uuid(),
          agent_id UUID NOT NULL,
          computer_uid VARCHAR(255) NOT NULL,
          user_sid VARCHAR(255) NOT NULL,
          window_title VARCHAR(500),
          process_name VARCHAR(255),
          url VARCHAR(1000),
          datetime TIMESTAMPTZ NOT NULL,
          duration_seconds INTEGER,
          organization_id INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (id, datetime)
        );
      `;

      await this.client.query(createTableQuery);

      // Create hypertable
      await this.createHypertable({
        tableName: 'monitoring.active_windows',
        timeColumn: 'datetime',
        chunkTimeInterval: '1 day',
        compressionEnabled: true,
        compressionAfter: '7 days',
        retentionPeriod: '90 days',
      });

      // Create indexes
      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_active_windows_agent_id_datetime 
        ON monitoring.active_windows (agent_id, datetime DESC);
      `);

      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_active_windows_organization_id_datetime 
        ON monitoring.active_windows (organization_id, datetime DESC);
      `);

      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_active_windows_process_name 
        ON monitoring.active_windows (process_name, datetime DESC);
      `);

      this.logger.log('Active windows table created successfully');
    } catch (error) {
      this.logger.error(`Failed to create active windows table: ${error.message}`);
      throw error;
    }
  }

  async createVisitedSitesTable(): Promise<void> {
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS monitoring.visited_sites (
          id UUID DEFAULT gen_random_uuid(),
          agent_id UUID NOT NULL,
          computer_uid VARCHAR(255) NOT NULL,
          user_sid VARCHAR(255) NOT NULL,
          url VARCHAR(1000) NOT NULL,
          title VARCHAR(500),
          datetime TIMESTAMPTZ NOT NULL,
          duration_seconds INTEGER,
          organization_id INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (id, datetime)
        );
      `;

      await this.client.query(createTableQuery);

      // Create hypertable
      await this.createHypertable({
        tableName: 'monitoring.visited_sites',
        timeColumn: 'datetime',
        chunkTimeInterval: '1 day',
        compressionEnabled: true,
        compressionAfter: '7 days',
        retentionPeriod: '90 days',
      });

      // Create indexes
      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_visited_sites_agent_id_datetime 
        ON monitoring.visited_sites (agent_id, datetime DESC);
      `);

      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_visited_sites_organization_id_datetime 
        ON monitoring.visited_sites (organization_id, datetime DESC);
      `);

      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_visited_sites_url_hash 
        ON monitoring.visited_sites (md5(url), datetime DESC);
      `);

      this.logger.log('Visited sites table created successfully');
    } catch (error) {
      this.logger.error(`Failed to create visited sites table: ${error.message}`);
      throw error;
    }
  }

  async createScreenshotsTable(): Promise<void> {
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS monitoring.screenshots (
          id UUID DEFAULT gen_random_uuid(),
          agent_id UUID NOT NULL,
          computer_uid VARCHAR(255) NOT NULL,
          user_sid VARCHAR(255) NOT NULL,
          file_path VARCHAR(1000) NOT NULL,
          file_size BIGINT,
          datetime TIMESTAMPTZ NOT NULL,
          organization_id INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (id, datetime)
        );
      `;

      await this.client.query(createTableQuery);

      // Create hypertable
      await this.createHypertable({
        tableName: 'monitoring.screenshots',
        timeColumn: 'datetime',
        chunkTimeInterval: '1 day',
        compressionEnabled: true,
        compressionAfter: '3 days', // Shorter compression for screenshots
        retentionPeriod: '30 days', // Shorter retention for screenshots
      });

      // Create indexes
      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_screenshots_agent_id_datetime 
        ON monitoring.screenshots (agent_id, datetime DESC);
      `);

      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_screenshots_organization_id_datetime 
        ON monitoring.screenshots (organization_id, datetime DESC);
      `);

      this.logger.log('Screenshots table created successfully');
    } catch (error) {
      this.logger.error(`Failed to create screenshots table: ${error.message}`);
      throw error;
    }
  }

  async createUserSessionsTable(): Promise<void> {
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS monitoring.user_sessions (
          id UUID DEFAULT gen_random_uuid(),
          agent_id UUID NOT NULL,
          computer_uid VARCHAR(255) NOT NULL,
          user_sid VARCHAR(255) NOT NULL,
          session_type VARCHAR(50) NOT NULL CHECK (session_type IN ('login', 'logout', 'lock', 'unlock', 'idle', 'active')),
          datetime TIMESTAMPTZ NOT NULL,
          organization_id INTEGER NOT NULL,
          metadata JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (id, datetime)
        );
      `;

      await this.client.query(createTableQuery);

      // Create hypertable
      await this.createHypertable({
        tableName: 'monitoring.user_sessions',
        timeColumn: 'datetime',
        chunkTimeInterval: '1 day',
        compressionEnabled: true,
        compressionAfter: '30 days',
        retentionPeriod: '365 days', // Longer retention for session data
      });

      // Create indexes
      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_agent_id_datetime 
        ON monitoring.user_sessions (agent_id, datetime DESC);
      `);

      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_organization_id_datetime 
        ON monitoring.user_sessions (organization_id, datetime DESC);
      `);

      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_session_type 
        ON monitoring.user_sessions (session_type, datetime DESC);
      `);

      this.logger.log('User sessions table created successfully');
    } catch (error) {
      this.logger.error(`Failed to create user sessions table: ${error.message}`);
      throw error;
    }
  }

  async initializeAllTables(): Promise<void> {
    this.logger.log('Initializing all TimescaleDB tables');

    try {
      await this.createMonitoringSchema();
      await this.createActiveWindowsTable();
      await this.createVisitedSitesTable();
      await this.createScreenshotsTable();
      await this.createUserSessionsTable();

      this.logger.log('All TimescaleDB tables initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize TimescaleDB tables: ${error.message}`);
      throw error;
    }
  }

  async getHypertableStats(tableName: string): Promise<TimescaleStats> {
    try {
      // Get chunk information
      const chunkQuery = `
        SELECT 
          COUNT(*) as total_chunks,
          COUNT(*) FILTER (WHERE is_compressed) as compressed_chunks,
          COUNT(*) FILTER (WHERE NOT is_compressed) as uncompressed_chunks
        FROM timescaledb_information.chunks 
        WHERE hypertable_name = $1;
      `;

      const chunkResult = await this.client.query(chunkQuery, [tableName.split('.').pop()]);
      const chunkStats = chunkResult.rows[0];

      // Get size information
      const sizeQuery = `
        SELECT 
          pg_size_pretty(hypertable_size($1)) as total_size,
          pg_size_pretty(
            COALESCE(
              (SELECT SUM(compressed_heap_size + compressed_toast_size) 
               FROM timescaledb_information.compressed_chunk_stats 
               WHERE hypertable_name = $2), 
              0
            )
          ) as compressed_size
        FROM timescaledb_information.hypertables 
        WHERE hypertable_name = $2;
      `;

      const sizeResult = await this.client.query(sizeQuery, [tableName, tableName.split('.').pop()]);
      const sizeStats = sizeResult.rows[0];

      // Get data range
      const rangeQuery = `
        SELECT 
          MIN(datetime) as oldest_data,
          MAX(datetime) as newest_data
        FROM ${tableName};
      `;

      const rangeResult = await this.client.query(rangeQuery);
      const rangeStats = rangeResult.rows[0];

      // Calculate compression ratio
      const compressionRatio = chunkStats.compressed_chunks > 0 
        ? (chunkStats.compressed_chunks / chunkStats.total_chunks) * 100 
        : 0;

      return {
        tableName,
        totalChunks: parseInt(chunkStats.total_chunks),
        compressedChunks: parseInt(chunkStats.compressed_chunks),
        uncompressedChunks: parseInt(chunkStats.uncompressed_chunks),
        totalSize: sizeStats.total_size,
        compressedSize: sizeStats.compressed_size,
        compressionRatio: Math.round(compressionRatio * 100) / 100,
        oldestData: rangeStats.oldest_data,
        newestData: rangeStats.newest_data,
      };
    } catch (error) {
      this.logger.error(`Failed to get stats for ${tableName}: ${error.message}`);
      throw error;
    }
  }

  async getAllHypertableStats(): Promise<TimescaleStats[]> {
    try {
      const tablesQuery = `
        SELECT schemaname || '.' || hypertable_name as full_name
        FROM timescaledb_information.hypertables
        WHERE schemaname = 'monitoring';
      `;

      const result = await this.client.query(tablesQuery);
      const stats: TimescaleStats[] = [];

      for (const row of result.rows) {
        try {
          const tableStats = await this.getHypertableStats(row.full_name);
          stats.push(tableStats);
        } catch (error) {
          this.logger.warn(`Failed to get stats for ${row.full_name}: ${error.message}`);
        }
      }

      return stats;
    } catch (error) {
      this.logger.error(`Failed to get all hypertable stats: ${error.message}`);
      throw error;
    }
  }

  async compressChunks(tableName: string, olderThan: string = '7 days'): Promise<number> {
    try {
      const query = `
        SELECT compress_chunk(chunk_name)
        FROM timescaledb_information.chunks
        WHERE hypertable_name = $1
          AND NOT is_compressed
          AND range_end < NOW() - INTERVAL '${olderThan}';
      `;

      const result = await this.client.query(query, [tableName.split('.').pop()]);
      const compressedCount = result.rows.length;

      this.logger.log(`Compressed ${compressedCount} chunks for ${tableName}`);
      return compressedCount;
    } catch (error) {
      this.logger.error(`Failed to compress chunks for ${tableName}: ${error.message}`);
      throw error;
    }
  }

  async decompressChunks(tableName: string, newerThan: string = '1 day'): Promise<number> {
    try {
      const query = `
        SELECT decompress_chunk(chunk_name)
        FROM timescaledb_information.chunks
        WHERE hypertable_name = $1
          AND is_compressed
          AND range_start > NOW() - INTERVAL '${newerThan}';
      `;

      const result = await this.client.query(query, [tableName.split('.').pop()]);
      const decompressedCount = result.rows.length;

      this.logger.log(`Decompressed ${decompressedCount} chunks for ${tableName}`);
      return decompressedCount;
    } catch (error) {
      this.logger.error(`Failed to decompress chunks for ${tableName}: ${error.message}`);
      throw error;
    }
  }

  async dropChunks(tableName: string, olderThan: string): Promise<number> {
    try {
      const query = `
        SELECT drop_chunks('${tableName}', INTERVAL '${olderThan}');
      `;

      const result = await this.client.query(query);
      const droppedCount = result.rows.length;

      this.logger.log(`Dropped chunks older than ${olderThan} for ${tableName}`);
      return droppedCount;
    } catch (error) {
      this.logger.error(`Failed to drop chunks for ${tableName}: ${error.message}`);
      throw error;
    }
  }

  async healthCheck(): Promise<{
    connected: boolean;
    version: string;
    extensionVersion: string;
    error?: string;
  }> {
    try {
      // Test connection
      await this.client.query('SELECT 1');

      // Get PostgreSQL version
      const pgVersionResult = await this.client.query('SELECT version()');
      const pgVersion = pgVersionResult.rows[0].version;

      // Get TimescaleDB version
      const tsVersionResult = await this.client.query(`
        SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
      `);
      const tsVersion = tsVersionResult.rows[0]?.extversion || 'Not installed';

      return {
        connected: true,
        version: pgVersion,
        extensionVersion: tsVersion,
      };
    } catch (error) {
      return {
        connected: false,
        version: '',
        extensionVersion: '',
        error: error.message,
      };
    }
  }

  async executeQuery(query: string, params?: any[]): Promise<any> {
    try {
      const result = await this.client.query(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error(`Query execution failed: ${error.message}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.end();
      this.logger.log('TimescaleDB connection closed');
    } catch (error) {
      this.logger.error(`Failed to close TimescaleDB connection: ${error.message}`);
    }
  }
}