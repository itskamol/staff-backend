import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommandQueueInfrastructureService } from '../command-queue/command-queue-infrastructure.service';
import { PolicyDistributionService } from '../policy/policy-distribution.service';

export interface RestartRequest {
  id: string;
  agentId: string;
  organizationId: number;
  reason: string;
  requestedBy: string;
  requestedAt: Date;
  scheduledAt?: Date;
  status: RestartStatus;
  restartType: 'graceful' | 'forced' | 'hot_reload';
  preRestartChecks: PreRestartCheck[];
  executedAt?: Date;
  completedAt?: Date;
  verificationResult?: RestartVerification;
  rollbackPlan?: RollbackPlan;
  metadata: Record<string, any>;
}

export enum RestartStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  PRE_CHECK_RUNNING = 'pre_check_running',
  PRE_CHECK_FAILED = 'pre_check_failed',
  EXECUTING = 'executing',
  VERIFYING = 'verifying',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
  CANCELLED = 'cancelled',
}

export interface PreRestartCheck {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  executedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  critical: boolean; // If true, failure blocks restart
}

export interface RestartVerification {
  agentResponsive: boolean;
  servicesRunning: boolean;
  configurationApplied: boolean;
  performanceBaseline: boolean;
  healthChecksPassed: boolean;
  verificationTime: number; // milliseconds
  issues: string[];
}

export interface RollbackPlan {
  enabled: boolean;
  steps: RollbackStep[];
  triggerConditions: string[];
  maxRollbackTime: number; // milliseconds
}

export interface RollbackStep {
  step: number;
  action: string;
  description: string;
  timeout: number;
  critical: boolean;
}

export interface HotReloadCapability {
  agentId: string;
  supportedComponents: string[];
  lastChecked: Date;
  capabilities: {
    policyReload: boolean;
    configurationReload: boolean;
    moduleReload: boolean;
    serviceReload: boolean;
  };
}

@Injectable()
export class AgentRestartService {
  private readonly logger = new Logger(AgentRestartService.name);
  private readonly restartRequests = new Map<string, RestartRequest>();
  private readonly hotReloadCapabilities = new Map<string, HotReloadCapability>();
  private readonly activeRestarts = new Set<string>();
  
  private readonly defaultPreChecks: Omit<PreRestartCheck, 'id' | 'status' | 'executedAt' | 'completedAt' | 'result' | 'error'>[] = [
    {
      name: 'agent_health_check',
      description: 'Verify agent is responsive and healthy',
      critical: true,
    },
    {
      name: 'active_sessions_check',
      description: 'Check for active user sessions',
      critical: false,
    },
    {
      name: 'data_sync_check',
      description: 'Ensure all data is synchronized',
      critical: true,
    },
    {
      name: 'backup_verification',
      description: 'Verify configuration backup exists',
      critical: true,
    },
    {
      name: 'resource_availability',
      description: 'Check system resources availability',
      critical: false,
    },
  ];

  constructor(
    private readonly config: ConfigService,
    private readonly commandQueue: CommandQueueInfrastructureService,
    private readonly policyDistribution: PolicyDistributionService,
  ) {}

