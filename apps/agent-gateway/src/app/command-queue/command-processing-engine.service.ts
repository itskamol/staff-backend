import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommandQueueInfrastructureService, QueuedCommand, CommandStatus } from './command-queue-infrastructure.service';
import { CommandValidationService } from './command-validation.service';
import { CommandExecutorService } from './command-executor.service';

export interface ProcessingResult {
  commandId: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
}

export interface ProcessingStats {
  commandsProcessed: number;
  successfulCommands: number;
  failedCommands: number;
  averageExecutionTime: number;
  processingRate: number; // commands per minute
  lastProcessedAt?: Date;
}

@Injectable()
export class CommandProcessingEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommandProcessingEngineService.name);
  private readonly maxConcurrentCommands: number;
  private readonly processingInterval: number;
  private readonly retryDelayBase: number;
  private readonly maxRetryDelay: number;
  
  private processingTimer: NodeJS.Timeout | null = null;
  private readonly executingCommands = new Set<string>();
  private readonly processingStats: ProcessingStats = {
    commandsProcessed: 0,
    successfulCommands: 0,
    failedCommands: 0,
    averageExecutionTime: 0,
    processingRate: 0,
  };
  
  private readonly executionTimes: number[] = [];
  private readonly maxExecutionTimesSample = 100;

  constructor(
    private readonly config: ConfigService,
    private readonly queueInfrastructure: CommandQueueInfrastructureService,
    private readonly commandValidation: CommandValidationService,
    private readonly commandExecutor: CommandExecutorService,
  ) {
    this.maxConcurrentCommands = parseInt(this.config.get('COMMAND_MAX_CONCURRENT', '10'));
    this.processingInterval = parseInt(this.config.get('COMMAND_PROCESSING_INTERVAL', '5000')); // 5 seconds
    this.retryDelayBase = parseInt(this.config.get('COMMAND_RETRY_DELAY_BASE', '1000')); // 1 second
    this.maxRetryDelay = parseInt(this.config.get('COMMAND_MAX_RETRY_DELAY', '300000')); // 5 minutes
  }

  async onModuleInit(): Promise<void> {
    this.startProcessing();
    this.logger.log('Command Processing Engine initialized');
  }

  async onModuleDestroy(): Promise<void> {
    this.stopProcessing();
    
    // Wait for executing commands to complete
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.executingCommands.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    this.logger.log('Command Processing Engine stopped');
  }

  private startProcessing(): void {
    if (this.processingTimer) {
      return; // Already started
    }

    this.processingTimer = setInterval(() => {
      this.processCommands().catch(error => {
        this.logger.error(`Command processing failed: ${error.message}`);
      });
    }, this.processingInterval);

    this.logger.log(`Command processing started with ${this.processingInterval}ms interval`);
  }

  private stopProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
      this.logger.log('Command processing stopped');
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processCommands(): Promise<void> {
    try {
      // Check if we can process more commands
      if (this.executingCommands.size >= this.maxConcurrentCommands) {
        this.logger.debug(`Max concurrent commands reached (${this.maxConcurrentCommands})`);
        return;
      }

      // Get ready commands
      const availableSlots = this.maxConcurrentCommands - this.executingCommands.size;
      const readyCommands = await this.queueInfrastructure.getReadyCommands(availableSlots);

      if (readyCommands.length === 0) {
        return; // No commands to process
      }

      this.logger.debug(`Processing ${readyCommands.length} commands`);

      // Process commands concurrently
      const processingPromises = readyCommands.map(command => 
        this.processCommand(command).catch(error => {
          this.logger.error(`Failed to process command ${command.id}: ${error.message}`);
          return {
            commandId: command.id,
            success: false,
            error: error.message,
            executionTime: 0,
          };
        })
      );

      const results = await Promise.allSettled(processingPromises);
      
      // Update processing stats
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          this.updateProcessingStats(result.value);
        }
      });

    } catch (error) {
      this.logger.error(`Command processing cycle failed: ${error.message}`);
    }
  }

  private async processCommand(command: QueuedCommand): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Mark command as executing
      this.executingCommands.add(command.id);
      await this.queueInfrastructure.updateCommandStatus(
        command.id, 
        CommandStatus.EXECUTING,
        { executedAt: new Date() }
      );

      this.logger.debug(`Executing command: ${command.id} (${command.type})`);

      // Validate command
      const validationResult = await this.commandValidation.validateCommand(command);
      if (!validationResult.valid) {
        throw new Error(`Command validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Execute command
      const executionResult = await this.commandExecutor.executeCommand(command);
      
      const executionTime = Date.now() - startTime;

      if (executionResult.success) {
        // Mark as completed
        await this.queueInfrastructure.updateCommandStatus(
          command.id,
          CommandStatus.COMPLETED,
          {
            completedAt: new Date(),
            result: executionResult.result,
          }
        );

        this.logger.debug(`Command completed: ${command.id} in ${executionTime}ms`);
        
        return {
          commandId: command.id,
          success: true,
          result: executionResult.result,
          executionTime,
        };
      } else {
        // Handle failure
        return await this.handleCommandFailure(command, executionResult.error || 'Unknown error', executionTime);
      }

    } catch (error) {
      const executionTime = Date.now() - startTime;
      return await this.handleCommandFailure(command, error.message, executionTime);
      
    } finally {
      this.executingCommands.delete(command.id);
    }
  }

  private async handleCommandFailure(
    command: QueuedCommand, 
    error: string, 
    executionTime: number
  ): Promise<ProcessingResult> {
    const newRetryCount = command.retryCount + 1;

    if (newRetryCount <= command.maxRetries) {
      // Schedule retry with exponential backoff
      const retryDelay = Math.min(
        this.retryDelayBase * Math.pow(2, command.retryCount),
        this.maxRetryDelay
      );
      
      const retryAt = new Date(Date.now() + retryDelay);
      
      await this.queueInfrastructure.scheduleCommandRetry(command.id, retryAt);
      await this.queueInfrastructure.updateCommandStatus(
        command.id,
        CommandStatus.SCHEDULED,
        {
          lastError: error,
          retryCount: newRetryCount,
        }
      );

      this.logger.warn(`Command ${command.id} failed, retry ${newRetryCount}/${command.maxRetries} scheduled in ${retryDelay}ms: ${error}`);
      
      return {
        commandId: command.id,
        success: false,
        error: `Retry ${newRetryCount}/${command.maxRetries}: ${error}`,
        executionTime,
      };
    } else {
      // Mark as permanently failed
      await this.queueInfrastructure.updateCommandStatus(
        command.id,
        CommandStatus.FAILED,
        {
          completedAt: new Date(),
          lastError: error,
          retryCount: newRetryCount,
        }
      );

      this.logger.error(`Command ${command.id} failed permanently after ${command.maxRetries} retries: ${error}`);
      
      return {
        commandId: command.id,
        success: false,
        error: `Failed after ${command.maxRetries} retries: ${error}`,
        executionTime,
      };
    }
  }

  private updateProcessingStats(result: ProcessingResult): void {
    this.processingStats.commandsProcessed++;
    this.processingStats.lastProcessedAt = new Date();

    if (result.success) {
      this.processingStats.successfulCommands++;
    } else {
      this.processingStats.failedCommands++;
    }

    // Update execution time statistics
    this.executionTimes.push(result.executionTime);
    if (this.executionTimes.length > this.maxExecutionTimesSample) {
      this.executionTimes.shift();
    }

    this.processingStats.averageExecutionTime = 
      this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length;

    // Calculate processing rate (commands per minute)
    const totalCommands = this.processingStats.commandsProcessed;
    if (totalCommands > 0 && this.processingStats.lastProcessedAt) {
      // This is a simplified calculation - in production, you'd want a sliding window
      this.processingStats.processingRate = totalCommands; // Placeholder calculation
    }
  }

  async pauseProcessing(): Promise<void> {
    this.stopProcessing();
    this.logger.log('Command processing paused');
  }

  async resumeProcessing(): Promise<void> {
    this.startProcessing();
    this.logger.log('Command processing resumed');
  }

  async forceProcessCommand(commandId: string): Promise<ProcessingResult> {
    const command = await this.queueInfrastructure.getCommand(commandId);
    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }

    if (this.executingCommands.has(commandId)) {
      throw new Error(`Command ${commandId} is already executing`);
    }

    if (command.status === CommandStatus.COMPLETED) {
      throw new Error(`Command ${commandId} is already completed`);
    }

    this.logger.log(`Force processing command: ${commandId}`);
    return await this.processCommand(command);
  }

  async retryFailedCommand(commandId: string): Promise<ProcessingResult> {
    const command = await this.queueInfrastructure.getCommand(commandId);
    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }

    if (command.status !== CommandStatus.FAILED) {
      throw new Error(`Command ${commandId} is not in failed status`);
    }

    // Reset retry count and mark as pending
    await this.queueInfrastructure.updateCommandStatus(
      commandId,
      CommandStatus.PENDING,
      {
        retryCount: 0,
        lastError: undefined,
      }
    );

    this.logger.log(`Retrying failed command: ${commandId}`);
    return await this.processCommand(command);
  }

  getProcessingStats(): ProcessingStats {
    return { ...this.processingStats };
  }

  getExecutingCommands(): string[] {
    return Array.from(this.executingCommands);
  }

  async getProcessingHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: {
      executingCommands: number;
      maxConcurrentCommands: number;
      processingRate: number;
      successRate: number;
      averageExecutionTime: number;
    };
  }> {
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    const queueStats = await this.queueInfrastructure.getQueueStats();
    const successRate = queueStats.successRate;
    const executingCount = this.executingCommands.size;

    // Check success rate
    if (successRate < 50) {
      status = 'critical';
      issues.push(`Low success rate: ${successRate.toFixed(1)}%`);
    } else if (successRate < 80) {
      status = 'warning';
      issues.push(`Moderate success rate: ${successRate.toFixed(1)}%`);
    }

    // Check execution capacity
    const capacityUsage = (executingCount / this.maxConcurrentCommands) * 100;
    if (capacityUsage > 90) {
      status = 'critical';
      issues.push(`High capacity usage: ${capacityUsage.toFixed(1)}%`);
    } else if (capacityUsage > 70) {
      if (status !== 'critical') status = 'warning';
      issues.push(`Moderate capacity usage: ${capacityUsage.toFixed(1)}%`);
    }

    // Check average execution time
    if (this.processingStats.averageExecutionTime > 30000) { // 30 seconds
      status = 'critical';
      issues.push(`High average execution time: ${this.processingStats.averageExecutionTime.toFixed(0)}ms`);
    } else if (this.processingStats.averageExecutionTime > 10000) { // 10 seconds
      if (status !== 'critical') status = 'warning';
      issues.push(`Elevated execution time: ${this.processingStats.averageExecutionTime.toFixed(0)}ms`);
    }

    // Check for stalled processing
    if (this.processingStats.lastProcessedAt) {
      const timeSinceLastProcessing = Date.now() - this.processingStats.lastProcessedAt.getTime();
      if (timeSinceLastProcessing > 300000) { // 5 minutes
        status = 'critical';
        issues.push(`No commands processed in ${Math.round(timeSinceLastProcessing / 60000)} minutes`);
      }
    }

    return {
      status,
      issues,
      metrics: {
        executingCommands: executingCount,
        maxConcurrentCommands: this.maxConcurrentCommands,
        processingRate: this.processingStats.processingRate,
        successRate,
        averageExecutionTime: this.processingStats.averageExecutionTime,
      },
    };
  }

  async adjustConcurrency(newMaxConcurrent: number): Promise<void> {
    if (newMaxConcurrent < 1 || newMaxConcurrent > 100) {
      throw new Error('Max concurrent commands must be between 1 and 100');
    }

    const oldMax = this.maxConcurrentCommands;
    (this as any).maxConcurrentCommands = newMaxConcurrent;

    this.logger.log(`Adjusted max concurrent commands: ${oldMax} -> ${newMaxConcurrent}`);
  }

  async getCommandProcessingHistory(limit: number = 100): Promise<{
    commandId: string;
    type: string;
    status: CommandStatus;
    executionTime?: number;
    completedAt?: Date;
    error?: string;
  }[]} {
    const recentCommands = await this.queueInfrastructure.getCommandsByStatus(CommandStatus.COMPLETED, limit);
    const failedCommands = await this.queueInfrastructure.getCommandsByStatus(CommandStatus.FAILED, limit);
    
    const allCommands = [...recentCommands, ...failedCommands]
      .sort((a, b) => {
        const aTime = a.completedAt || a.createdAt;
        const bTime = b.completedAt || b.createdAt;
        return bTime.getTime() - aTime.getTime();
      })
      .slice(0, limit);

    return allCommands.map(cmd => ({
      commandId: cmd.id,
      type: cmd.type,
      status: cmd.status,
      executionTime: cmd.executedAt && cmd.completedAt 
        ? cmd.completedAt.getTime() - cmd.executedAt.getTime()
        : undefined,
      completedAt: cmd.completedAt,
      error: cmd.lastError,
    }));
  }

  resetProcessingStats(): void {
    this.processingStats.commandsProcessed = 0;
    this.processingStats.successfulCommands = 0;
    this.processingStats.failedCommands = 0;
    this.processingStats.averageExecutionTime = 0;
    this.processingStats.processingRate = 0;
    this.processingStats.lastProcessedAt = undefined;
    
    this.executionTimes.length = 0;
    
    this.logger.log('Processing stats reset');
  }
}