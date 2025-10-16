import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataValidationService } from './data-validation.service';
import { BufferService } from '../buffer/buffer.service';

export interface ProcessedMonitoringData {
  agentId: string;
  organizationId: number;
  receivedAt: Date;
  activeWindows?: any[];
  visitedSites?: any[];
  screenshots?: any[];
  userSessions?: any[];
}

export interface ProcessedDeviceEvent {
  agentId: string;
  organizationId: number;
  receivedAt: Date;
  deviceId: string;
  eventType: string;
  eventData: any;
  timestamp: Date;
}

export interface ProcessedHeartbeat {
  agentId: string;
  organizationId: number;
  receivedAt: Date;
  status: string;
  version: string;
  systemInfo: any;
  timestamp: Date;
}

@Injectable()
export class CollectorService {
  private readonly logger = new Logger(CollectorService.name);
  private readonly maxBatchSize: number;
  private readonly processingStats = {
    totalReceived: 0,
    totalProcessed: 0,
    totalErrors: 0,
    lastProcessedAt: new Date(),
  };

  constructor(
    private readonly config: ConfigService,
    private readonly dataValidation: DataValidationService,
    private readonly bufferService: BufferService,
  ) {
    this.maxBatchSize = parseInt(this.config.get('COLLECTOR_MAX_BATCH_SIZE', '1000'));
  }

  async processMonitoringData(data: ProcessedMonitoringData): Promise<{ accepted: boolean; buffered: number }> {
    try {
      this.processingStats.totalReceived++;

      // Validate incoming data
      const validationResult = await this.dataValidation.validateMonitoringData(data);
      if (!validationResult.valid) {
        this.logger.warn(`Invalid monitoring data from agent ${data.agentId}: ${validationResult.errors.join(', ')}`);
        this.processingStats.totalErrors++;
        return { accepted: false, buffered: 0 };
      }

      // Transform and normalize data
      const normalizedData = await this.normalizeMonitoringData(data);
      
      // Buffer the data for batch processing
      let bufferedCount = 0;

      if (normalizedData.activeWindows?.length > 0) {
        await this.bufferService.addToBuffer('active_windows', normalizedData.activeWindows);
        bufferedCount += normalizedData.activeWindows.length;
      }

      if (normalizedData.visitedSites?.length > 0) {
        await this.bufferService.addToBuffer('visited_sites', normalizedData.visitedSites);
        bufferedCount += normalizedData.visitedSites.length;
      }

      if (normalizedData.screenshots?.length > 0) {
        await this.bufferService.addToBuffer('screenshots', normalizedData.screenshots);
        bufferedCount += normalizedData.screenshots.length;
      }

      if (normalizedData.userSessions?.length > 0) {
        await this.bufferService.addToBuffer('user_sessions', normalizedData.userSessions);
        bufferedCount += normalizedData.userSessions.length;
      }

      this.processingStats.totalProcessed++;
      this.processingStats.lastProcessedAt = new Date();

      this.logger.debug(`Processed monitoring data from agent ${data.agentId}: ${bufferedCount} records buffered`);

      return { accepted: true, buffered: bufferedCount };

    } catch (error) {
      this.logger.error(`Failed to process monitoring data from agent ${data.agentId}: ${error.message}`);
      this.processingStats.totalErrors++;
      return { accepted: false, buffered: 0 };
    }
  }

  async processDeviceEvents(events: ProcessedDeviceEvent[]): Promise<{ accepted: number; rejected: number }> {
    let accepted = 0;
    let rejected = 0;

    try {
      for (const event of events) {
        try {
          // Validate device event
          const validationResult = await this.dataValidation.validateDeviceEvent(event);
          if (!validationResult.valid) {
            this.logger.warn(`Invalid device event from agent ${event.agentId}: ${validationResult.errors.join(', ')}`);
            rejected++;
            continue;
          }

          // Normalize and buffer device event
          const normalizedEvent = await this.normalizeDeviceEvent(event);
          await this.bufferService.addToBuffer('device_events', [normalizedEvent]);
          
          accepted++;

        } catch (error) {
          this.logger.error(`Failed to process device event: ${error.message}`);
          rejected++;
        }
      }

      this.logger.debug(`Processed ${events.length} device events: ${accepted} accepted, ${rejected} rejected`);

      return { accepted, rejected };

    } catch (error) {
      this.logger.error(`Failed to process device events: ${error.message}`);
      return { accepted: 0, rejected: events.length };
    }
  }

