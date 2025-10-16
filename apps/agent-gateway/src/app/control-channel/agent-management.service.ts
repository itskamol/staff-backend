import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebSocketClientService } from './websocket-client.service';
import { CommandQueueService } from './command-queue.service';

export interface AgentInfo {
  id: string;
  organizationId: number;
  hostname: string;
  ipAddress: string;
  version: string;
  platform: string;
  lastSeen: Date;
  status: 'online' | 'offline' | 'unknown';
  capabilities: string[];
  metadata: Record<string, any>;
}

export interface AgentCommand {
  commandId: string;
  agentId: string;
  type: string;
  data: any;
  status: 'pending' | 'sent' | 'acknowledged' | 'completed' | 'failed';
  createdAt: Date;
  sentAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

@Injectable()
export class AgentManagementService {
  private readonly logger = new Logger(AgentManagementService.name);
  private readonly agents = new Map<string, AgentInfo>();
  private readonly agentCommands = new Map<string, AgentCommand>();

  constructor(
    private readonly config: ConfigService,
    private readonly webSocketClient: WebSocketClientService,
    private readonly commandQueue: CommandQueueService,
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen for WebSocket messages
    this.webSocketClient.on('agent_update', (message) => {
      this.handleAgentUpdate(message);
    });

    this.webSocketClient.on('command_response', (message) => {
      this.handleCommandResponse(message);
    });
  }

  private handleAgentUpdate(message: any): void {
    try {
      const agentData = message.data;
      
      const agent: AgentInfo = {
        id: agentData.agentId,
        organizationId: agentData.organizationId,
        hostname: agentData.hostname,
        ipAddress: agentData.ipAddress,
        version: agentData.version,
        platform: agentData.platform,
        lastSeen: new Date(),
        status: agentData.status || 'online',
        capabilities: agentData.capabilities || [],
        metadata: agentData.metadata || {},
      };

      this.agents.set(agent.id, agent);
      this.logger.debug(`Agent updated: ${agent.id}`);
      
    } catch (error) {
      this.logger.error(`Failed to handle agent update: ${error.message}`);
    }
  }

  private handleCommandResponse(message: any): void {
    try {
      const response = message.data;
      const command = this.agentCommands.get(response.commandId);
      
      if (!command) {
        this.logger.warn(`Received response for unknown command: ${response.commandId}`);
        return;
      }

      command.status = response.success ? 'completed' : 'failed';
      command.completedAt = new Date();
      command.result = response.result;
      command.error = response.error;

      this.logger.debug(`Command ${response.commandId} ${command.status}`);
      
    } catch (error) {
      this.logger.error(`Failed to handle command response: ${error.message}`);
    }
  }

  async sendCommandToAgent(agentId: string, commandType: string, data: any): Promise<string> {
    const commandId = await this.commandQueue.queueCommand({
      type: commandType,
      targetAgentId: agentId,
      data,
      priority: 2, // Normal priority
    });

    const agentCommand: AgentCommand = {
      commandId,
      agentId,
      type: commandType,
      data,
      status: 'pending',
      createdAt: new Date(),
    };

    this.agentCommands.set(commandId, agentCommand);
    
    this.logger.debug(`Command queued for agent ${agentId}: ${commandType}`);
    return commandId;
  }

  async restartAgent(agentId: string): Promise<string> {
    return await this.sendCommandToAgent(agentId, 'agent_restart', {
      reason: 'Manual restart requested',
    });
  }

  async updateAgentPolicy(agentId: string, policyId: string, policyData: any): Promise<string> {
    return await this.sendCommandToAgent(agentId, 'policy_update', {
      policyId,
      policy: policyData,
    });
  }

  async updateAgentConfiguration(agentId: string, config: Record<string, any>): Promise<string> {
    return await this.sendCommandToAgent(agentId, 'configuration_update', {
      config,
    });
  }

  async toggleDataCollection(agentId: string, enabled: boolean): Promise<string> {
    return await this.sendCommandToAgent(agentId, 'data_collection_toggle', {
      enabled,
    });
  }

  async requestScreenshot(agentId: string, quality: 'low' | 'medium' | 'high' = 'medium'): Promise<string> {
    return await this.sendCommandToAgent(agentId, 'screenshot_capture', {
      quality,
      timestamp: Date.now(),
    });
  }

  async collectSystemInfo(agentId: string, includeProcesses: boolean = false): Promise<string> {
    return await this.sendCommandToAgent(agentId, 'system_info_collect', {
      includeProcesses,
      timestamp: Date.now(),
    });
  }

  async updateAgent(agentId: string, version: string, updateUrl: string): Promise<string> {
    return await this.sendCommandToAgent(agentId, 'agent_update', {
      version,
      updateUrl,
      forceUpdate: false,
    });
  }

