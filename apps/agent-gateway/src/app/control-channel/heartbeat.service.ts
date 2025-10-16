import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebSocketClientService } from './websocket-client.service';
import { AgentManagementService } from './agent-management.service';

export interface HeartbeatStats {
  lastHeartbeat: Date;
  heartbeatInterval: number;
  missedHeartbeats: number;
  totalHeartbeats: number;
  averageLatency: number;
  status: 'healthy' | 'warning' | 'critical';
}

@Injectable()
export class HeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HeartbeatService.name);
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly heartbeatInterval: number;
  private readonly maxMissedHeartbeats: number;
  
  private stats: HeartbeatStats = {
    lastHeartbeat: new Date(),
    heartbeatInterval: 30000, // 30 seconds
    missedHeartbeats: 0,
    totalHeartbeats: 0,
    averageLatency: 0,
    status: 'healthy',
  };

  private latencyHistory: number[] = [];
  private readonly maxLatencyHistory = 100;

  constructor(
    private readonly config: ConfigService,
    private readonly webSocketClient: WebSocketClientService,
    private readonly agentManagement: AgentManagementService,
  ) {
    this.heartbeatInterval = parseInt(this.config.get('HEARTBEAT_INTERVAL', '30000'));
    this.maxMissedHeartbeats = parseInt(this.config.get('MAX_MISSED_HEARTBEATS', '3'));
    
    this.stats.heartbeatInterval = this.heartbeatInterval;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Heartbeat service initialized');
    this.startHeartbeat();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopHeartbeat();
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return; // Already started
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);

    this.logger.log(`Heartbeat started with ${this.heartbeatInterval}ms interval`);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.logger.log('Heartbeat stopped');
    }
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      if (!this.webSocketClient.isConnected()) {
        this.stats.missedHeartbeats++;
        this.updateStatus();
        this.logger.debug('Skipping heartbeat - WebSocket not connected');
        return;
      }

      const startTime = Date.now();
      const success = this.webSocketClient.sendHeartbeat();
      
      if (success) {
        this.stats.lastHeartbeat = new Date();
        this.stats.totalHeartbeats++;
        this.stats.missedHeartbeats = 0; // Reset on successful heartbeat
        
        const latency = Date.now() - startTime;
        this.recordLatency(latency);
        
        this.logger.debug(`Heartbeat sent successfully (latency: ${latency}ms)`);
      } else {
        this.stats.missedHeartbeats++;
        this.logger.warn('Failed to send heartbeat');
      }
      
      this.updateStatus();
      
    } catch (error) {
      this.stats.missedHeartbeats++;
      this.updateStatus();
      this.logger.error(`Heartbeat failed: ${error.message}`);
    }
  }

  private recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    
    // Keep only recent latency measurements
    if (this.latencyHistory.length > this.maxLatencyHistory) {
      this.latencyHistory.shift();
    }
    
    // Calculate average latency
    this.stats.averageLatency = this.latencyHistory.reduce((sum, l) => sum + l, 0) / this.latencyHistory.length;
  }

  private updateStatus(): void {
    if (this.stats.missedHeartbeats >= this.maxMissedHeartbeats) {
      this.stats.status = 'critical';
    } else if (this.stats.missedHeartbeats > 0 || this.stats.averageLatency > 5000) {
      this.stats.status = 'warning';
    } else {
      this.stats.status = 'healthy';
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async performHealthCheck(): Promise<void> {
    try {
      // Check if we've missed too many heartbeats
      if (this.stats.missedHeartbeats >= this.maxMissedHeartbeats) {
        this.logger.warn(`Missed ${this.stats.missedHeartbeats} consecutive heartbeats`);
        
        // Try to reconnect WebSocket
        if (!this.webSocketClient.isConnected()) {
          this.logger.log('Attempting to reconnect WebSocket due to missed heartbeats');
          await this.webSocketClient.connect();
        }
      }
      
      // Check for stale agent data
      await this.checkStaleAgents();
      
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
    }
  }

  private async checkStaleAgents(): Promise<void> {
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    const now = new Date();
    
    const allAgents = this.agentManagement.getAllAgents();
    let staleCount = 0;
    
    for (const agent of allAgents) {
      const timeSinceLastSeen = now.getTime() - agent.lastSeen.getTime();
      
      if (timeSinceLastSeen > staleThreshold && agent.status === 'online') {
        this.agentManagement.markAgentOffline(agent.id);
        staleCount++;
      }
    }
    
    if (staleCount > 0) {
      this.logger.log(`Marked ${staleCount} stale agents as offline`);
    }
  }

  getHeartbeatStats(): HeartbeatStats {
    return { ...this.stats };
  }

  getHeartbeatHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    stats: HeartbeatStats;
  } {
    const issues: string[] = [];
    
    if (this.stats.missedHeartbeats >= this.maxMissedHeartbeats) {
      issues.push(`Missed ${this.stats.missedHeartbeats} consecutive heartbeats`);
    }
    
    if (this.stats.averageLatency > 5000) {
      issues.push(`High average heartbeat latency: ${this.stats.averageLatency.toFixed(0)}ms`);
    }
    
    const timeSinceLastHeartbeat = Date.now() - this.stats.lastHeartbeat.getTime();
    if (timeSinceLastHeartbeat > this.heartbeatInterval * 2) {
      issues.push(`Last heartbeat was ${Math.round(timeSinceLastHeartbeat / 1000)}s ago`);
    }
    
    return {
      status: this.stats.status,
      issues,
      stats: this.stats,
    };
  }

  async testHeartbeat(): Promise<{
    success: boolean;
    latency?: number;
    error?: string;
  }> {
    try {
      if (!this.webSocketClient.isConnected()) {
        return {
          success: false,
          error: 'WebSocket not connected',
        };
      }

      const startTime = Date.now();
      const success = this.webSocketClient.sendHeartbeat();
      const latency = Date.now() - startTime;
      
      return {
        success,
        latency: success ? latency : undefined,
        error: success ? undefined : 'Failed to send heartbeat',
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  resetStats(): void {
    this.stats = {
      lastHeartbeat: new Date(),
      heartbeatInterval: this.heartbeatInterval,
      missedHeartbeats: 0,
      totalHeartbeats: 0,
      averageLatency: 0,
      status: 'healthy',
    };
    
    this.latencyHistory.length = 0;
    this.logger.log('Heartbeat stats reset');
  }

  updateInterval(newInterval: number): void {
    if (newInterval < 1000 || newInterval > 300000) {
      throw new Error('Heartbeat interval must be between 1s and 5m');
    }
    
    this.stopHeartbeat();
    this.stats.heartbeatInterval = newInterval;
    this.startHeartbeat();
    
    this.logger.log(`Heartbeat interval updated to ${newInterval}ms`);
  }

  getLatencyHistory(): number[] {
    return [...this.latencyHistory];
  }

  getLatencyStats(): {
    current: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  } {
    if (this.latencyHistory.length === 0) {
      return {
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        p95: 0,
      };
    }

    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    const current = this.latencyHistory[this.latencyHistory.length - 1];
    const average = this.stats.averageLatency;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    return {
      current,
      average,
      min,
      max,
      p95,
    };
  }
}