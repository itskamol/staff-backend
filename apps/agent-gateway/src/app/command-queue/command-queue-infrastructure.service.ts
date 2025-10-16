import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';

export interface QueuedCommand {
  id: string;
  type: string;
  targetAgentId?: string;
  targetOrganizationId?: number;
  payload: any;
  priority: number; // 1 = highest, 5 = lowest
  status: CommandStatus;
  createdAt: Date;
  scheduledAt?: Date;
  expiresAt: Date;
  executedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  result?: any;
  metadata: Record<string, any>;
}

export enum CommandStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export interface QueueStats {
  totalCommands: number;
  pendingCommands: number;
  scheduledCommands: number;
  executingCommands: number;
  completedCommands: number;
  failedCommands: number;
  expiredCommands: number;
  cancelledCommands: number;
  averageExecutionTime: number;
  successRate: number;
  queuesByPriority: { priority: number; count: number }[];
}

@Injectable()
export class CommandQueueInfrastructureService implements OnModuleInit {
  private readonly logger = new Logger(CommandQueueInfrastructureService.name);
  private db: Database;
  private readonly dbPath: string;
  private readonly maxQueueSize: number;
  private readonly defaultExpiration: number; // milliseconds

  constructor(private readonly config: ConfigService) {
    this.dbPath = this.config.get('COMMAND_QUEUE_DB_PATH', './data/command_queue.db');
    this.maxQueueSize = parseInt(this.config.get('COMMAND_QUEUE_MAX_SIZE', '10000'));
    this.defaultExpiration = parseInt(this.config.get('COMMAND_DEFAULT_EXPIRATION', '3600000')); // 1 hour
  }

  async onModuleInit(): Promise<void> {
    await this.initializeDatabase();
    this.logger.log('Command Queue Infrastructure initialized');
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          this.logger.error(`Failed to open command queue database: ${err.message}`);
          reject(err);
          return;
        }

        this.createTables()
          .then(() => {
            this.logger.log('Command queue database initialized');
            resolve();
          })
          .catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    const createCommandsTable = `
      CREATE TABLE IF NOT EXISTS commands (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        target_agent_id TEXT,
        target_organization_id INTEGER,
        payload TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 3,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL,
        scheduled_at DATETIME,
        expires_at DATETIME NOT NULL,
        executed_at DATETIME,
        completed_at DATETIME,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        last_error TEXT,
        result TEXT,
        metadata TEXT,
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_scheduled_at (scheduled_at),
        INDEX idx_expires_at (expires_at),
        INDEX idx_target_agent_id (target_agent_id),
        INDEX idx_target_organization_id (target_organization_id)
      )
    `;

