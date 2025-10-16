import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as https from 'https';
import * as fs from 'fs';
import { RetryService } from './retry.service';
import { IdempotencyService } from './idempotency.service';

export interface UplinkConfig {
  baseUrl: string;
  apiKey: string;
  organizationId: number;
  enableMutualTLS: boolean;
  clientCertPath?: string;
  clientKeyPath?: string;
  caCertPath?: string;
  connectionPoolSize: number;
  requestTimeout: number;
  compressionEnabled: boolean;
}

export interface UplinkRequest {
  endpoint: string;
  data: any;
  idempotencyKey?: string;
  priority?: number;
  metadata?: Record<string, any>;
}

export interface UplinkResponse {
  success: boolean;
  statusCode: number;
  data?: any;
  error?: string;
  duration: number;
  retryCount: number;
  idempotencyKey?: string;
}

@Injectable()
export class UplinkService {
  private readonly logger = new Logger(UplinkService.name);
  private readonly config: UplinkConfig;
  private httpsAgent: https.Agent;
  private requestStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    lastRequestAt: new Date(),
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly retryService: RetryService,
    private readonly idempotencyService: IdempotencyService,
  ) {
    this.config = {
      baseUrl: this.configService.get('UPLINK_BASE_URL', 'https://api.staff-control.com'),
      apiKey: this.configService.get('UPLINK_API_KEY', ''),
      organizationId: parseInt(this.configService.get('UPLINK_ORGANIZATION_ID', '1')),
      enableMutualTLS: this.configService.get('UPLINK_ENABLE_MTLS', 'false') === 'true',
      clientCertPath: this.configService.get('UPLINK_CLIENT_CERT_PATH'),
      clientKeyPath: this.configService.get('UPLINK_CLIENT_KEY_PATH'),
      caCertPath: this.configService.get('UPLINK_CA_CERT_PATH'),
      connectionPoolSize: parseInt(this.configService.get('UPLINK_CONNECTION_POOL_SIZE', '10')),
      requestTimeout: parseInt(this.configService.get('UPLINK_REQUEST_TIMEOUT', '30000')),
      compressionEnabled: this.configService.get('UPLINK_COMPRESSION_ENABLED', 'true') === 'true',
    };

    this.initializeHttpsAgent();
  }

  private initializeHttpsAgent(): void {
    const agentOptions: https.AgentOptions = {
      keepAlive: true,
      maxSockets: this.config.connectionPoolSize,
      maxFreeSockets: Math.floor(this.config.connectionPoolSize / 2),
      timeout: this.config.requestTimeout,
    };

    // Configure mutual TLS if enabled
    if (this.config.enableMutualTLS) {
      try {
        if (this.config.clientCertPath && this.config.clientKeyPath) {
          agentOptions.cert = fs.readFileSync(this.config.clientCertPath);
          agentOptions.key = fs.readFileSync(this.config.clientKeyPath);
        }

        if (this.config.caCertPath) {
          agentOptions.ca = fs.readFileSync(this.config.caCertPath);
        }

        this.logger.log('Mutual TLS configured for uplink communication');
      } catch (error) {
        this.logger.error(`Failed to configure mutual TLS: ${error.message}`);
        throw error;
      }
    }

    this.httpsAgent = new https.Agent(agentOptions);
  }

  async sendRequest(request: UplinkRequest): Promise<UplinkResponse> {
    const startTime = Date.now();
    this.requestStats.totalRequests++;

    try {
      // Generate idempotency key if not provided
      const idempotencyKey = request.idempotencyKey || 
        await this.idempotencyService.generateKey(request.endpoint, request.data);

      // Check if request was already processed
      const existingResponse = await this.idempotencyService.getResponse(idempotencyKey);
      if (existingResponse) {
        this.logger.debug(`Request already processed: ${idempotencyKey}`);
        return {
          ...existingResponse,
          duration: Date.now() - startTime,
          retryCount: 0,
          idempotencyKey,
        };
      }

      // Execute request with retry logic
      const response = await this.retryService.executeWithRetry(
        () => this.executeHttpRequest(request, idempotencyKey),
        {
          maxAttempts: 5,
          baseDelay: 1000,
          maxDelay: 16000,
          backoffMultiplier: 2,
        }
      );

      // Store response for idempotency
      await this.idempotencyService.storeResponse(idempotencyKey, response);

      // Update stats
      this.updateRequestStats(true, Date.now() - startTime);

      return {
        ...response,
        duration: Date.now() - startTime,
        idempotencyKey,
      };

    } catch (error) {
      this.logger.error(`Uplink request failed: ${error.message}`);
      this.updateRequestStats(false, Date.now() - startTime);

      return {
        success: false,
        statusCode: 0,
        error: error.message,
        duration: Date.now() - startTime,
        retryCount: error.retryCount || 0,
        idempotencyKey: request.idempotencyKey,
      };
    }
  }

  private async executeHttpRequest(request: UplinkRequest, idempotencyKey: string): Promise<UplinkResponse> {
    const url = `${this.config.baseUrl}${request.endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'X-Organization-Id': this.config.organizationId.toString(),
      'X-Idempotency-Key': idempotencyKey,
      'User-Agent': 'AgentGateway/1.0',
    };

    if (this.config.compressionEnabled) {
      headers['Accept-Encoding'] = 'gzip, deflate';
      headers['Content-Encoding'] = 'gzip';
    }

    const requestConfig = {
      headers,
      timeout: this.config.requestTimeout,
      httpsAgent: this.httpsAgent,
      validateStatus: (status: number) => status < 500, // Don't throw on 4xx errors
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, request.data, requestConfig)
      );

      const success = response.status >= 200 && response.status < 300;

      return {
        success,
        statusCode: response.status,
        data: response.data,
        duration: 0, // Will be set by caller
        retryCount: 0, // Will be set by retry service
      };

    } catch (error) {
      if (error.response) {
        // HTTP error response
        return {
          success: false,
          statusCode: error.response.status,
          error: error.response.data?.message || error.message,
          duration: 0,
          retryCount: 0,
        };
      } else {
        // Network or other error
        throw error;
      }
    }
  }

  async sendBatch(requests: UplinkRequest[]): Promise<UplinkResponse[]> {
    if (requests.length === 0) {
      return [];
    }

    this.logger.debug(`Sending batch of ${requests.length} requests`);

    // Process requests concurrently with a limit
    const concurrencyLimit = Math.min(5, requests.length);
    const results: UplinkResponse[] = [];

    for (let i = 0; i < requests.length; i += concurrencyLimit) {
      const batch = requests.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(request => this.sendRequest(request));
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.error(`Batch request ${i + index} failed: ${result.reason}`);
          results.push({
            success: false,
            statusCode: 0,
            error: result.reason.message || 'Unknown error',
            duration: 0,
            retryCount: 0,
          });
        }
      });
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.debug(`Batch completed: ${successCount}/${requests.length} successful`);

    return results;
  }

  async testConnection(): Promise<{
    success: boolean;
    latency: number;
    error?: string;
    tlsInfo?: {
      protocol: string;
      cipher: string;
      authorized: boolean;
    };
  }> {
    const startTime = Date.now();

    try {
      const response = await this.sendRequest({
        endpoint: '/health',
        data: { test: true },
      });

      return {
        success: response.success,
        latency: Date.now() - startTime,
        error: response.error,
      };

    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private updateRequestStats(success: boolean, duration: number): void {
    if (success) {
      this.requestStats.successfulRequests++;
    } else {
      this.requestStats.failedRequests++;
    }

    // Update average latency
    const totalRequests = this.requestStats.successfulRequests + this.requestStats.failedRequests;
    const currentAvg = this.requestStats.averageLatency;
    this.requestStats.averageLatency = ((currentAvg * (totalRequests - 1)) + duration) / totalRequests;
    
    this.requestStats.lastRequestAt = new Date();
  }

  getRequestStats() {
    return {
      ...this.requestStats,
      successRate: this.requestStats.totalRequests > 0 
        ? (this.requestStats.successfulRequests / this.requestStats.totalRequests) * 100 
        : 0,
    };
  }

  resetStats(): void {
    this.requestStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      lastRequestAt: new Date(),
    };
  }

  getConfig(): UplinkConfig {
    // Return config without sensitive information
    return {
      ...this.config,
      apiKey: this.config.apiKey ? '[REDACTED]' : '',
    } as UplinkConfig;
  }

  async updateConfig(newConfig: Partial<UplinkConfig>): Promise<void> {
    Object.assign(this.config, newConfig);
    
    // Reinitialize HTTPS agent if TLS config changed
    if (newConfig.enableMutualTLS !== undefined || 
        newConfig.clientCertPath || 
        newConfig.clientKeyPath || 
        newConfig.caCertPath) {
      this.initializeHttpsAgent();
    }

    this.logger.log('Uplink configuration updated');
  }

  async getConnectionPoolStats(): Promise<{
    totalSockets: number;
    freeSockets: number;
    requests: number;
    pending: number;
  }> {
    // This would require access to the internal state of the HTTPS agent
    // For now, return placeholder values
    return {
      totalSockets: 0,
      freeSockets: 0,
      requests: 0,
      pending: 0,
    };
  }

  destroy(): void {
    if (this.httpsAgent) {
      this.httpsAgent.destroy();
    }
  }
}