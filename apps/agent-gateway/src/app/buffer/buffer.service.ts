import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DiskMonitoringService } from './disk-monitoring.service';
import { BackPressureService } from './back-pressure.service';

export interface BufferRecord {
  id: number;
  table_name: string;
  data: string; // JSON stringified data
  priority: number;
  created_at: number; // timestamp
  retry_count: number;
  last_error?: string;
}

export interface BufferStats {
  totalRecords: number;
  recordsByTable: Record<string, number>;
  oldestRecord: Date | null;
  newestRecord: Date | null;
  diskUsageBytes: number;
  diskUsagePercent: number;
  retentionDays: number;
}

@Injectable()
export class BufferService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BufferService.name);
  private db: sqlite3.Database;
  private readonly dbPath: string;
  private readonly retentionDays: number;
  private readonly maxRetries: number;

  constructor(
    private readonly config: ConfigService,
    private readonly diskMonitoring: DiskMonitoringService,
    private readonly backPressure: BackPressureService,
  ) {
    const bufferDir = this.config.get('BUFFER_DIR', './data/buffer');
    this.dbPath = path.join(bufferDir, 'gateway-buffer.db');
    this.retentionDays = parseInt(this.config.get('BUFFER_RETENTION_DAYS', '7'));
    this.maxRetries = parseInt(this.config.get('BUFFER_MAX_RETRIES', '3'));
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.diskMonitoring.initialize(path.dirname(this.dbPath));
      this.logger.log(`Buffer service initialized: ${this.dbPath}`);
    } catch (error) {
      this.logger.error(`Failed to initialize buffer service: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            this.logger.error(`Error closing database: ${err.message}`);
            reject(err);
          } else {
            this.logger.log('Database connection closed');
            resolve();
          }
        });
      });
    }
  }

  private async initializeDatabase(): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Create tables
        this.db.serialize(() => {
          this.db.run(`
            CREATE TABLE IF NOT EXISTS buffer_records (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              table_name TEXT NOT NULL,
              data TEXT NOT NULL,
              priority INTEGER DEFAULT 5,
              created_at INTEGER NOT NULL,
              retry_count INTEGER DEFAULT 0,
              last_error TEXT,
              INDEX idx_table_name (table_name),
              INDEX idx_created_at (created_at),
              INDEX idx_priority (priority)
            )
          `);

          this.db.run(`
            CREATE TABLE IF NOT EXISTS buffer_stats (
              id INTEGER PRIMARY KEY,
              total_records INTEGER DEFAULT 0,
              disk_usage_bytes INTEGER DEFAULT 0,
              last_cleanup_at INTEGER DEFAULT 0,
              created_at INTEGER DEFAULT (strftime('%s', 'now')),
              updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
          `);

          // Initialize stats record
          this.db.run(`
            INSERT OR IGNORE INTO buffer_stats (id, total_records, disk_usage_bytes, last_cleanup_at)
            VALUES (1, 0, 0, 0)
          `);

          resolve();
        });
      });
    });
  }

  async addToBuffer(tableName: string, records: any[], priority: number = 5): Promise<number> {
    // Check back-pressure before adding
    const backPressureStatus = await this.backPressure.checkBackPressure();
    if (backPressureStatus.shouldReject) {
      throw new Error(`Buffer capacity exceeded: ${backPressureStatus.reason}`);
    }

    if (backPressureStatus.shouldWarn) {
      this.logger.warn(`Buffer warning: ${backPressureStatus.reason}`);
    }

    const timestamp = Date.now();
    let addedCount = 0;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        const stmt = this.db.prepare(`
          INSERT INTO buffer_records (table_name, data, priority, created_at)
          VALUES (?, ?, ?, ?)
        `);

        for (const record of records) {
          try {
            const dataJson = JSON.stringify(record);
            stmt.run([tableName, dataJson, priority, timestamp], (err) => {
              if (err) {
                this.logger.error(`Failed to add record to buffer: ${err.message}`);
              } else {
                addedCount++;
              }
            });
          } catch (error) {
            this.logger.error(`Failed to serialize record: ${error.message}`);
          }
        }

        stmt.finalize((err) => {
          if (err) {
            reject(err);
          } else {
            // Update stats
            this.updateStats();
            resolve(addedCount);
          }
        });
      });
    });
  }

  async getBufferedRecords(tableName: string, limit: number = 100, priority?: number): Promise<BufferRecord[]> {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT id, table_name, data, priority, created_at, retry_count, last_error
        FROM buffer_records
        WHERE table_name = ?
      `;
      const params: any[] = [tableName];

      if (priority !== undefined) {
        query += ` AND priority = ?`;
        params.push(priority);
      }

      query += ` ORDER BY priority ASC, created_at ASC LIMIT ?`;
      params.push(limit);

      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const records: BufferRecord[] = rows.map(row => ({
            id: row.id,
            table_name: row.table_name,
            data: row.data,
            priority: row.priority,
            created_at: row.created_at,
            retry_count: row.retry_count,
            last_error: row.last_error,
          }));
          resolve(records);
        }
      });
    });
  }

  async removeFromBuffer(recordIds: number[]): Promise<number> {
    if (recordIds.length === 0) return 0;

    return new Promise((resolve, reject) => {
      const placeholders = recordIds.map(() => '?').join(',');
      const query = `DELETE FROM buffer_records WHERE id IN (${placeholders})`;

      this.db.run(query, recordIds, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async markRecordFailed(recordId: number, error: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE buffer_records 
        SET retry_count = retry_count + 1, last_error = ?
        WHERE id = ?
      `, [error, recordId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getFailedRecords(maxRetries?: number): Promise<BufferRecord[]> {
    const retryLimit = maxRetries || this.maxRetries;

    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT id, table_name, data, priority, created_at, retry_count, last_error
        FROM buffer_records
        WHERE retry_count >= ?
        ORDER BY created_at ASC
      `, [retryLimit], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const records: BufferRecord[] = rows.map(row => ({
            id: row.id,
            table_name: row.table_name,
            data: row.data,
            priority: row.priority,
            created_at: row.created_at,
            retry_count: row.retry_count,
            last_error: row.last_error,
          }));
          resolve(records);
        }
      });
    });
  }

  async getBufferStats(): Promise<BufferStats> {
    const [totalRecords, recordsByTable, dateRange, diskUsage] = await Promise.all([
      this.getTotalRecords(),
      this.getRecordsByTable(),
      this.getDateRange(),
      this.diskMonitoring.getDiskUsage(),
    ]);

    return {
      totalRecords,
      recordsByTable,
      oldestRecord: dateRange.oldest,
      newestRecord: dateRange.newest,
      diskUsageBytes: diskUsage.usedBytes,
      diskUsagePercent: diskUsage.usedPercent,
      retentionDays: this.retentionDays,
    };
  }

  private async getTotalRecords(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM buffer_records', (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }

  private async getRecordsByTable(): Promise<Record<string, number>> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT table_name, COUNT(*) as count
        FROM buffer_records
        GROUP BY table_name
      `, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const result: Record<string, number> = {};
          rows.forEach(row => {
            result[row.table_name] = row.count;
          });
          resolve(result);
        }
      });
    });
  }

  private async getDateRange(): Promise<{ oldest: Date | null; newest: Date | null }> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT MIN(created_at) as oldest, MAX(created_at) as newest
        FROM buffer_records
      `, (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            oldest: row.oldest ? new Date(row.oldest) : null,
            newest: row.newest ? new Date(row.newest) : null,
          });
        }
      });
    });
  }

  private async updateStats(): Promise<void> {
    const diskUsage = await this.diskMonitoring.getDiskUsage();
    
    this.db.run(`
      UPDATE buffer_stats 
      SET total_records = (SELECT COUNT(*) FROM buffer_records),
          disk_usage_bytes = ?,
          updated_at = strftime('%s', 'now')
      WHERE id = 1
    `, [diskUsage.usedBytes]);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async performMaintenance(): Promise<void> {
    try {
      this.logger.log('Starting buffer maintenance');

      // Clean up old records
      const cutoffTime = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
      const deletedCount = await this.cleanupOldRecords(cutoffTime);

      // Clean up failed records that exceeded max retries
      const failedCount = await this.cleanupFailedRecords();

      // Update stats
      await this.updateStats();

      // Vacuum database to reclaim space
      await this.vacuumDatabase();

      this.logger.log(`Buffer maintenance completed: ${deletedCount} old records, ${failedCount} failed records cleaned`);

    } catch (error) {
      this.logger.error(`Buffer maintenance failed: ${error.message}`);
    }
  }

  private async cleanupOldRecords(cutoffTime: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        DELETE FROM buffer_records 
        WHERE created_at < ?
      `, [cutoffTime], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  private async cleanupFailedRecords(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        DELETE FROM buffer_records 
        WHERE retry_count >= ?
      `, [this.maxRetries], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  private async vacuumDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('VACUUM', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async clearBuffer(tableName?: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let query = 'DELETE FROM buffer_records';
      const params: any[] = [];

      if (tableName) {
        query += ' WHERE table_name = ?';
        params.push(tableName);
      }

      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async getBufferHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: {
      totalRecords: number;
      diskUsagePercent: number;
      oldestRecordAge: number; // hours
      failedRecords: number;
    };
  }> {
    const stats = await this.getBufferStats();
    const failedRecords = await this.getFailedRecords();
    const backPressureStatus = await this.backPressure.checkBackPressure();

    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check disk usage
    if (stats.diskUsagePercent >= 95) {
      status = 'critical';
      issues.push(`Critical disk usage: ${stats.diskUsagePercent.toFixed(1)}%`);
    } else if (stats.diskUsagePercent >= 80) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`High disk usage: ${stats.diskUsagePercent.toFixed(1)}%`);
    }

    // Check record age
    const oldestRecordAge = stats.oldestRecord 
      ? (Date.now() - stats.oldestRecord.getTime()) / (1000 * 60 * 60)
      : 0;

    if (oldestRecordAge > 24) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`Old records detected: ${oldestRecordAge.toFixed(1)} hours`);
    }

    // Check failed records
    if (failedRecords.length > 100) {
      status = 'critical';
      issues.push(`High failed record count: ${failedRecords.length}`);
    } else if (failedRecords.length > 10) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`Failed records detected: ${failedRecords.length}`);
    }

    // Check back-pressure
    if (backPressureStatus.shouldReject) {
      status = 'critical';
      issues.push(`Back-pressure active: ${backPressureStatus.reason}`);
    } else if (backPressureStatus.shouldWarn) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`Back-pressure warning: ${backPressureStatus.reason}`);
    }

    return {
      status,
      issues,
      metrics: {
        totalRecords: stats.totalRecords,
        diskUsagePercent: stats.diskUsagePercent,
        oldestRecordAge,
        failedRecords: failedRecords.length,
      },
    };
  }
}