    const createQueueStatsTable = `
      CREATE TABLE IF NOT EXISTS queue_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME NOT NULL,
        total_commands INTEGER NOT NULL,
        pending_commands INTEGER NOT NULL,
        executing_commands INTEGER NOT NULL,
        completed_commands INTEGER NOT NULL,
        failed_commands INTEGER NOT NULL,
        average_execution_time REAL NOT NULL,
        success_rate REAL NOT NULL
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(createCommandsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        this.db.run(createQueueStatsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }

  async queueCommand(commandData: {
    type: string;
    targetAgentId?: string;
    targetOrganizationId?: number;
    payload: any;
    priority?: number;
    scheduledAt?: Date;
    expiresAt?: Date;
    maxRetries?: number;
    metadata?: Record<string, any>;
  }): Promise<string> {
    // Check queue capacity
    const currentSize = await this.getQueueSize();
    if (currentSize >= this.maxQueueSize) {
      throw new Error(`Queue is at capacity (${this.maxQueueSize} commands)`);
    }

    const commandId = this.generateCommandId();
    const now = new Date();
    
    const command: QueuedCommand = {
      id: commandId,
      type: commandData.type,
      targetAgentId: commandData.targetAgentId,
      targetOrganizationId: commandData.targetOrganizationId,
      payload: commandData.payload,
      priority: Math.max(1, Math.min(5, commandData.priority || 3)),
      status: commandData.scheduledAt ? CommandStatus.SCHEDULED : CommandStatus.PENDING,
      createdAt: now,
      scheduledAt: commandData.scheduledAt,
      expiresAt: commandData.expiresAt || new Date(now.getTime() + this.defaultExpiration),
      retryCount: 0,
      maxRetries: commandData.maxRetries || 3,
      metadata: commandData.metadata || {},
    };

    await this.insertCommand(command);
    
    this.logger.debug(`Command queued: ${commandId} (${command.type})`);
    return commandId;
  }

  private async insertCommand(command: QueuedCommand): Promise<void> {
    const sql = `
      INSERT INTO commands (
        id, type, target_agent_id, target_organization_id, payload, priority,
        status, created_at, scheduled_at, expires_at, retry_count, max_retries, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      command.id,
      command.type,
      command.targetAgentId,
      command.targetOrganizationId,
      JSON.stringify(command.payload),
      command.priority,
      command.status,
      command.createdAt.toISOString(),
      command.scheduledAt?.toISOString(),
      command.expiresAt.toISOString(),
      command.retryCount,
      command.maxRetries,
      JSON.stringify(command.metadata),
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async getCommand(commandId: string): Promise<QueuedCommand | null> {
    const sql = 'SELECT * FROM commands WHERE id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [commandId], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!row) {
          resolve(null);
          return;
        }
        
        resolve(this.mapRowToCommand(row));
      });
    });
  }

  async getCommandsByStatus(status: CommandStatus, limit?: number): Promise<QueuedCommand[]> {
    let sql = 'SELECT * FROM commands WHERE status = ? ORDER BY priority ASC, created_at ASC';
    const params: any[] = [status];
    
    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const commands = rows.map(row => this.mapRowToCommand(row));
        resolve(commands);
      });
    });
  }

  async getCommandsByPriority(priority: number, status?: CommandStatus, limit?: number): Promise<QueuedCommand[]> {
    let sql = 'SELECT * FROM commands WHERE priority = ?';
    const params: any[] = [priority];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at ASC';
    
    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const commands = rows.map(row => this.mapRowToCommand(row));
        resolve(commands);
      });
    });
  }

  async getCommandsByAgent(agentId: string, limit?: number): Promise<QueuedCommand[]> {
    let sql = 'SELECT * FROM commands WHERE target_agent_id = ? ORDER BY created_at DESC';
    const params: any[] = [agentId];
    
    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const commands = rows.map(row => this.mapRowToCommand(row));
        resolve(commands);
      });
    });
  }

  async getReadyCommands(limit?: number): Promise<QueuedCommand[]> {
    const now = new Date().toISOString();
    let sql = `
      SELECT * FROM commands 
      WHERE (status = 'pending' OR (status = 'scheduled' AND scheduled_at <= ?))
        AND expires_at > ?
      ORDER BY priority ASC, created_at ASC
    `;
    const params: any[] = [now, now];
    
    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const commands = rows.map(row => this.mapRowToCommand(row));
        resolve(commands);
      });
    });
  }

  async updateCommandStatus(commandId: string, status: CommandStatus, updates?: {
    executedAt?: Date;
    completedAt?: Date;
    lastError?: string;
    result?: any;
    retryCount?: number;
  }): Promise<void> {
    let sql = 'UPDATE commands SET status = ?';
    const params: any[] = [status];
    
    if (updates?.executedAt) {
      sql += ', executed_at = ?';
      params.push(updates.executedAt.toISOString());
    }
    
    if (updates?.completedAt) {
      sql += ', completed_at = ?';
      params.push(updates.completedAt.toISOString());
    }
    
    if (updates?.lastError) {
      sql += ', last_error = ?';
      params.push(updates.lastError);
    }
    
    if (updates?.result) {
      sql += ', result = ?';
      params.push(JSON.stringify(updates.result));
    }
    
    if (updates?.retryCount !== undefined) {
      sql += ', retry_count = ?';
      params.push(updates.retryCount);
    }
    
    sql += ' WHERE id = ?';
    params.push(commandId);

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async scheduleCommandRetry(commandId: string, retryAt: Date): Promise<void> {
    const sql = `
      UPDATE commands 
      SET status = 'scheduled', scheduled_at = ?, retry_count = retry_count + 1
      WHERE id = ?
    `;
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, [retryAt.toISOString(), commandId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async cancelCommand(commandId: string): Promise<boolean> {
    const command = await this.getCommand(commandId);
    if (!command) {
      return false;
    }

    if (command.status === CommandStatus.EXECUTING) {
      // Cannot cancel executing commands
      return false;
    }

    await this.updateCommandStatus(commandId, CommandStatus.CANCELLED);
    return true;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireOldCommands(): Promise<void> {
    const now = new Date().toISOString();
    const sql = `
      UPDATE commands 
      SET status = 'expired' 
      WHERE expires_at <= ? AND status IN ('pending', 'scheduled')
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [now], function(err) {
        if (err) {
          this.logger.error(`Failed to expire old commands: ${err.message}`);
          reject(err);
          return;
        }
        
        if (this.changes > 0) {
          this.logger.log(`Expired ${this.changes} old commands`);
        }
        resolve();
      });
    });
  }

  async getQueueStats(): Promise<QueueStats> {
    const sql = `
      SELECT 
        status,
        priority,
        COUNT(*) as count,
        AVG(CASE 
          WHEN completed_at IS NOT NULL AND executed_at IS NOT NULL 
          THEN (julianday(completed_at) - julianday(executed_at)) * 86400000 
          ELSE NULL 
        END) as avg_execution_time
      FROM commands 
      GROUP BY status, priority
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const stats: QueueStats = {
          totalCommands: 0,
          pendingCommands: 0,
          scheduledCommands: 0,
          executingCommands: 0,
          completedCommands: 0,
          failedCommands: 0,
          expiredCommands: 0,
          cancelledCommands: 0,
          averageExecutionTime: 0,
          successRate: 0,
          queuesByPriority: [],
        };

        const priorityCounts: Record<number, number> = {};
        let totalExecutionTime = 0;
        let executionTimeCount = 0;

        rows.forEach(row => {
          const count = row.count;
          stats.totalCommands += count;

          switch (row.status) {
            case CommandStatus.PENDING:
              stats.pendingCommands += count;
              break;
            case CommandStatus.SCHEDULED:
              stats.scheduledCommands += count;
              break;
            case CommandStatus.EXECUTING:
              stats.executingCommands += count;
              break;
            case CommandStatus.COMPLETED:
              stats.completedCommands += count;
              break;
            case CommandStatus.FAILED:
              stats.failedCommands += count;
              break;
            case CommandStatus.EXPIRED:
              stats.expiredCommands += count;
              break;
            case CommandStatus.CANCELLED:
              stats.cancelledCommands += count;
              break;
          }

          priorityCounts[row.priority] = (priorityCounts[row.priority] || 0) + count;

          if (row.avg_execution_time) {
            totalExecutionTime += row.avg_execution_time * count;
            executionTimeCount += count;
          }
        });

        stats.averageExecutionTime = executionTimeCount > 0 ? totalExecutionTime / executionTimeCount : 0;
        
        const finishedCommands = stats.completedCommands + stats.failedCommands;
        stats.successRate = finishedCommands > 0 ? (stats.completedCommands / finishedCommands) * 100 : 0;

        stats.queuesByPriority = Object.entries(priorityCounts)
          .map(([priority, count]) => ({ priority: parseInt(priority), count }))
          .sort((a, b) => a.priority - b.priority);

        resolve(stats);
      });
    });
  }

  async getQueueSize(): Promise<number> {
    const sql = 'SELECT COUNT(*) as count FROM commands WHERE status IN (?, ?, ?)';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [CommandStatus.PENDING, CommandStatus.SCHEDULED, CommandStatus.EXECUTING], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row.count);
      });
    });
  }

  async cleanupOldCommands(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const sql = `
      DELETE FROM commands 
      WHERE status IN ('completed', 'failed', 'expired', 'cancelled') 
        AND created_at < ?
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [cutoffDate.toISOString()], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async recordQueueStats(): Promise<void> {
    try {
      const stats = await this.getQueueStats();
      
      const sql = `
        INSERT INTO queue_stats (
          timestamp, total_commands, pending_commands, executing_commands,
          completed_commands, failed_commands, average_execution_time, success_rate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        new Date().toISOString(),
        stats.totalCommands,
        stats.pendingCommands,
        stats.executingCommands,
        stats.completedCommands,
        stats.failedCommands,
        stats.averageExecutionTime,
        stats.successRate,
      ];

      return new Promise((resolve, reject) => {
        this.db.run(sql, params, function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    } catch (error) {
      this.logger.error(`Failed to record queue stats: ${error.message}`);
    }
  }

  private mapRowToCommand(row: any): QueuedCommand {
    return {
      id: row.id,
      type: row.type,
      targetAgentId: row.target_agent_id,
      targetOrganizationId: row.target_organization_id,
      payload: JSON.parse(row.payload),
      priority: row.priority,
      status: row.status as CommandStatus,
      createdAt: new Date(row.created_at),
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
      expiresAt: new Date(row.expires_at),
      executedAt: row.executed_at ? new Date(row.executed_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      lastError: row.last_error,
      result: row.result ? JSON.parse(row.result) : undefined,
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }

  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            this.logger.error(`Error closing database: ${err.message}`);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}