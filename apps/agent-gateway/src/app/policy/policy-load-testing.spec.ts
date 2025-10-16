import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PolicyDistributionService } from './policy-distribution.service';
import { PolicyVersioningService } from './policy-versioning.service';
import { WebSocketClientService } from '../control-channel/websocket-client.service';
import { CommandQueueInfrastructureService } from '../command-queue/command-queue-infrastructure.service';

describe('Policy Distribution Load Testing', () => {
  let distributionService: PolicyDistributionService;
  let versioningService: PolicyVersioningService;
  let webSocketClient: jest.Mocked<WebSocketClientService>;
  let commandQueue: jest.Mocked<CommandQueueInfrastructureService>;

  beforeEach(async () => {
    const mockWebSocketClient = {
      isConnected: jest.fn().mockReturnValue(true),
      sendMessage: jest.fn().mockReturnValue(true),
    };

    const mockCommandQueue = {
      queueCommand: jest.fn().mockResolvedValue('mock-command-id'),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      providers: [
        PolicyDistributionService,
        PolicyVersioningService,
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

    distributionService = module.get<PolicyDistributionService>(PolicyDistributionService);
    versioningService = module.get<PolicyVersioningService>(PolicyVersioningService);
    webSocketClient = module.get(WebSocketClientService);
    commandQueue = module.get(CommandQueueInfrastructureService);
  });

  describe('High Volume Policy Distribution', () => {
    it('should handle 1000 concurrent policy distributions', async () => {
      const testPolicy = versioningService.createPolicy({
        name: 'Load Test Policy',
        policy: { rules: [], settings: {} },
        organizationId: 1,
        createdBy: 'load-test',
      });

      const startTime = Date.now();
      const distributionPromises = [];

      // Create 1000 distribution jobs
      for (let i = 0; i < 1000; i++) {
        const targets = {
          agents: [`load-test-agent-${i}`],
        };
        
        distributionPromises.push(
          distributionService.distributePolicy(testPolicy, targets, {
            priority: Math.floor(Math.random() * 5) + 1,
          })
        );
      }

      const jobIds = await Promise.allSettled(distributionPromises);
      const endTime = Date.now();
      
      const successfulJobs = jobIds.filter(result => result.status === 'fulfilled').length;
      const duration = endTime - startTime;

      console.log(`Load Test Results:`);
      console.log(`- Total Jobs: 1000`);
      console.log(`- Successful: ${successfulJobs}`);
      console.log(`- Duration: ${duration}ms`);
      console.log(`- Rate: ${(successfulJobs / duration * 1000).toFixed(2)} jobs/second`);

      expect(successfulJobs).toBeGreaterThan(950); // 95% success rate
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    }, 60000);

    it('should handle policy distribution under high load', async () => {
      const testPolicy = versioningService.createPolicy({
        name: 'High Load Test Policy',
        policy: { 
          rules: Array.from({ length: 50 }, (_, i) => ({
            id: `rule-${i}`,
            type: 'test',
            enabled: true,
          })),
          settings: { interval: 30000 },
        },
        organizationId: 1,
        createdBy: 'high-load-test',
      });

      const batchSize = 100;
      const batchCount = 10;
      const results = [];

      for (let batch = 0; batch < batchCount; batch++) {
        const batchStartTime = Date.now();
        const batchPromises = [];

        for (let i = 0; i < batchSize; i++) {
          const agentIndex = batch * batchSize + i;
          const targets = {
            agents: [`batch-agent-${agentIndex}`],
          };
          
          batchPromises.push(
            distributionService.distributePolicy(testPolicy, targets)
          );
        }

        const batchResults = await Promise.allSettled(batchPromises);
        const batchEndTime = Date.now();
        
        const batchSuccessful = batchResults.filter(r => r.status === 'fulfilled').length;
        const batchDuration = batchEndTime - batchStartTime;

        results.push({
          batch: batch + 1,
          successful: batchSuccessful,
          duration: batchDuration,
          rate: (batchSuccessful / batchDuration * 1000),
        });

        console.log(`Batch ${batch + 1}: ${batchSuccessful}/${batchSize} in ${batchDuration}ms`);
      }

      const totalSuccessful = results.reduce((sum, r) => sum + r.successful, 0);
      const averageRate = results.reduce((sum, r) => sum + r.rate, 0) / results.length;

      expect(totalSuccessful).toBeGreaterThan(950); // 95% success rate
      expect(averageRate).toBeGreaterThan(50); // At least 50 jobs/second average
    }, 120000);
  });
});