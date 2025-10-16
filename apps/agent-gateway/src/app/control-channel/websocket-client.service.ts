import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as WebSocket from 'ws';
import { MessageQueueService } from './message-queue.service';
import { AcknowledgmentService } from './acknowledgment.service';

export interface WebSocketConfig {
  url: string;
  apiKey: string;
  organizationId: number;
  gatewayId: string;
  reconnectInterval: number; // milliseconds
  maxReconnectAttempts: number;
  heartbeatInterval: number; // milliseconds
  connectionTimeout: number; // milliseconds
  enableCompression: boolean;
}

export interface ConnectionStats {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  connectedAt?: Date;
  disconnectedAt?: Date;
  reconnectAttempts: number;
  totalConnections: number;
  totalDisconnections: number;
  lastHeartbeatAt?: Date;
  latency: number;
}

export interface WebSocketMessage {
  id: string;
  type: 'command' | 'heartbeat' | 'ack' | 'response';
  payload: any;
  timestamp: Date;
  priority: number;
}

@Injectable()
export class WebSocketClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebSocketClientService.name);
  private ws: WebSocket | null = null;
  private readonly config: WebSocketConfig;
  private connectionStats: ConnectionStats;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isReconnecting = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly messageQueue: MessageQueueService,
    private readonly acknowledgment: AcknowledgmentService,
  ) {
    this.config = {
      url: this.configService.get('WEBSOCKET_URL', 'wss://api.staff-control.com/gateway'),
      apiKey: this.configService.get('WEBSOCKET_API_KEY', ''),
      organizationId: parseInt(this.configService.get('WEBSOCKET_ORGANIZATION_ID', '1')),
      gatewayId: this.configService.get('GATEWAY_ID', `gateway-${Date.now()}`),
      reconnectInterval: parseInt(this.configService.get('WEBSOCKET_RECONNECT_INTERVAL', '5000')),
      maxReconnectAttempts: parseInt(this.configService.get('WEBSOCKET_MAX_RECONNECT_ATTEMPTS', '10')),
      heartbeatInterval: parseInt(this.configService.get('WEBSOCKET_HEARTBEAT_INTERVAL', '30000')),
      connectionTimeout: parseInt(this.configService.get('WEBSOCKET_CONNECTION_TIMEOUT', '10000')),
      enableCompression: this.configService.get('WEBSOCKET_ENABLE_COMPRESSION', 'true') === 'true',
    };

    this.connectionStats = {
      status: 'disconnected',
      reconnectAttempts: 0,
      totalConnections: 0,
      totalDisconnections: 0,
      latency: 0,
    };
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.logger.debug('WebSocket already connected');
      return;
    }

    if (this.isReconnecting) {
      this.logger.debug('Reconnection already in progress');
      return;
    }

    try {
      this.connectionStats.status = 'connecting';
      this.logger.log(`Connecting to WebSocket: ${this.config.url}`);

      const wsOptions: WebSocket.ClientOptions = {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Organization-Id': this.config.organizationId.toString(),
          'X-Gateway-Id': this.config.gatewayId,
        },
        handshakeTimeout: this.config.connectionTimeout,
      };

      if (this.config.enableCompression) {
        wsOptions.perMessageDeflate = true;
      }

      this.ws = new WebSocket(this.config.url, wsOptions);

      // Set up event handlers
      this.setupEventHandlers();

      // Wait for connection to be established
      await this.waitForConnection();

      this.connectionStats.status = 'connected';
      this.connectionStats.connectedAt = new Date();
      this.connectionStats.totalConnections++;
      this.connectionStats.reconnectAttempts = 0;

      // Start heartbeat
      this.startHeartbeat();

      // Process queued messages
      await this.processQueuedMessages();

      this.logger.log('WebSocket connected successfully');

    } catch (error) {
      this.connectionStats.status = 'error';
      this.logger.error(`WebSocket connection failed: ${error.message}`);
      
      // Schedule reconnection
      this.scheduleReconnection();
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      this.logger.log('WebSocket connection opened');
    });

    this.ws.on('message', async (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleIncomingMessage(message);
      } catch (error) {
        this.logger.error(`Failed to process incoming message: ${error.message}`);
      }
    });

    this.ws.on('close', (code: number, reason: string) => {
      this.logger.warn(`WebSocket connection closed: ${code} - ${reason}`);
      this.handleDisconnection();
    });

    this.ws.on('error', (error: Error) => {
      this.logger.error(`WebSocket error: ${error.message}`);
      this.connectionStats.status = 'error';
    });

    this.ws.on('ping', () => {
      this.logger.debug('Received ping from server');
    });

    this.ws.on('pong', () => {
      this.logger.debug('Received pong from server');
      this.updateLatency();
    });
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout);

      this.ws.once('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.ws.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private handleDisconnection(): void {
    this.connectionStats.status = 'disconnected';
    this.connectionStats.disconnectedAt = new Date();
    this.connectionStats.totalDisconnections++;

    // Stop heartbeat
    this.stopHeartbeat();

    // Schedule reconnection if not manually disconnected
    if (!this.isReconnecting) {
      this.scheduleReconnection();
    }
  }

  private scheduleReconnection(): void {
    if (this.connectionStats.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.error(`Max reconnection attempts reached: ${this.connectionStats.reconnectAttempts}`);
      return;
    }

    this.isReconnecting = true;
    this.connectionStats.reconnectAttempts++;

    // Exponential backoff for reconnection
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.connectionStats.reconnectAttempts - 1),
      60000 // Max 1 minute
    );

    this.logger.log(`Scheduling reconnection attempt ${this.connectionStats.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      this.isReconnecting = false;
      try {
        await this.connect();
      } catch (error) {
        this.logger.error(`Reconnection attempt failed: ${error.message}`);
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.isConnected()) {
      return;
    }

    const heartbeatMessage: WebSocketMessage = {
      id: `heartbeat-${Date.now()}`,
      type: 'heartbeat',
      payload: {
        gatewayId: this.config.gatewayId,
        timestamp: new Date().toISOString(),
        status: 'online',
      },
      timestamp: new Date(),
      priority: 1,
    };

    await this.sendMessage(heartbeatMessage);
    this.connectionStats.lastHeartbeatAt = new Date();
  }

  private updateLatency(): void {
    // Simple latency calculation based on heartbeat
    if (this.connectionStats.lastHeartbeatAt) {
      this.connectionStats.latency = Date.now() - this.connectionStats.lastHeartbeatAt.getTime();
    }
  }

  async sendMessage(message: WebSocketMessage): Promise<boolean> {
    if (!this.isConnected()) {
      // Queue message for later delivery
      await this.messageQueue.queueMessage(message);
      this.logger.debug(`Message queued: ${message.id}`);
      return false;
    }

    try {
      const messageData = JSON.stringify(message);
      this.ws!.send(messageData);
      
      this.logger.debug(`Message sent: ${message.id} (${message.type})`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to send message ${message.id}: ${error.message}`);
      
      // Queue message for retry
      await this.messageQueue.queueMessage(message);
      return false;
    }
  }

  private async handleIncomingMessage(message: any): Promise<void> {
    this.logger.debug(`Received message: ${message.id} (${message.type})`);

    try {
      switch (message.type) {
        case 'command':
          await this.handleCommand(message);
          break;
        case 'ack':
          await this.handleAcknowledgment(message);
          break;
        case 'heartbeat':
          await this.handleHeartbeatResponse(message);
          break;
        default:
          this.logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle message ${message.id}: ${error.message}`);
    }
  }

  private async handleCommand(message: any): Promise<void> {
    // Send acknowledgment
    await this.sendAcknowledgment(message.id);
    
    // Forward to command processor
    // This would be handled by CommandProcessorService
    this.logger.debug(`Command received: ${message.payload.command}`);
  }

  private async handleAcknowledgment(message: any): Promise<void> {
    await this.acknowledgment.markAcknowledged(message.payload.messageId);
  }

  private async handleHeartbeatResponse(message: any): Promise<void> {
    this.updateLatency();
    this.logger.debug('Heartbeat acknowledged by server');
  }

  private async sendAcknowledgment(messageId: string): Promise<void> {
    const ackMessage: WebSocketMessage = {
      id: `ack-${messageId}`,
      type: 'ack',
      payload: {
        messageId,
        gatewayId: this.config.gatewayId,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
      priority: 1,
    };

    await this.sendMessage(ackMessage);
  }

  private async processQueuedMessages(): Promise<void> {
    const queuedMessages = await this.messageQueue.getQueuedMessages();
    
    if (queuedMessages.length === 0) {
      return;
    }

    this.logger.log(`Processing ${queuedMessages.length} queued messages`);

    for (const message of queuedMessages) {
      const sent = await this.sendMessage(message);
      if (sent) {
        await this.messageQueue.removeMessage(message.id);
      }
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  async disconnect(): Promise<void> {
    this.isReconnecting = false;

    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close(1000, 'Gateway shutdown');
      this.ws = null;
    }

    this.connectionStats.status = 'disconnected';
    this.connectionStats.disconnectedAt = new Date();

    this.logger.log('WebSocket disconnected');
  }

  getConnectionStats(): ConnectionStats {
    return { ...this.connectionStats };
  }

  getConfig(): Omit<WebSocketConfig, 'apiKey'> {
    const { apiKey, ...safeConfig } = this.config;
    return safeConfig;
  }

  async updateConfig(newConfig: Partial<WebSocketConfig>): Promise<void> {
    const wasConnected = this.isConnected();
    
    Object.assign(this.config, newConfig);
    
    // Reconnect if configuration changed and we were connected
    if (wasConnected) {
      await this.disconnect();
      await this.connect();
    }

    this.logger.log('WebSocket configuration updated');
  }

  async forceReconnect(): Promise<void> {
    this.logger.log('Forcing WebSocket reconnection');
    
    this.connectionStats.reconnectAttempts = 0; // Reset attempts
    await this.disconnect();
    await this.connect();
  }

  async ping(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const startTime = Date.now();
      
      this.ws!.ping();
      
      const timeout = setTimeout(() => {
        reject(new Error('Ping timeout'));
      }, 5000);

      this.ws!.once('pong', () => {
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        resolve(latency);
      });
    });
  }

  async getConnectionHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    connected: boolean;
    latency: number;
    uptime: number; // milliseconds
    reconnectAttempts: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    const connected = this.isConnected();
    const uptime = this.connectionStats.connectedAt 
      ? Date.now() - this.connectionStats.connectedAt.getTime()
      : 0;

    if (!connected) {
      status = 'unhealthy';
      issues.push('WebSocket not connected');
    }

    if (this.connectionStats.reconnectAttempts > 0) {
      if (this.connectionStats.reconnectAttempts >= 5) {
        status = 'unhealthy';
        issues.push(`High reconnection attempts: ${this.connectionStats.reconnectAttempts}`);
      } else {
        status = status === 'healthy' ? 'degraded' : status;
        issues.push(`Recent reconnections: ${this.connectionStats.reconnectAttempts}`);
      }
    }

    if (this.connectionStats.latency > 5000) {
      status = 'unhealthy';
      issues.push(`High latency: ${this.connectionStats.latency}ms`);
    } else if (this.connectionStats.latency > 1000) {
      status = status === 'healthy' ? 'degraded' : status;
      issues.push(`Elevated latency: ${this.connectionStats.latency}ms`);
    }

    // Check heartbeat freshness
    if (this.connectionStats.lastHeartbeatAt) {
      const timeSinceHeartbeat = Date.now() - this.connectionStats.lastHeartbeatAt.getTime();
      if (timeSinceHeartbeat > this.config.heartbeatInterval * 3) {
        status = 'unhealthy';
        issues.push(`Heartbeat overdue: ${Math.floor(timeSinceHeartbeat / 1000)}s`);
      }
    }

    return {
      status,
      connected,
      latency: this.connectionStats.latency,
      uptime,
      reconnectAttempts: this.connectionStats.reconnectAttempts,
      issues,
    };
  }
}