  async requestAgentRestart(request: {
    agentId: string;
    organizationId: number;
    reason: string;
    requestedBy: string;
    restartType?: 'graceful' | 'forced' | 'hot_reload';
    scheduledAt?: Date;
    skipPreChecks?: boolean;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const requestId = this.generateRequestId();
    
    // Check if hot reload is possible
    if (request.restartType === 'hot_reload') {
      const canHotReload = await this.canPerformHotReload(request.agentId, request.reason);
      if (!canHotReload) {
        throw new Error(`Hot reload not supported for agent ${request.agentId} with reason: ${request.reason}`);
      }
    }

    const restartRequest: RestartRequest = {
      id: requestId,
      agentId: request.agentId,
      organizationId: request.organizationId,
      reason: request.reason,
      requestedBy: request.requestedBy,
      requestedAt: new Date(),
      scheduledAt: request.scheduledAt,
      status: request.scheduledAt ? RestartStatus.SCHEDULED : RestartStatus.PENDING,
      restartType: request.restartType || 'graceful',
      preRestartChecks: request.skipPreChecks ? [] : this.createPreRestartChecks(),
      rollbackPlan: this.createRollbackPlan(request.restartType || 'graceful'),
      metadata: request.metadata || {},
    };

    this.restartRequests.set(requestId, restartRequest);
    
    this.logger.log(`Agent restart requested: ${requestId} for agent ${request.agentId} (${request.restartType})`);
    
    // Start processing if not scheduled
    if (!request.scheduledAt) {
      this.processRestartRequest(requestId).catch(error => {
        this.logger.error(`Failed to process restart request ${requestId}: ${error.message}`);
      });
    }

    return requestId;
  }

  async canPerformHotReload(agentId: string, reason: string): Promise<boolean> {
    const capabilities = this.hotReloadCapabilities.get(agentId);
    if (!capabilities) {
      // Query agent for capabilities
      await this.queryAgentCapabilities(agentId);
      return this.hotReloadCapabilities.has(agentId);
    }

    // Check if the reason requires components that support hot reload
    if (reason.includes('policy')) {
      return capabilities.capabilities.policyReload;
    }
    
    if (reason.includes('configuration')) {
      return capabilities.capabilities.configurationReload;
    }
    
    if (reason.includes('module')) {
      return capabilities.capabilities.moduleReload;
    }
    
    if (reason.includes('service')) {
      return capabilities.capabilities.serviceReload;
    }

    // Default to false for unknown reasons
    return false;
  }

  private async queryAgentCapabilities(agentId: string): Promise<void> {
    try {
      const commandId = await this.commandQueue.queueCommand({
        type: 'query_capabilities',
        targetAgentId: agentId,
        payload: {
          query: 'hot_reload_capabilities',
        },
        priority: 2,
        maxRetries: 2,
      });

      // In a real implementation, you'd wait for the response
      // For now, we'll create mock capabilities
      const mockCapabilities: HotReloadCapability = {
        agentId,
        supportedComponents: ['policy', 'configuration'],
        lastChecked: new Date(),
        capabilities: {
          policyReload: true,
          configurationReload: true,
          moduleReload: false,
          serviceReload: false,
        },
      };

      this.hotReloadCapabilities.set(agentId, mockCapabilities);
      this.logger.debug(`Agent capabilities queried: ${agentId}`);
      
    } catch (error) {
      this.logger.error(`Failed to query agent capabilities for ${agentId}: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processScheduledRestarts(): Promise<void> {
    try {
      const now = new Date();
      const scheduledRequests = Array.from(this.restartRequests.values())
        .filter(request => 
          request.status === RestartStatus.SCHEDULED &&
          request.scheduledAt &&
          request.scheduledAt <= now
        );

      for (const request of scheduledRequests) {
        if (!this.activeRestarts.has(request.id)) {
          this.processRestartRequest(request.id).catch(error => {
            this.logger.error(`Failed to process scheduled restart ${request.id}: ${error.message}`);
          });
        }
      }
    } catch (error) {
      this.logger.error(`Scheduled restart processing failed: ${error.message}`);
    }
  }

  private async processRestartRequest(requestId: string): Promise<void> {
    const request = this.restartRequests.get(requestId);
    if (!request) {
      this.logger.warn(`Restart request not found: ${requestId}`);
      return;
    }

    if (this.activeRestarts.has(requestId)) {
      return; // Already processing
    }

    this.activeRestarts.add(requestId);

    try {
      this.logger.log(`Processing restart request: ${requestId} for agent ${request.agentId}`);

      // Step 1: Run pre-restart checks
      if (request.preRestartChecks.length > 0) {
        request.status = RestartStatus.PRE_CHECK_RUNNING;
        const preChecksPassed = await this.runPreRestartChecks(request);
        
        if (!preChecksPassed) {
          request.status = RestartStatus.PRE_CHECK_FAILED;
          this.logger.error(`Pre-restart checks failed for request ${requestId}`);
          return;
        }
      }

      // Step 2: Execute restart
      request.status = RestartStatus.EXECUTING;
      request.executedAt = new Date();
      
      const restartSuccess = await this.executeRestart(request);
      
      if (!restartSuccess) {
        request.status = RestartStatus.FAILED;
        await this.handleRestartFailure(request);
        return;
      }

      // Step 3: Verify restart
      request.status = RestartStatus.VERIFYING;
      const verificationResult = await this.verifyRestart(request);
      request.verificationResult = verificationResult;

      if (verificationResult.agentResponsive && verificationResult.healthChecksPassed) {
        request.status = RestartStatus.COMPLETED;
        request.completedAt = new Date();
        
        const duration = request.completedAt.getTime() - (request.executedAt?.getTime() || 0);
        this.logger.log(`Agent restart completed: ${requestId} in ${duration}ms`);
      } else {
        request.status = RestartStatus.FAILED;
        await this.handleRestartFailure(request);
      }

    } catch (error) {
      request.status = RestartStatus.FAILED;
      this.logger.error(`Restart request ${requestId} failed: ${error.message}`);
      await this.handleRestartFailure(request);
      
    } finally {
      this.activeRestarts.delete(requestId);
    }
  }

  private async runPreRestartChecks(request: RestartRequest): Promise<boolean> {
    let allCriticalChecksPassed = true;

    for (const check of request.preRestartChecks) {
      check.status = 'running';
      check.executedAt = new Date();

      try {
        const result = await this.executePreRestartCheck(request.agentId, check);
        
        check.status = result.success ? 'passed' : 'failed';
        check.result = result.data;
        check.error = result.error;
        check.completedAt = new Date();

        if (!result.success && check.critical) {
          allCriticalChecksPassed = false;
          this.logger.warn(`Critical pre-restart check failed: ${check.name} for agent ${request.agentId}`);
        }

      } catch (error) {
        check.status = 'failed';
        check.error = error.message;
        check.completedAt = new Date();

        if (check.critical) {
          allCriticalChecksPassed = false;
        }

        this.logger.error(`Pre-restart check ${check.name} failed for agent ${request.agentId}: ${error.message}`);
      }
    }

    return allCriticalChecksPassed;
  }

  private async executePreRestartCheck(agentId: string, check: PreRestartCheck): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    switch (check.name) {
      case 'agent_health_check':
        return await this.checkAgentHealth(agentId);
      
      case 'active_sessions_check':
        return await this.checkActiveSessions(agentId);
      
      case 'data_sync_check':
        return await this.checkDataSync(agentId);
      
      case 'backup_verification':
        return await this.verifyBackup(agentId);
      
      case 'resource_availability':
        return await this.checkResourceAvailability(agentId);
      
      default:
        return { success: true, data: { skipped: true } };
    }
  }

  private async checkAgentHealth(agentId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const commandId = await this.commandQueue.queueCommand({
        type: 'health_check',
        targetAgentId: agentId,
        payload: { comprehensive: true },
        priority: 1,
        maxRetries: 1,
      });

      // Mock health check result
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        data: {
          responsive: true,
          cpuUsage: 45.2,
          memoryUsage: 67.8,
          diskUsage: 23.1,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async checkActiveSessions(agentId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Mock active sessions check
      const activeSessions = Math.floor(Math.random() * 3); // 0-2 active sessions
      
      return {
        success: true,
        data: {
          activeSessions,
          canRestart: activeSessions === 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async checkDataSync(agentId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Mock data sync check
      const syncStatus = Math.random() > 0.1; // 90% chance of being synced
      
      return {
        success: syncStatus,
        data: {
          synced: syncStatus,
          lastSyncAt: new Date(),
          pendingRecords: syncStatus ? 0 : Math.floor(Math.random() * 100),
        },
        error: syncStatus ? undefined : 'Data sync pending',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async verifyBackup(agentId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Mock backup verification
      const backupExists = Math.random() > 0.05; // 95% chance backup exists
      
      return {
        success: backupExists,
        data: {
          backupExists,
          backupTimestamp: backupExists ? new Date() : undefined,
          backupSize: backupExists ? Math.floor(Math.random() * 1000000) : 0,
        },
        error: backupExists ? undefined : 'No recent backup found',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async checkResourceAvailability(agentId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Mock resource availability check
      const cpuAvailable = Math.random() * 100;
      const memoryAvailable = Math.random() * 100;
      const diskAvailable = Math.random() * 100;
      
      const resourcesOk = cpuAvailable < 80 && memoryAvailable < 85 && diskAvailable < 90;
      
      return {
        success: resourcesOk,
        data: {
          cpu: cpuAvailable,
          memory: memoryAvailable,
          disk: diskAvailable,
        },
        error: resourcesOk ? undefined : 'High resource usage detected',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async executeRestart(request: RestartRequest): Promise<boolean> {
    try {
      let commandType: string;
      let payload: any = {
        reason: request.reason,
        requestId: request.id,
        restartType: request.restartType,
      };

      switch (request.restartType) {
        case 'hot_reload':
          commandType = 'hot_reload';
          payload.components = this.determineReloadComponents(request.reason);
          break;
        
        case 'graceful':
          commandType = 'graceful_restart';
          payload.gracePeriod = 30000; // 30 seconds
          break;
        
        case 'forced':
          commandType = 'forced_restart';
          payload.timeout = 10000; // 10 seconds
          break;
        
        default:
          throw new Error(`Unknown restart type: ${request.restartType}`);
      }

      const commandId = await this.commandQueue.queueCommand({
        type: commandType,
        targetAgentId: request.agentId,
        payload,
        priority: 1,
        maxRetries: request.restartType === 'forced' ? 1 : 3,
      });

      this.logger.debug(`Restart command queued: ${commandId} for agent ${request.agentId}`);
      
      // Wait for command execution (mock)
      const executionTime = request.restartType === 'hot_reload' ? 5000 : 15000;
      await new Promise(resolve => setTimeout(resolve, executionTime));
      
      return true;

    } catch (error) {
      this.logger.error(`Failed to execute restart for agent ${request.agentId}: ${error.message}`);
      return false;
    }
  }

  private determineReloadComponents(reason: string): string[] {
    const components: string[] = [];
    
    if (reason.includes('policy')) {
      components.push('policy_engine');
    }
    
    if (reason.includes('configuration')) {
      components.push('configuration_manager');
    }
    
    if (reason.includes('module')) {
      components.push('module_loader');
    }
    
    if (reason.includes('service')) {
      components.push('service_manager');
    }

    return components.length > 0 ? components : ['policy_engine']; // Default to policy
  }

  private async verifyRestart(request: RestartRequest): Promise<RestartVerification> {
    const startTime = Date.now();
    
    try {
      // Wait for agent to come back online
      await this.waitForAgentResponse(request.agentId, 60000); // 60 seconds timeout
      
      // Run verification checks
      const [healthCheck, configCheck, performanceCheck] = await Promise.allSettled([
        this.verifyAgentHealth(request.agentId),
        this.verifyConfigurationApplied(request.agentId),
        this.verifyPerformanceBaseline(request.agentId),
      ]);

      const verification: RestartVerification = {
        agentResponsive: true,
        servicesRunning: healthCheck.status === 'fulfilled' && healthCheck.value,
        configurationApplied: configCheck.status === 'fulfilled' && configCheck.value,
        performanceBaseline: performanceCheck.status === 'fulfilled' && performanceCheck.value,
        healthChecksPassed: false,
        verificationTime: Date.now() - startTime,
        issues: [],
      };

      // Collect issues
      if (!verification.servicesRunning) {
        verification.issues.push('Services not running properly');
      }
      
      if (!verification.configurationApplied) {
        verification.issues.push('Configuration not applied correctly');
      }
      
      if (!verification.performanceBaseline) {
        verification.issues.push('Performance baseline not met');
      }

      verification.healthChecksPassed = verification.servicesRunning && 
                                       verification.configurationApplied && 
                                       verification.performanceBaseline;

      return verification;

    } catch (error) {
      return {
        agentResponsive: false,
        servicesRunning: false,
        configurationApplied: false,
        performanceBaseline: false,
        healthChecksPassed: false,
        verificationTime: Date.now() - startTime,
        issues: [`Verification failed: ${error.message}`],
      };
    }
  }

  private async waitForAgentResponse(agentId: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 2000; // 2 seconds
    
    while (Date.now() - startTime < timeout) {
      try {
        const commandId = await this.commandQueue.queueCommand({
          type: 'ping',
          targetAgentId: agentId,
          payload: { timestamp: Date.now() },
          priority: 1,
          maxRetries: 1,
        });

        // Mock response check
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Assume agent responded
        return;
        
      } catch (error) {
        // Agent not responding yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }
    
    throw new Error(`Agent ${agentId} did not respond within ${timeout}ms`);
  }

  private async verifyAgentHealth(agentId: string): Promise<boolean> {
    try {
      const healthResult = await this.checkAgentHealth(agentId);
      return healthResult.success;
    } catch (error) {
      return false;
    }
  }

  private async verifyConfigurationApplied(agentId: string): Promise<boolean> {
    try {
      // Mock configuration verification
      return Math.random() > 0.1; // 90% success rate
    } catch (error) {
      return false;
    }
  }

  private async verifyPerformanceBaseline(agentId: string): Promise<boolean> {
    try {
      // Mock performance verification
      return Math.random() > 0.05; // 95% success rate
    } catch (error) {
      return false;
    }
  }

  private async handleRestartFailure(request: RestartRequest): Promise<void> {
    this.logger.error(`Restart failed for agent ${request.agentId}, request ${request.id}`);
    
    if (request.rollbackPlan?.enabled) {
      try {
        await this.executeRollback(request);
        request.status = RestartStatus.ROLLED_BACK;
        this.logger.log(`Rollback completed for failed restart ${request.id}`);
      } catch (rollbackError) {
        this.logger.error(`Rollback failed for restart ${request.id}: ${rollbackError.message}`);
      }
    }
  }

  private async executeRollback(request: RestartRequest): Promise<void> {
    if (!request.rollbackPlan) {
      throw new Error('No rollback plan available');
    }

    for (const step of request.rollbackPlan.steps) {
      try {
        this.logger.debug(`Executing rollback step ${step.step}: ${step.action}`);
        
        // Mock rollback step execution
        await new Promise(resolve => setTimeout(resolve, step.timeout));
        
      } catch (error) {
        if (step.critical) {
          throw new Error(`Critical rollback step ${step.step} failed: ${error.message}`);
        } else {
          this.logger.warn(`Non-critical rollback step ${step.step} failed: ${error.message}`);
        }
      }
    }
  }

  private createPreRestartChecks(): PreRestartCheck[] {
    return this.defaultPreChecks.map((check, index) => ({
      id: `check_${index + 1}`,
      ...check,
      status: 'pending',
    }));
  }

  private createRollbackPlan(restartType: RestartRequest['restartType']): RollbackPlan {
    const steps: RollbackStep[] = [
      {
        step: 1,
        action: 'Stop failed process',
        description: 'Terminate any hanging processes',
        timeout: 5000,
        critical: true,
      },
      {
        step: 2,
        action: 'Restore configuration',
        description: 'Restore previous configuration from backup',
        timeout: 10000,
        critical: true,
      },
      {
        step: 3,
        action: 'Restart services',
        description: 'Restart agent services with previous configuration',
        timeout: 15000,
        critical: true,
      },
      {
        step: 4,
        action: 'Verify rollback',
        description: 'Verify agent is functioning with previous configuration',
        timeout: 10000,
        critical: false,
      },
    ];

    return {
      enabled: restartType !== 'forced', // No rollback for forced restarts
      steps,
      triggerConditions: [
        'agent_unresponsive',
        'services_failed',
        'configuration_invalid',
        'performance_degraded',
      ],
      maxRollbackTime: 60000, // 1 minute
    };
  }

  async getRestartRequest(requestId: string): Promise<RestartRequest | undefined> {
    return this.restartRequests.get(requestId);
  }

  async cancelRestartRequest(requestId: string): Promise<boolean> {
    const request = this.restartRequests.get(requestId);
    if (!request) {
      return false;
    }

    if (request.status === RestartStatus.EXECUTING || request.status === RestartStatus.VERIFYING) {
      return false; // Cannot cancel during execution
    }

    request.status = RestartStatus.CANCELLED;
    this.logger.log(`Restart request cancelled: ${requestId}`);
    return true;
  }

  async getActiveRestarts(): Promise<RestartRequest[]> {
    return Array.from(this.restartRequests.values())
      .filter(request => 
        request.status === RestartStatus.EXECUTING || 
        request.status === RestartStatus.VERIFYING ||
        request.status === RestartStatus.PRE_CHECK_RUNNING
      );
  }

  async getRestartHistory(agentId?: string, limit?: number): Promise<RestartRequest[]> {
    let requests = Array.from(this.restartRequests.values());

    if (agentId) {
      requests = requests.filter(request => request.agentId === agentId);
    }

    requests.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());

    if (limit) {
      requests = requests.slice(0, limit);
    }

    return requests;
  }

  private generateRequestId(): string {
    return `restart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}