import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdapterRegistryService } from './adapter-registry.service';
import { AdapterConfigurationService } from './adapter-configuration.service';
import { IDeviceAdapter, AdapterHealth, HealthStatus } from './interfaces/device-adapter.interface';

export interface LifecycleEvent {
  id: string;
  adapterId: string;
  eventType: LifecycleEventType;
  timestamp: Date;
  details: any;
  success: boolean;
  error?: string;
  duration?: number;
}

export enum LifecycleEventType {
  ADAPTER_LOADED = 'adapter_loaded',
  ADAPTER_UNLOADED = 'adapter_unloaded',
  ADAPTER_RELOADED = 'adapter_reloaded',
  ADAPTER_ENABLED = 'adapter_enabled',
  ADAPTER_DISABLED = 'adapter_disabled',
  ADAPTER_FAILED = 'adapter_failed',
  ADAPTER_RECOVERED = 'adapter_recovered',
  HEALTH_CHECK_PASSED = 'health_check_passed',
  HEALTH_CHECK_FAILED = 'health_check_failed',
  GRACEFUL_SHUTDOWN = 'graceful_shutdown',
  FORCE_SHUTDOWN = 'force_shutdown',
}

export interface AdapterFailureInfo {
  adapterId: string;
  failureCount: number;
  lastFailure: Date;
  failureReasons: string[];
  isolationLevel: IsolationLevel;
  recoveryAttempts: number;
  lastRecoveryAttempt?: Date;
}

export enum IsolationLevel {
  NONE = 'none',
  WARNING = 'warning',
  QUARANTINE = 'quarantine',
  DISABLED = 'disabled',
}

@Injectable()
export class AdapterLifecycleService implements OnModuleInit {
  private readonly logger = new Logger(AdapterLifecycleService.name);
  private readonly lifecycleEvents: LifecycleEvent[] = [];
  private readonly adapterFailures = new Map<string, AdapterFailureInfo>();
  private readonly shutdownPromises = new Map<string, Promise<void>>();
  
  private readonly maxFailureCount: number;
  private readonly failureWindow: number; // milliseconds
  private readonly recoveryInterval: number; // milliseconds
  private readonly healthCheckInterval: number; // milliseconds
  private readonly gracefulShutdownTimeout: number; // milliseconds

  constructor(
    private readonly config: ConfigService,
    private readonly adapterRegistry: AdapterRegistryService,
    private readonly adapterConfig: AdapterConfigurationService,
  ) {
    this.maxFailureCount = parseInt(this.config.get('ADAPTER_MAX_FAILURE_COUNT', '5'));
    this.failureWindow = parseInt(this.config.get('ADAPTER_FAILURE_WINDOW', '300000')); // 5 minutes
    this.recoveryInterval = parseInt(this.config.get('ADAPTER_RECOVERY_INTERVAL', '60000')); // 1 minute
    this.healthCheckInterval = parseInt(this.config.get('ADAPTER_HEALTH_CHECK_INTERVAL', '30000')); // 30 seconds
    this.gracefulShutdownTimeout = parseInt(this.config.get('ADAPTER_GRACEFUL_SHUTDOWN_TIMEOUT', '30000')); // 30 seconds
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Adapter Lifecycle Management initialized');
  }