  async processHeartbeat(heartbeat: ProcessedHeartbeat): Promise<{ acknowledged: boolean; commands?: any[] }> {
    try {
      // Validate heartbeat
      const validationResult = await this.dataValidation.validateHeartbeat(heartbeat);
      if (!validationResult.valid) {
        this.logger.warn(`Invalid heartbeat from agent ${heartbeat.agentId}: ${validationResult.errors.join(', ')}`);
        return { acknowledged: false };
      }

      // Update agent status
      await this.updateAgentStatus(heartbeat);

      // Check for pending commands for this agent
      const pendingCommands = await this.getPendingCommands(heartbeat.agentId, heartbeat.organizationId);

      this.logger.debug(`Processed heartbeat from agent ${heartbeat.agentId}, ${pendingCommands.length} pending commands`);

      return { 
        acknowledged: true, 
        commands: pendingCommands.length > 0 ? pendingCommands : undefined 
      };

    } catch (error) {
      this.logger.error(`Failed to process heartbeat from agent ${heartbeat.agentId}: ${error.message}`);
      return { acknowledged: false };
    }
  }

  private async normalizeMonitoringData(data: ProcessedMonitoringData): Promise<ProcessedMonitoringData> {
    const normalized = { ...data };

    // Normalize active windows
    if (normalized.activeWindows) {
      normalized.activeWindows = normalized.activeWindows.map(window => ({
        ...window,
        id: window.id || `${data.agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        agent_id: data.agentId,
        organization_id: data.organizationId,
        datetime: window.datetime ? new Date(window.datetime) : data.receivedAt,
        created_at: data.receivedAt,
      }));
    }

    // Normalize visited sites
    if (normalized.visitedSites) {
      normalized.visitedSites = normalized.visitedSites.map(site => ({
        ...site,
        id: site.id || `${data.agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        agent_id: data.agentId,
        organization_id: data.organizationId,
        datetime: site.datetime ? new Date(site.datetime) : data.receivedAt,
        created_at: data.receivedAt,
      }));
    }

    // Normalize screenshots
    if (normalized.screenshots) {
      normalized.screenshots = normalized.screenshots.map(screenshot => ({
        ...screenshot,
        id: screenshot.id || `${data.agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        agent_id: data.agentId,
        organization_id: data.organizationId,
        datetime: screenshot.datetime ? new Date(screenshot.datetime) : data.receivedAt,
        created_at: data.receivedAt,
      }));
    }

    // Normalize user sessions
    if (normalized.userSessions) {
      normalized.userSessions = normalized.userSessions.map(session => ({
        ...session,
        id: session.id || `${data.agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        agent_id: data.agentId,
        organization_id: data.organizationId,
        datetime: session.datetime ? new Date(session.datetime) : data.receivedAt,
        created_at: data.receivedAt,
      }));
    }

    return normalized;
  }

  private async normalizeDeviceEvent(event: ProcessedDeviceEvent): Promise<any> {
    return {
      ...event,
      id: event.deviceId ? `${event.deviceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : undefined,
      agent_id: event.agentId,
      organization_id: event.organizationId,
      datetime: event.timestamp ? new Date(event.timestamp) : event.receivedAt,
      created_at: event.receivedAt,
    };
  }

  private async updateAgentStatus(heartbeat: ProcessedHeartbeat): Promise<void> {
    // This would typically update agent status in database
    // For now, we'll just log it
    this.logger.debug(`Agent ${heartbeat.agentId} status: ${heartbeat.status}, version: ${heartbeat.version}`);
  }

  private async getPendingCommands(agentId: string, organizationId: number): Promise<any[]> {
    // This would typically fetch pending commands from database
    // For now, return empty array
    return [];
  }

  getProcessingStats() {
    return { ...this.processingStats };
  }

  resetStats() {
    this.processingStats.totalReceived = 0;
    this.processingStats.totalProcessed = 0;
    this.processingStats.totalErrors = 0;
    this.processingStats.lastProcessedAt = new Date();
  }
}