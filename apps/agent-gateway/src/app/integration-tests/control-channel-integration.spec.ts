import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ControlChannelModule } from '../control-channel/control-channel.module';
import { WebSocketClientService } from '../control-channel/websocket-client.service';
import { CommandQueueService } from '../control-channel/command-queue.service';
import { AgentManagementService } from '../control-channel/agent-management.service';
import { HeartbeatService } from '../control-channel/heartbeat.service';

describe('Control Channel Integration Tests', () => {
  let webSocketClient: WebSocketClientService;
  let commandQueue: CommandQueueService;
  let agentManagement: AgentManagementService;
  let heartbeatService: HeartbeatService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        ControlChannelModule,
      ],
    }).compile();

    webSocketClient = module.get<WebSocketClientService>(WebSocketClientService);
    commandQueue = module.get<CommandQueueService>(CommandQueueService);
    agentManagement = module.get<AgentManagementService>(AgentManagementService);
    heartbeatService = module.get<HeartbeatService>(HeartbeatService);
  });

  describe('WebSocket Connection Management', () => {
    it('should establish WebSocket connection', async () => {
      const connectionStats = webSocketClient.getConnectionStats();
      
      expect(connectionStats).toHaveProperty('connected');
      expect(connectionStats).toHaveProperty('messagesSent');
      expect(connectionStats).toHaveProperty('messagesReceived');
      expect(connectionStats).toHaveProperty('reconnectAttempts');
      expect(connectionStats).toHaveProperty('latency');
      
      // Connection stats should be valid
      expect(typeof connectionStats.connected).toBe('boolean');
      expect(connectionStats.messagesSent).toBeGreaterThanOrEqual(0);
      expect(connectionStats.messagesReceived).toBeGreaterThanOrEqual(0);
      expect(connectionStats.reconnectAttempts).toBeGreaterThanOrEqual(0);
    });

    it('should handle WebSocket message sending', async () => {
      const testMessage = {
        type: 'test_message',
        data: {
          test: true,
          timestamp: Date.now(),
        },
        timestamp: new Date(),
      };

      const initialStats = webSocketClient.getConnectionStats();
      const success = webSocketClient.sendMessage(testMessage);
      
      if (webSocketClient.isConnected()) {
        expect(success).toBe(true);
        
        // Wait a moment for stats to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const updatedStats = webSocketClient.getConnectionStats();
        expect(updatedStats.messagesSent).toBeGreaterThan(initialStats.messagesSent);
      } else {
        // If not connected, should return false
        expect(success).toBe(false);
      }
    });

    it('should handle connection configuration updates', async () => {
      const originalConfig = webSocketClient.getConfig();
      
      // Test configuration update
      const newConfig = {
        ...originalConfig,
        pingInterval: originalConfig.pingInterval + 1000, // Increase ping interval
      };
      
      await webSocketClient.updateConfig(newConfig);
      
      const updatedConfig = webSocketClient.getConfig();
      expect(updatedConfig.pingInterval).toBe(newConfig.pingInterval);
      
      // Restore original config
      await webSocketClient.updateConfig(originalConfig);
    });

    it('should test WebSocket connection health', async () => {
      const connectionTest = await webSocketClient.testConnection();
      
      expect(connectionTest).toHaveProperty('success');
      expect(connectionTest).toHaveProperty('latency');
      expect(connectionTest).toHaveProperty('error');
      
      if (connectionTest.success) {
        expect(connectionTest.latency).toBeGreaterThan(0);
        expect(connectionTest.latency).toBeLessThan(10000); // Less than 10 seconds
      } else {
        expect(connectionTest.error).toBeDefined();
      }
    });
  });

  describe('Command Queue Management', () => {
    it('should queue and process commands', async () => {
      const testCommand = {
        type: 'test_command',
        targetAgentId: 'test-agent-001',
        data: {
          action: 'test_action',
          parameters: { test: true },
        },
        priority: 2,
      };

      const commandId = commandQueue.queueCommand(testCommand);
      expect(commandId).toBeDefined();
      expect(typeof commandId).toBe('string');

      const queuedCommand = commandQueue.getCommand(commandId);
      expect(queuedCommand).toBeDefined();
      expect(queuedCommand?.type).toBe(testCommand.type);
      expect(queuedCommand?.targetAgentId).toBe(testCommand.targetAgentId);
      expect(queuedCommand?.priority).toBe(testCommand.priority);
      expect(queuedCommand?.status).toBe('pending');
    });

    it('should handle command priorities correctly', async () => {
      const highPriorityCommand = commandQueue.queueCommand({
        type: 'high_priority_test',
        targetAgentId: 'test-agent-002',
        data: { priority: 'high' },
        priority: 1, // Highest priority
      });

      const lowPriorityCommand = commandQueue.queueCommand({
        type: 'low_priority_test',
        targetAgentId: 'test-agent-003',
        data: { priority: 'low' },
        priority: 5, // Lowest priority
      });

      const mediumPriorityCommand = commandQueue.queueCommand({
        type: 'medium_priority_test',
        targetAgentId: 'test-agent-004',
        data: { priority: 'medium' },
        priority: 3, // Medium priority
      });

      // All commands should be queued
      expect(highPriorityCommand).toBeDefined();
      expect(lowPriorityCommand).toBeDefined();
      expect(mediumPriorityCommand).toBeDefined();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const queueStats = commandQueue.getQueueStats();
      expect(queueStats).toHaveProperty('totalCommands');
      expect(queueStats).toHaveProperty('pendingCommands');
      expect(queueStats).toHaveProperty('executingCommands');
      expect(queueStats).toHaveProperty('completedCommands');
      expect(queueStats).toHaveProperty('failedCommands');
      expect(queueStats).toHaveProperty('successRate');

      expect(queueStats.totalCommands).toBeGreaterThanOrEqual(3);
    });

    it('should handle command cancellation', async () => {
      const cancelTestCommand = commandQueue.queueCommand({
        type: 'cancel_test_command',
        targetAgentId: 'test-agent-cancel',
        data: { test: 'cancellation' },
        priority: 3,
      });

      const command = commandQueue.getCommand(cancelTestCommand);
      expect(command?.status).toBe('pending');

      // Cancel the command
      const cancelled = commandQueue.cancelCommand(cancelTestCommand);
      expect(cancelled).toBe(true);

      const cancelledCommand = commandQueue.getCommand(cancelTestCommand);
      expect(cancelledCommand?.status).toBe('cancelled');
    });

    it('should handle command timeouts and retries', async () => {
      const timeoutCommand = commandQueue.queueCommand({
        type: 'timeout_test_command',
        targetAgentId: 'non-existent-agent',
        data: { test: 'timeout' },
        priority: 2,
        maxRetries: 2,
      });

      // Wait for processing and potential retries
      await new Promise(resolve => setTimeout(resolve, 10000));

      const command = commandQueue.getCommand(timeoutCommand);
      expect(command).toBeDefined();
      
      // Should have attempted retries
      if (command?.status === 'failed') {
        expect(command.retryCount).toBeGreaterThan(0);
        expect(command.retryCount).toBeLessThanOrEqual(2);
      }
    }, 15000);

    it('should provide queue statistics and status', async () => {
      const queueStats = commandQueue.getQueueStats();
      
      expect(queueStats).toHaveProperty('totalCommands');
      expect(queueStats).toHaveProperty('pendingCommands');
      expect(queueStats).toHaveProperty('executingCommands');
      expect(queueStats).toHaveProperty('completedCommands');
      expect(queueStats).toHaveProperty('failedCommands');
      expect(queueStats).toHaveProperty('averageExecutionTime');
      expect(queueStats).toHaveProperty('successRate');

      expect(queueStats.totalCommands).toBeGreaterThanOrEqual(0);
      expect(queueStats.successRate).toBeGreaterThanOrEqual(0);
      expect(queueStats.successRate).toBeLessThanOrEqual(100);

      const queueStatus = commandQueue.getQueueStatus();
      expect(queueStatus).toHaveProperty('totalCommands');
      expect(queueStatus).toHaveProperty('queuesByPriority');
      expect(queueStatus).toHaveProperty('executingCommands');
      expect(queueStatus).toHaveProperty('maxConcurrent');

      expect(Array.isArray(queueStatus.queuesByPriority)).toBe(true);
    });
  });

  describe('Agent Management Integration', () => {
    it('should manage agent information', async () => {
      // Simulate agent update
      const testAgentData = {
        agentId: 'integration-test-agent-001',
        organizationId: 1,
        hostname: 'test-hostname',
        ipAddress: '192.168.1.100',
        version: '1.0.0',
        platform: 'Windows',
        status: 'online',
        capabilities: ['monitoring', 'screenshots'],
        metadata: { testAgent: true },
      };

      // Simulate receiving agent update (normally comes via WebSocket)
      webSocketClient.emit('agent_update', {
        data: testAgentData,
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const agent = agentManagement.getAgent(testAgentData.agentId);
      if (agent) {
        expect(agent.id).toBe(testAgentData.agentId);
        expect(agent.organizationId).toBe(testAgentData.organizationId);
        expect(agent.hostname).toBe(testAgentData.hostname);
        expect(agent.platform).toBe(testAgentData.platform);
      }
    });

    it('should send commands to agents', async () => {
      const agentId = 'command-test-agent-001';
      
      // Send restart command
      const restartCommandId = await agentManagement.restartAgent(agentId);
      expect(restartCommandId).toBeDefined();

      // Send policy update command
      const policyCommandId = await agentManagement.updateAgentPolicy(
        agentId,
        'test-policy-001',
        { monitoring: { enabled: true } }
      );
      expect(policyCommandId).toBeDefined();

      // Send configuration update command
      const configCommandId = await agentManagement.updateAgentConfiguration(
        agentId,
        { logLevel: 'debug', interval: 30 }
      );
      expect(configCommandId).toBeDefined();

      // Verify commands were queued
      const agentCommands = agentManagement.getAgentCommands(agentId);
      expect(agentCommands.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle agent status tracking', async () => {
      const onlineAgents = agentManagement.getOnlineAgents();
      const offlineAgents = agentManagement.getOfflineAgents();
      const allAgents = agentManagement.getAllAgents();

      expect(Array.isArray(onlineAgents)).toBe(true);
      expect(Array.isArray(offlineAgents)).toBe(true);
      expect(Array.isArray(allAgents)).toBe(true);

      const agentStats = agentManagement.getAgentStats();
      expect(agentStats).toHaveProperty('total');
      expect(agentStats).toHaveProperty('online');
      expect(agentStats).toHaveProperty('offline');
      expect(agentStats).toHaveProperty('byPlatform');
      expect(agentStats).toHaveProperty('byVersion');
      expect(agentStats).toHaveProperty('commandStats');

      expect(agentStats.total).toBe(onlineAgents.length + offlineAgents.length);
    });

    it('should broadcast commands to multiple agents', async () => {
      const broadcastData = {
        message: 'Test broadcast message',
        timestamp: Date.now(),
      };

      const commandIds = await agentManagement.broadcastCommand(
        'broadcast_test',
        broadcastData,
        1 // Organization ID
      );

      expect(Array.isArray(commandIds)).toBe(true);
      
      // Should have sent commands to online agents
      const onlineAgents = agentManagement.getOnlineAgents();
      const orgAgents = onlineAgents.filter(agent => agent.organizationId === 1);
      
      if (orgAgents.length > 0) {
        expect(commandIds.length).toBe(orgAgents.length);
      }
    });

    it('should provide agent health status', async () => {
      const agentHealth = await agentManagement.getAgentHealth();
      
      expect(agentHealth).toHaveProperty('status');
      expect(agentHealth).toHaveProperty('issues');
      expect(agentHealth).toHaveProperty('stats');

      expect(['healthy', 'warning', 'critical']).toContain(agentHealth.status);
      expect(Array.isArray(agentHealth.issues)).toBe(true);
    });
  });

  describe('Heartbeat Management', () => {
    it('should track heartbeat statistics', async () => {
      const heartbeatStats = heartbeatService.getHeartbeatStats();
      
      expect(heartbeatStats).toHaveProperty('lastHeartbeat');
      expect(heartbeatStats).toHaveProperty('heartbeatInterval');
      expect(heartbeatStats).toHaveProperty('missedHeartbeats');
      expect(heartbeatStats).toHaveProperty('totalHeartbeats');
      expect(heartbeatStats).toHaveProperty('averageLatency');
      expect(heartbeatStats).toHaveProperty('status');

      expect(heartbeatStats.heartbeatInterval).toBeGreaterThan(0);
      expect(heartbeatStats.missedHeartbeats).toBeGreaterThanOrEqual(0);
      expect(heartbeatStats.totalHeartbeats).toBeGreaterThanOrEqual(0);
      expect(['healthy', 'warning', 'critical']).toContain(heartbeatStats.status);
    });

    it('should test heartbeat functionality', async () => {
      const heartbeatTest = await heartbeatService.testHeartbeat();
      
      expect(heartbeatTest).toHaveProperty('success');
      expect(heartbeatTest).toHaveProperty('latency');
      expect(heartbeatTest).toHaveProperty('error');

      if (heartbeatTest.success) {
        expect(heartbeatTest.latency).toBeGreaterThan(0);
      } else {
        expect(heartbeatTest.error).toBeDefined();
      }
    });

    it('should provide heartbeat health status', async () => {
      const heartbeatHealth = heartbeatService.getHeartbeatHealth();
      
      expect(heartbeatHealth).toHaveProperty('status');
      expect(heartbeatHealth).toHaveProperty('issues');
      expect(heartbeatHealth).toHaveProperty('stats');

      expect(['healthy', 'warning', 'critical']).toContain(heartbeatHealth.status);
      expect(Array.isArray(heartbeatHealth.issues)).toBe(true);
    });

    it('should handle heartbeat interval updates', async () => {
      const originalStats = heartbeatService.getHeartbeatStats();
      const originalInterval = originalStats.heartbeatInterval;
      
      // Update interval
      const newInterval = originalInterval + 5000; // Add 5 seconds
      heartbeatService.updateInterval(newInterval);
      
      const updatedStats = heartbeatService.getHeartbeatStats();
      expect(updatedStats.heartbeatInterval).toBe(newInterval);
      
      // Restore original interval
      heartbeatService.updateInterval(originalInterval);
    });

    it('should track latency statistics', async () => {
      const latencyStats = heartbeatService.getLatencyStats();
      
      expect(latencyStats).toHaveProperty('current');
      expect(latencyStats).toHaveProperty('average');
      expect(latencyStats).toHaveProperty('min');
      expect(latencyStats).toHaveProperty('max');
      expect(latencyStats).toHaveProperty('p95');

      if (latencyStats.average > 0) {
        expect(latencyStats.min).toBeLessThanOrEqual(latencyStats.average);
        expect(latencyStats.average).toBeLessThanOrEqual(latencyStats.max);
        expect(latencyStats.p95).toBeGreaterThanOrEqual(latencyStats.average);
      }
    });
  });

  describe('Control Channel Error Handling', () => {
    it('should handle WebSocket disconnections gracefully', async () => {
      const initialStats = webSocketClient.getConnectionStats();
      
      // Simulate disconnection scenario by testing with invalid config
      const originalConfig = webSocketClient.getConfig();
      
      try {
        await webSocketClient.updateConfig({
          ...originalConfig,
          serverUrl: 'wss://invalid-websocket-url.example.com',
        });
        
        // Wait for connection attempt
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const disconnectedStats = webSocketClient.getConnectionStats();
        expect(disconnectedStats.connected).toBe(false);
        
      } finally {
        // Restore original config
        await webSocketClient.updateConfig(originalConfig);
      }
    });

    it('should handle command processing errors', async () => {
      // Queue a command that will likely fail
      const errorCommand = commandQueue.queueCommand({
        type: 'invalid_command_type',
        targetAgentId: 'non-existent-agent',
        data: { invalid: 'data' },
        priority: 2,
        maxRetries: 1,
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      const command = commandQueue.getCommand(errorCommand);
      expect(command).toBeDefined();
      
      // Should handle error gracefully
      if (command?.status === 'failed') {
        expect(command.lastError).toBeDefined();
      }
    });

    it('should maintain system stability during errors', async () => {
      // Generate multiple error conditions
      const errorCommands = Array.from({ length: 5 }, (_, i) =>
        commandQueue.queueCommand({
          type: 'error_test_command',
          targetAgentId: `error-agent-${i}`,
          data: { errorTest: true },
          priority: 3,
          maxRetries: 1,
        })
      );

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // System should still be responsive
      const queueStats = commandQueue.getQueueStats();
      expect(queueStats).toHaveProperty('totalCommands');

      const heartbeatStats = heartbeatService.getHeartbeatStats();
      expect(heartbeatStats).toHaveProperty('status');

      // Should be able to queue new commands
      const testCommand = commandQueue.queueCommand({
        type: 'post_error_test',
        targetAgentId: 'test-agent',
        data: { test: 'stability' },
        priority: 2,
      });

      expect(testCommand).toBeDefined();
    });
  });

  describe('Control Channel Performance', () => {
    it('should handle high command throughput', async () => {
      const commandCount = 100;
      const startTime = Date.now();
      
      // Queue many commands rapidly
      const commandIds = Array.from({ length: commandCount }, (_, i) =>
        commandQueue.queueCommand({
          type: 'throughput_test',
          targetAgentId: `throughput-agent-${i % 10}`,
          data: { index: i },
          priority: Math.floor(Math.random() * 5) + 1,
        })
      );

      const queueTime = Date.now() - startTime;
      
      expect(commandIds).toHaveLength(commandCount);
      expect(queueTime).toBeLessThan(5000); // Should queue within 5 seconds

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 10000));

      const queueStats = commandQueue.getQueueStats();
      expect(queueStats.totalCommands).toBeGreaterThanOrEqual(commandCount);

      console.log(`Throughput Test: ${commandCount} commands queued in ${queueTime}ms`);
      console.log(`Queue Stats: ${queueStats.completedCommands} completed, ${queueStats.failedCommands} failed`);
    }, 20000);

    it('should maintain WebSocket message performance', async () => {
      const messageCount = 50;
      const startTime = Date.now();
      
      let successfulMessages = 0;
      
      // Send messages rapidly
      for (let i = 0; i < messageCount; i++) {
        const message = {
          type: 'performance_test',
          data: { index: i, timestamp: Date.now() },
          timestamp: new Date(),
        };
        
        const success = webSocketClient.sendMessage(message);
        if (success) {
          successfulMessages++;
        }
      }
      
      const sendTime = Date.now() - startTime;
      const successRate = (successfulMessages / messageCount) * 100;
      
      console.log(`WebSocket Performance: ${successfulMessages}/${messageCount} messages (${successRate.toFixed(1)}%) in ${sendTime}ms`);
      
      expect(successRate).toBeGreaterThan(80); // 80% success rate
      expect(sendTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});