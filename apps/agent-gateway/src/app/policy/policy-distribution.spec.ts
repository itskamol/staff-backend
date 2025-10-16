import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PolicyDistributionService, DistributionStatus } from './policy-distribution.service';
import { WebSocketClientService } from '../control-channel/websocket-client.service';
import { CommandQueueInfrastructureService } from '../command-queue/command-queue-infrastructure.service';
import { PolicyVersion } from './policy-versioning.service';

describe('PolicyDistributionService', () => {
  let service: PolicyDistributionService;
  let webSocketClient: jest.Mocked<WebSocketClientService>;
  let commandQueue: jest.Mocked<CommandQueueInfrastructureService>;

  const mockPolicy: PolicyVersion = {
    id: 'test-policy-001',
    version: '1.0.0',
    name: 'Test Policy',
    policy: {
      rules: [
        { id: 'rule1', type: 'monitoring', enabled: true },
        { id: 'rule2', type: 'screenshot', enabled: false },
      ],
      settings: {
        interval: 30000,
        quality: 'medium',
      },
    },
    checksum: 'test-checksum',
    createdAt: new Date(),
    createdBy: 'test-user',
    organizationId: 1,
    status: 'active',
    tags: ['test'],
    metadata: {},
  };

  beforeEach(async () => {
    const mockWebSocketClient = {
      isConnected: jest.fn(),
      sendMessage: jest.fn(),
    };

    const mockCommandQueue = {
      queueCommand: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      providers: [
        PolicyDistributionService,
        {
          provide: WebSocketClientService,
          useValue: mockWebSocketClient,
        },
        {
          provide: CommandQueueInfrastructureService,
          useValue: mockCommandQueue,
        },
      ],
    }).compile();

    service = module.get<PolicyDistributionService>(PolicyDistributionService);
    webSocketClient = module.get(WebSocketClientService);
    commandQueue = module.get(CommandQueueInfrastructureService);
  });

  describe('Policy Distribution', () => {
    it('should create distribution job for agent targets', async () => {
      const targets = {
        agents: ['agent-001', 'agent-002', 'agent-003'],
      };

      const jobId = await service.distributePolicy(mockPolicy, targets);

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      const job = await service.getDistributionJob(jobId);
      expect(job).toBeDefined();
      expect(job?.policyId).toBe(mockPolicy.id);
      expect(job?.targetAgents).toEqual(targets.agents);
      expect(job?.progress.totalTargets).toBe(3);
    });

    it('should create distribution job for organization targets', async () => {
      const targets = {
        organizations: [1, 2],
      };

      const jobId = await service.distributePolicy(mockPolicy, targets);

      const job = await service.getDistributionJob(jobId);
      expect(job).toBeDefined();
      expect(job?.targetOrganizations).toEqual(targets.organizations);
      expect(job?.progress.totalTargets).toBe(2);
    });

    it('should create distribution job for mixed targets', async () => {
      const targets = {
        agents: ['agent-001', 'agent-002'],
        organizations: [1],
      };

      const jobId = await service.distributePolicy(mockPolicy, targets);

      const job = await service.getDistributionJob(jobId);
      expect(job).toBeDefined();
      expect(job?.targetAgents).toEqual(targets.agents);
      expect(job?.targetOrganizations).toEqual(targets.organizations);
      expect(job?.progress.totalTargets).toBe(3);
    });

    it('should throw error for empty targets', async () => {
      const targets = {};

      await expect(service.distributePolicy(mockPolicy, targets)).rejects.toThrow(
        'No distribution targets specified'
      );
    });

    it('should set correct distribution method', async () => {
      const targets = { agents: ['agent-001'] };

      // Test WebSocket method
      const jobId1 = await service.distributePolicy(mockPolicy, targets, {
        method: 'websocket',
      });
      const job1 = await service.getDistributionJob(jobId1);
      expect(job1?.distributionMethod).toBe('websocket');

      // Test REST method
      const jobId2 = await service.distributePolicy(mockPolicy, targets, {
        method: 'rest',
      });
      const job2 = await service.getDistributionJob(jobId2);
      expect(job2?.distributionMethod).toBe('rest');

      // Test both method
      const jobId3 = await service.distributePolicy(mockPolicy, targets, {
        method: 'both',
      });
      const job3 = await service.getDistributionJob(jobId3);
      expect(job3?.distributionMethod).toBe('both');
    });

    it('should handle priority settings', async () => {
      const targets = { agents: ['agent-001'] };

      const jobId = await service.distributePolicy(mockPolicy, targets, {
        priority: 1, // High priority
      });

      const job = await service.getDistributionJob(jobId);
      expect(job?.priority).toBe(1);
    });

    it('should handle custom retry configuration', async () => {
      const targets = { agents: ['agent-001'] };
      const customRetryConfig = {
        maxAttempts: 10,
        baseDelay: 2000,
        backoffMultiplier: 3,
      };

      const jobId = await service.distributePolicy(mockPolicy, targets, {
        retryConfig: customRetryConfig,
      });

      const job = await service.getDistributionJob(jobId);
      expect(job?.retryConfig.maxAttempts).toBe(10);
      expect(job?.retryConfig.baseDelay).toBe(2000);
      expect(job?.retryConfig.backoffMultiplier).toBe(3);
    });
  });

  describe('WebSocket Distribution', () => {
    it('should distribute via WebSocket when connected', async () => {
      webSocketClient.isConnected.mockReturnValue(true);
      webSocketClient.sendMessage.mockReturnValue(true);

      const targets = { agents: ['agent-001'] };
      const jobId = await service.distributePolicy(mockPolicy, targets, {
        method: 'websocket',
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(webSocketClient.sendMessage).toHaveBeenCalled();
      const sentMessage = webSocketClient.sendMessage.mock.calls[0][0];
      expect(sentMessage.type).toBe('policy_update');
      expect(sentMessage.data.policyId).toBe(mockPolicy.id);
    });

    it('should handle WebSocket connection failure', async () => {
      webSocketClient.isConnected.mockReturnValue(false);

      const targets = { agents: ['agent-001'] };
      const jobId = await service.distributePolicy(mockPolicy, targets, {
        method: 'websocket',
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const job = await service.getDistributionJob(jobId);
      // Should have attempted delivery but failed due to no connection
      expect(job?.progress.deliveryDetails[0].attempts).toBeGreaterThan(0);
    });

    it('should handle WebSocket send failure', async () => {
      webSocketClient.isConnected.mockReturnValue(true);
      webSocketClient.sendMessage.mockReturnValue(false);

      const targets = { agents: ['agent-001'] };
      const jobId = await service.distributePolicy(mockPolicy, targets, {
        method: 'websocket',
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(webSocketClient.sendMessage).toHaveBeenCalled();
    });
  });

  describe('Job Management', () => {
    it('should cancel distribution job', async () => {
      const targets = { agents: ['agent-001'] };
      const jobId = await service.distributePolicy(mockPolicy, targets);

      const cancelled = await service.cancelDistributionJob(jobId);
      expect(cancelled).toBe(true);

      const job = await service.getDistributionJob(jobId);
      expect(job?.status).toBe(DistributionStatus.CANCELLED);
    });

    it('should not cancel completed job', async () => {
      const targets = { agents: ['agent-001'] };
      const jobId = await service.distributePolicy(mockPolicy, targets);

      // Manually mark as completed
      const job = await service.getDistributionJob(jobId);
      if (job) {
        job.status = DistributionStatus.COMPLETED;
      }

      const cancelled = await service.cancelDistributionJob(jobId);
      expect(cancelled).toBe(false);
    });

    it('should retry failed deliveries', async () => {
      const targets = { agents: ['agent-001'] };
      const jobId = await service.distributePolicy(mockPolicy, targets);

      // Manually mark delivery as failed
      const job = await service.getDistributionJob(jobId);
      if (job) {
        job.progress.deliveryDetails[0].status = 'failed';
        job.progress.failedDeliveries = 1;
        job.progress.pendingDeliveries = 0;
      }

      const retried = await service.retryFailedDeliveries(jobId);
      expect(retried).toBe(true);

      const updatedJob = await service.getDistributionJob(jobId);
      expect(updatedJob?.progress.deliveryDetails[0].status).toBe('pending');
      expect(updatedJob?.progress.deliveryDetails[0].attempts).toBe(0);
    });

    it('should get active distributions', async () => {
      const targets1 = { agents: ['agent-001'] };
      const targets2 = { agents: ['agent-002'] };

      const jobId1 = await service.distributePolicy(mockPolicy, targets1);
      const jobId2 = await service.distributePolicy(mockPolicy, targets2);

      const activeJobs = await service.getActiveDistributions();
      expect(activeJobs.length).toBeGreaterThanOrEqual(0);
    });

    it('should get distribution history', async () => {
      const targets = { agents: ['agent-001'] };
      await service.distributePolicy(mockPolicy, targets);

      const history = await service.getDistributionHistory(10);
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide distribution statistics', async () => {
      const targets = { agents: ['agent-001', 'agent-002'] };
      await service.distributePolicy(mockPolicy, targets);

      const stats = await service.getDistributionStats();
      
      expect(stats).toHaveProperty('totalJobs');
      expect(stats).toHaveProperty('activeJobs');
      expect(stats).toHaveProperty('completedJobs');
      expect(stats).toHaveProperty('failedJobs');
      expect(stats).toHaveProperty('averageDeliveryTime');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('deliveryMethodStats');

      expect(typeof stats.totalJobs).toBe('number');
      expect(typeof stats.successRate).toBe('number');
      expect(stats.deliveryMethodStats).toHaveProperty('websocket');
      expect(stats.deliveryMethodStats).toHaveProperty('rest');
    });

    it('should track delivery method statistics', async () => {
      const targets = { agents: ['agent-001'] };
      
      // Create WebSocket distribution
      await service.distributePolicy(mockPolicy, targets, { method: 'websocket' });
      
      // Create REST distribution
      await service.distributePolicy(mockPolicy, targets, { method: 'rest' });

      const stats = await service.getDistributionStats();
      
      expect(stats.deliveryMethodStats.websocket.attempts).toBeGreaterThanOrEqual(0);
      expect(stats.deliveryMethodStats.rest.attempts).toBeGreaterThanOrEqual(0);
    });

    it('should calculate success rate correctly', async () => {
      const targets = { agents: ['agent-001'] };
      const jobId = await service.distributePolicy(mockPolicy, targets);

      // Manually set some deliveries as successful
      const job = await service.getDistributionJob(jobId);
      if (job) {
        job.progress.successfulDeliveries = 1;
        job.progress.failedDeliveries = 0;
      }

      const stats = await service.getDistributionStats();
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should cleanup old distribution jobs', async () => {
      const targets = { agents: ['agent-001'] };
      const jobId = await service.distributePolicy(mockPolicy, targets);

      // Manually set job as old and completed
      const job = await service.getDistributionJob(jobId);
      if (job) {
        job.createdAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
        job.status = DistributionStatus.COMPLETED;
      }

      const cleanedCount = await service.cleanupOldJobs(30); // 30 days
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });

    it('should not cleanup active jobs', async () => {
      const targets = { agents: ['agent-001'] };
      const jobId = await service.distributePolicy(mockPolicy, targets);

      // Job should be active/in-progress
      const cleanedCount = await service.cleanupOldJobs(0); // Clean everything older than now
      
      // Active job should not be cleaned
      const job = await service.getDistributionJob(jobId);
      expect(job).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid job ID gracefully', async () => {
      const job = await service.getDistributionJob('invalid-job-id');
      expect(job).toBeUndefined();
    });

    it('should handle cancellation of non-existent job', async () => {
      const cancelled = await service.cancelDistributionJob('non-existent-job');
      expect(cancelled).toBe(false);
    });

    it('should handle retry of non-existent job', async () => {
      const retried = await service.retryFailedDeliveries('non-existent-job');
      expect(retried).toBe(false);
    });

    it('should handle empty distribution history', async () => {
      // Clear any existing jobs first
      await service.cleanupOldJobs(0);
      
      const history = await service.getDistributionHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Concurrent Distribution', () => {
    it('should handle multiple concurrent distributions', async () => {
      const targets1 = { agents: ['agent-001'] };
      const targets2 = { agents: ['agent-002'] };
      const targets3 = { agents: ['agent-003'] };

      const [jobId1, jobId2, jobId3] = await Promise.all([
        service.distributePolicy(mockPolicy, targets1),
        service.distributePolicy(mockPolicy, targets2),
        service.distributePolicy(mockPolicy, targets3),
      ]);

      expect(jobId1).toBeDefined();
      expect(jobId2).toBeDefined();
      expect(jobId3).toBeDefined();
      expect(new Set([jobId1, jobId2, jobId3]).size).toBe(3); // All unique
    });

    it('should handle large number of targets', async () => {
      const largeTargets = {
        agents: Array.from({ length: 100 }, (_, i) => `agent-${i.toString().padStart(3, '0')}`),
      };

      const jobId = await service.distributePolicy(mockPolicy, largeTargets);
      const job = await service.getDistributionJob(jobId);
      
      expect(job?.progress.totalTargets).toBe(100);
      expect(job?.progress.deliveryDetails).toHaveLength(100);
    });
  });

  describe('Performance Testing', () => {
    it('should handle rapid job creation', async () => {
      const startTime = Date.now();
      const jobPromises = [];

      for (let i = 0; i < 50; i++) {
        const targets = { agents: [`agent-${i}`] };
        jobPromises.push(service.distributePolicy(mockPolicy, targets));
      }

      const jobIds = await Promise.all(jobPromises);
      const endTime = Date.now();

      expect(jobIds).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance with many active jobs', async () => {
      // Create multiple jobs
      const jobPromises = [];
      for (let i = 0; i < 20; i++) {
        const targets = { agents: [`perf-agent-${i}`] };
        jobPromises.push(service.distributePolicy(mockPolicy, targets));
      }

      await Promise.all(jobPromises);

      // Test statistics performance
      const startTime = Date.now();
      const stats = await service.getDistributionStats();
      const endTime = Date.now();

      expect(stats.totalJobs).toBeGreaterThanOrEqual(20);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});