  /**
   * Hot reload an adapter
   */
  async hotReloadAdapter(adapterId: string): Promise<LifecycleEvent> {
    const startTime = Date.now();
    const eventId = this.generateEventId();

    try {
      this.logger.log(`Starting hot reload for adapter: ${adapterId}`);

      // Get current adapter registration
      const registration = this.adapterRegistry.getAdapterRegistration(adapterId);
      if (!registration) {
        throw new Error(`Adapter not found: ${adapterId}`);
      }

      // Step 1: Gracefully shutdown connections
      await this.gracefulShutdownConnections(adapterId);

      // Step 2: Reload adapter
      const reloadResult = await this.adapterRegistry.reloadAdapter(adapterId);
      if (!reloadResult.success) {
        throw new Error(reloadResult.error || 'Reload failed');
      }

      // Step 3: Verify adapter health
      await this.performHealthCheck(adapterId);

      const event: LifecycleEvent = {
        id: eventId,
        adapterId,
        eventType: LifecycleEventType.ADAPTER_RELOADED,
        timestamp: new Date(),
        details: {
          reloadPath: registration.loadPath,
          version: reloadResult.adapter?.version,
        },
        success: true,
        duration: Date.now() - startTime,
      };

      this.recordLifecycleEvent(event);
      this.logger.log(`Hot reload completed for adapter: ${adapterId}`);
      
      return event;

    } catch (error) {
      const event: LifecycleEvent = {
        id: eventId,
        adapterId,
        eventType: LifecycleEventType.ADAPTER_RELOADED,
        timestamp: new Date(),
        details: {},
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };

      this.recordLifecycleEvent(event);
      this.recordAdapterFailure(adapterId, error.message);
      
      this.logger.error(`Hot reload failed for adapter ${adapterId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enable an adapter
   */
  async enableAdapter(adapterId: string): Promise<LifecycleEvent> {
    const startTime = Date.now();
    const eventId = this.generateEventId();

    try {
      this.logger.log(`Enabling adapter: ${adapterId}`);

      // Enable in registry
      await this.adapterRegistry.setAdapterEnabled(adapterId, true);

      // Clear failure info if exists
      this.adapterFailures.delete(adapterId);

      // Perform health check
      await this.performHealthCheck(adapterId);

      const event: LifecycleEvent = {
        id: eventId,
        adapterId,
        eventType: LifecycleEventType.ADAPTER_ENABLED,
        timestamp: new Date(),
        details: {},
        success: true,
        duration: Date.now() - startTime,
      };

      this.recordLifecycleEvent(event);
      this.logger.log(`Adapter enabled: ${adapterId}`);
      
      return event;

    } catch (error) {
      const event: LifecycleEvent = {
        id: eventId,
        adapterId,
        eventType: LifecycleEventType.ADAPTER_ENABLED,
        timestamp: new Date(),
        details: {},
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };

      this.recordLifecycleEvent(event);
      this.recordAdapterFailure(adapterId, error.message);
      
      this.logger.error(`Failed to enable adapter ${adapterId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disable an adapter
   */
  async disableAdapter(adapterId: string, graceful: boolean = true): Promise<LifecycleEvent> {
    const startTime = Date.now();
    const eventId = this.generateEventId();

    try {
      this.logger.log(`Disabling adapter: ${adapterId} (graceful: ${graceful})`);

      if (graceful) {
        // Graceful shutdown
        await this.gracefulShutdownConnections(adapterId);
      } else {
        // Force shutdown
        await this.forceShutdownConnections(adapterId);
      }

      // Disable in registry
      await this.adapterRegistry.setAdapterEnabled(adapterId, false);

      const event: LifecycleEvent = {
        id: eventId,
        adapterId,
        eventType: LifecycleEventType.ADAPTER_DISABLED,
        timestamp: new Date(),
        details: { graceful },
        success: true,
        duration: Date.now() - startTime,
      };

      this.recordLifecycleEvent(event);
      this.logger.log(`Adapter disabled: ${adapterId}`);
      
      return event;

    } catch (error) {
      const event: LifecycleEvent = {
        id: eventId,
        adapterId,
        eventType: LifecycleEventType.ADAPTER_DISABLED,
        timestamp: new Date(),
        details: { graceful },
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };

      this.recordLifecycleEvent(event);
      
      this.logger.error(`Failed to disable adapter ${adapterId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gracefully shutdown adapter connections
   */
  async gracefulShutdownConnections(adapterId: string): Promise<void> {
    const adapter = this.adapterRegistry.getAdapter(adapterId);
    if (!adapter) {
      throw new Error(`Adapter not found: ${adapterId}`);
    }

    // Check if shutdown is already in progress
    if (this.shutdownPromises.has(adapterId)) {
      await this.shutdownPromises.get(adapterId);
      return;
    }

    const shutdownPromise = this.performGracefulShutdown(adapter);
    this.shutdownPromises.set(adapterId, shutdownPromise);

    try {
      await shutdownPromise;
      
      const event: LifecycleEvent = {
        id: this.generateEventId(),
        adapterId,
        eventType: LifecycleEventType.GRACEFUL_SHUTDOWN,
        timestamp: new Date(),
        details: {},
        success: true,
      };

      this.recordLifecycleEvent(event);
      
    } catch (error) {
      const event: LifecycleEvent = {
        id: this.generateEventId(),
        adapterId,
        eventType: LifecycleEventType.GRACEFUL_SHUTDOWN,
        timestamp: new Date(),
        details: {},
        success: false,
        error: error.message,
      };

      this.recordLifecycleEvent(event);
      throw error;
      
    } finally {
      this.shutdownPromises.delete(adapterId);
    }
  }

  /**
   * Force shutdown adapter connections
   */
  async forceShutdownConnections(adapterId: string): Promise<void> {
    const adapter = this.adapterRegistry.getAdapter(adapterId);
    if (!adapter) {
      throw new Error(`Adapter not found: ${adapterId}`);
    }

    try {
      // Force shutdown without waiting
      await Promise.race([
        adapter.shutdown(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Force shutdown timeout')), 5000)
        ),
      ]);

      const event: LifecycleEvent = {
        id: this.generateEventId(),
        adapterId,
        eventType: LifecycleEventType.FORCE_SHUTDOWN,
        timestamp: new Date(),
        details: {},
        success: true,
      };

      this.recordLifecycleEvent(event);
      
    } catch (error) {
      const event: LifecycleEvent = {
        id: this.generateEventId(),
        adapterId,
        eventType: LifecycleEventType.FORCE_SHUTDOWN,
        timestamp: new Date(),
        details: {},
        success: false,
        error: error.message,
      };

      this.recordLifecycleEvent(event);
      
      this.logger.warn(`Force shutdown completed with errors for adapter ${adapterId}: ${error.message}`);
    }
  }

  /**
   * Perform health check on adapter
   */
  async performHealthCheck(adapterId: string): Promise<AdapterHealth> {
    const adapter = this.adapterRegistry.getAdapter(adapterId);
    if (!adapter) {
      throw new Error(`Adapter not found: ${adapterId}`);
    }

    try {
      const health = await adapter.getHealth();
      
      const event: LifecycleEvent = {
        id: this.generateEventId(),
        adapterId,
        eventType: LifecycleEventType.HEALTH_CHECK_PASSED,
        timestamp: new Date(),
        details: {
          status: health.status,
          connectedDevices: health.connectedDevices,
          errorRate: health.errorRate,
        },
        success: true,
      };

      this.recordLifecycleEvent(event);
      
      // Check if adapter has recovered from failure
      if (this.adapterFailures.has(adapterId) && health.status === HealthStatus.HEALTHY) {
        await this.handleAdapterRecovery(adapterId);
      }
      
      return health;

    } catch (error) {
      const event: LifecycleEvent = {
        id: this.generateEventId(),
        adapterId,
        eventType: LifecycleEventType.HEALTH_CHECK_FAILED,
        timestamp: new Date(),
        details: {},
        success: false,
        error: error.message,
      };

      this.recordLifecycleEvent(event);
      this.recordAdapterFailure(adapterId, error.message);
      
      throw error;
    }
  }

  /**
   * Get adapter failure information
   */
  getAdapterFailureInfo(adapterId: string): AdapterFailureInfo | undefined {
    return this.adapterFailures.get(adapterId);
  }

  /**
   * Get lifecycle events for an adapter
   */
  getLifecycleEvents(adapterId?: string, limit?: number): LifecycleEvent[] {
    let events = this.lifecycleEvents;
    
    if (adapterId) {
      events = events.filter(event => event.adapterId === adapterId);
    }
    
    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (limit) {
      events = events.slice(0, limit);
    }
    
    return events;
  }

  /**
   * Get lifecycle statistics
   */
  getLifecycleStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    failedAdapters: number;
    isolatedAdapters: number;
    recentEvents: LifecycleEvent[];
  } {
    const eventsByType: Record<string, number> = {};
    
    this.lifecycleEvents.forEach(event => {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
    });

    const failedAdapters = Array.from(this.adapterFailures.values())
      .filter(failure => failure.isolationLevel !== IsolationLevel.NONE).length;

    const isolatedAdapters = Array.from(this.adapterFailures.values())
      .filter(failure => failure.isolationLevel === IsolationLevel.QUARANTINE || 
                        failure.isolationLevel === IsolationLevel.DISABLED).length;

    const recentEvents = this.lifecycleEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalEvents: this.lifecycleEvents.length,
      eventsByType,
      failedAdapters,
      isolatedAdapters,
      recentEvents,
    };
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async performScheduledHealthChecks(): Promise<void> {
    try {
      const enabledAdapters = this.adapterRegistry.getEnabledAdapters();
      
      for (const registration of enabledAdapters) {
        try {
          await this.performHealthCheck(registration.adapter.id);
        } catch (error) {
          this.logger.warn(`Scheduled health check failed for adapter ${registration.adapter.id}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Scheduled health check cycle failed: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async attemptAdapterRecovery(): Promise<void> {
    try {
      const now = Date.now();
      
      for (const [adapterId, failureInfo] of this.adapterFailures.entries()) {
        // Skip if recently attempted recovery
        if (failureInfo.lastRecoveryAttempt && 
            (now - failureInfo.lastRecoveryAttempt.getTime()) < this.recoveryInterval) {
          continue;
        }

        // Skip if adapter is disabled or in quarantine
        if (failureInfo.isolationLevel === IsolationLevel.DISABLED ||
            failureInfo.isolationLevel === IsolationLevel.QUARANTINE) {
          continue;
        }

        try {
          this.logger.log(`Attempting recovery for adapter: ${adapterId}`);
          
          failureInfo.lastRecoveryAttempt = new Date();
          failureInfo.recoveryAttempts++;
          
          // Try to enable the adapter
          await this.enableAdapter(adapterId);
          
        } catch (error) {
          this.logger.warn(`Recovery attempt failed for adapter ${adapterId}: ${error.message}`);
          
          // Escalate isolation level if recovery keeps failing
          if (failureInfo.recoveryAttempts >= 3) {
            failureInfo.isolationLevel = IsolationLevel.QUARANTINE;
            this.logger.warn(`Adapter ${adapterId} quarantined after ${failureInfo.recoveryAttempts} failed recovery attempts`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Recovery cycle failed: ${error.message}`);
    }
  }

  private async performGracefulShutdown(adapter: IDeviceAdapter): Promise<void> {
    const shutdownPromise = adapter.shutdown();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Graceful shutdown timeout')), this.gracefulShutdownTimeout)
    );

    await Promise.race([shutdownPromise, timeoutPromise]);
  }

  private recordAdapterFailure(adapterId: string, reason: string): void {
    const now = new Date();
    let failureInfo = this.adapterFailures.get(adapterId);

    if (!failureInfo) {
      failureInfo = {
        adapterId,
        failureCount: 0,
        lastFailure: now,
        failureReasons: [],
        isolationLevel: IsolationLevel.NONE,
        recoveryAttempts: 0,
      };
      this.adapterFailures.set(adapterId, failureInfo);
    }

    // Clean old failures outside the window
    const windowStart = now.getTime() - this.failureWindow;
    failureInfo.failureReasons = failureInfo.failureReasons.filter(
      (_, index) => failureInfo!.lastFailure.getTime() - (index * 60000) > windowStart
    );

    failureInfo.failureCount++;
    failureInfo.lastFailure = now;
    failureInfo.failureReasons.unshift(reason);

    // Determine isolation level
    if (failureInfo.failureCount >= this.maxFailureCount) {
      failureInfo.isolationLevel = IsolationLevel.QUARANTINE;
      this.logger.warn(`Adapter ${adapterId} quarantined due to ${failureInfo.failureCount} failures`);
    } else if (failureInfo.failureCount >= Math.floor(this.maxFailureCount / 2)) {
      failureInfo.isolationLevel = IsolationLevel.WARNING;
    }

    const event: LifecycleEvent = {
      id: this.generateEventId(),
      adapterId,
      eventType: LifecycleEventType.ADAPTER_FAILED,
      timestamp: now,
      details: {
        reason,
        failureCount: failureInfo.failureCount,
        isolationLevel: failureInfo.isolationLevel,
      },
      success: false,
      error: reason,
    };

    this.recordLifecycleEvent(event);
  }

  private async handleAdapterRecovery(adapterId: string): Promise<void> {
    const failureInfo = this.adapterFailures.get(adapterId);
    if (!failureInfo) {
      return;
    }

    // Clear failure info
    this.adapterFailures.delete(adapterId);

    const event: LifecycleEvent = {
      id: this.generateEventId(),
      adapterId,
      eventType: LifecycleEventType.ADAPTER_RECOVERED,
      timestamp: new Date(),
      details: {
        previousFailureCount: failureInfo.failureCount,
        recoveryAttempts: failureInfo.recoveryAttempts,
      },
      success: true,
    };

    this.recordLifecycleEvent(event);
    this.logger.log(`Adapter recovered: ${adapterId}`);
  }

  private recordLifecycleEvent(event: LifecycleEvent): void {
    this.lifecycleEvents.push(event);
    
    // Keep only recent events (last 1000)
    if (this.lifecycleEvents.length > 1000) {
      this.lifecycleEvents.shift();
    }
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}