  getAgent(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  getAgentsByOrganization(organizationId: number): AgentInfo[] {
    return Array.from(this.agents.values())
      .filter(agent => agent.organizationId === organizationId);
  }

  getOnlineAgents(): AgentInfo[] {
    return Array.from(this.agents.values())
      .filter(agent => agent.status === 'online');
  }

  getOfflineAgents(): AgentInfo[] {
    const offlineThreshold = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    
    return Array.from(this.agents.values())
      .filter(agent => {
        const timeSinceLastSeen = now.getTime() - agent.lastSeen.getTime();
        return timeSinceLastSeen > offlineThreshold || agent.status === 'offline';
      });
  }

  getAgentCommand(commandId: string): AgentCommand | undefined {
    return this.agentCommands.get(commandId);
  }

  getAgentCommands(agentId: string): AgentCommand[] {
    return Array.from(this.agentCommands.values())
      .filter(command => command.agentId === agentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getPendingCommands(): AgentCommand[] {
    return Array.from(this.agentCommands.values())
      .filter(command => command.status === 'pending' || command.status === 'sent');
  }

  getAgentStats(): {
    total: number;
    online: number;
    offline: number;
    byPlatform: Record<string, number>;
    byVersion: Record<string, number>;
    commandStats: {
      total: number;
      pending: number;
      completed: number;
      failed: number;
    };
  } {
    const agents = Array.from(this.agents.values());
    const commands = Array.from(this.agentCommands.values());
    
    const onlineAgents = this.getOnlineAgents();
    const offlineAgents = this.getOfflineAgents();
    
    const byPlatform: Record<string, number> = {};
    const byVersion: Record<string, number> = {};
    
    agents.forEach(agent => {
      byPlatform[agent.platform] = (byPlatform[agent.platform] || 0) + 1;
      byVersion[agent.version] = (byVersion[agent.version] || 0) + 1;
    });

    return {
      total: agents.length,
      online: onlineAgents.length,
      offline: offlineAgents.length,
      byPlatform,
      byVersion,
      commandStats: {
        total: commands.length,
        pending: commands.filter(c => c.status === 'pending' || c.status === 'sent').length,
        completed: commands.filter(c => c.status === 'completed').length,
        failed: commands.filter(c => c.status === 'failed').length,
      },
    };
  }

  async broadcastCommand(commandType: string, data: any, organizationId?: number): Promise<string[]> {
    let targetAgents = this.getOnlineAgents();
    
    if (organizationId) {
      targetAgents = targetAgents.filter(agent => agent.organizationId === organizationId);
    }

    const commandIds: string[] = [];
    
    for (const agent of targetAgents) {
      try {
        const commandId = await this.sendCommandToAgent(agent.id, commandType, data);
        commandIds.push(commandId);
      } catch (error) {
        this.logger.error(`Failed to send broadcast command to agent ${agent.id}: ${error.message}`);
      }
    }

    this.logger.log(`Broadcast command sent to ${commandIds.length} agents`);
    return commandIds;
  }

  markAgentOffline(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'offline';
      this.logger.debug(`Agent marked offline: ${agentId}`);
    }
  }

  removeAgent(agentId: string): boolean {
    const removed = this.agents.delete(agentId);
    if (removed) {
      this.logger.log(`Agent removed: ${agentId}`);
    }
    return removed;
  }

  cleanupOldCommands(olderThanHours: number = 24): number {
    const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [commandId, command] of this.agentCommands.entries()) {
      if ((command.status === 'completed' || command.status === 'failed') &&
          command.createdAt.getTime() < cutoff) {
        
        this.agentCommands.delete(commandId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.log(`Cleaned up ${removedCount} old agent commands`);
    }

    return removedCount;
  }

  async getAgentHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    stats: any;
  }> {
    const stats = this.getAgentStats();
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check for offline agents
    if (stats.offline > stats.total * 0.5) {
      status = 'critical';
      issues.push(`More than 50% of agents are offline (${stats.offline}/${stats.total})`);
    } else if (stats.offline > stats.total * 0.2) {
      status = 'warning';
      issues.push(`${stats.offline} agents are offline`);
    }

    // Check for failed commands
    const failedCommandRate = stats.commandStats.total > 0 
      ? (stats.commandStats.failed / stats.commandStats.total) * 100 
      : 0;
      
    if (failedCommandRate > 20) {
      status = 'critical';
      issues.push(`High command failure rate: ${failedCommandRate.toFixed(1)}%`);
    } else if (failedCommandRate > 10) {
      if (status !== 'critical') status = 'warning';
      issues.push(`Elevated command failure rate: ${failedCommandRate.toFixed(1)}%`);
    }

    // Check for pending commands
    if (stats.commandStats.pending > 100) {
      if (status !== 'critical') status = 'warning';
      issues.push(`High number of pending commands: ${stats.commandStats.pending}`);
    }

    return {
      status,
      issues,
      stats,
    };
  }
}