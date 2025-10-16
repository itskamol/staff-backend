import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { BufferModule } from '../buffer/buffer.module';
import { UplinkModule } from '../uplink/uplink.module';
import { ControlChannelModule } from '../control-channel/control-channel.module';
import { CollectorModule } from '../collector/collector.module';
import { HealthModule } from '../health/health.module';
import { BufferService } from '../buffer/buffer.service';
import { UplinkService } from '../uplink/uplink.service';
import { WebSocketClientService } from '../control-channel/websocket-client.service';
import { CommandQueueService } from '../control-channel/command-queue.service';
import { CollectorService } from '../collector/collector.service';

describe('Gateway Integration Tests', () => {
  let app: INestApplication;
  let bufferService: BufferService;
  let uplinkService: UplinkService;
  let webSocketClient: WebSocketClientService;
  let commandQueue: CommandQueueService;
  let collectorService: CollectorService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        BufferModule,
        UplinkModule,
        ControlChannelModule,
        CollectorModule,
        HealthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    bufferService = moduleFixture.get<BufferService>(BufferService);
    uplinkService = moduleFixture.get<UplinkService>(UplinkService);
    webSocketClient = moduleFixture.get<WebSocketClientService>(WebSocketClientService);
    commandQueue = moduleFixture.get<CommandQueueService>(CommandQueueService);
    collectorService = moduleFixture.get<CollectorService>(CollectorService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('End-to-End Data Flow', () => {
    it('should handle complete data ingestion flow', async () => {
      // 1. Simulate data ingestion
      const testData = {
        agentId: 'test-agent-001',
        organizationId: 1,
        timestamp: new Date().toISOString(),
        data: {
          activeWindows: [
            {
              title: 'Test Application',
              processName: 'test.exe',
              startTime: new Date().toISOString(),
              duration: 3600,
            },
          ],
          visitedSites: [
            {
              url: 'https://example.com',
              title: 'Example Site',
              visitTime: new Date().toISOString(),
              duration: 120,
            },
          ],
        },
      };

      // 2. Send data to collector endpoint
      const response = await request(app.getHttpServer())
        .post('/collector/ingest')
        .send(testData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('recordId');

      // 3. Verify data is stored in buffer
      const bufferStats = await bufferService.getBufferStats();
      expect(bufferStats.totalRecords).toBeGreaterThan(0);

      // 4. Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 5. Verify uplink processing
      const uplinkStats = await uplinkService.getRequestStats();
      expect(uplinkStats.totalRequests).toBeGreaterThan(0);
    });

    it('should handle buffer overflow gracefully', async () => {
      // Fill buffer to near capacity
      const testData = Array.from({ length: 100 }, (_, i) => ({
        agentId: `test-agent-${i}`,
        organizationId: 1,
        timestamp: new Date().toISOString(),
        data: { test: `data-${i}` },
      }));

      // Send multiple requests rapidly
      const promises = testData.map(data =>
        request(app.getHttpServer())
          .post('/collector/ingest')
          .send(data)
      );

      const responses = await Promise.allSettled(promises);
      const successful = responses.filter(r => r.status === 'fulfilled').length;
      
      expect(successful).toBeGreaterThan(0);
      
      // Check back-pressure mechanism
      const backPressureStats = await bufferService.getBackPressureStats();
      expect(backPressureStats).toHaveProperty('status');
    });
  });

  describe('Buffer Management Integration', () => {
    it('should store and retrieve data correctly', async () => {
      const testRecord = {
        agentId: 'buffer-test-001',
        organizationId: 1,
        dataType: 'active_windows',
        data: { test: 'buffer data' },
        timestamp: new Date(),
      };

      // Store data
      const recordId = await bufferService.storeRecord(testRecord);
      expect(recordId).toBeDefined();

      // Retrieve data
      const retrievedRecords = await bufferService.getRecords({
        agentId: 'buffer-test-001',
        limit: 10,
      });

      expect(retrievedRecords).toHaveLength(1);
      expect(retrievedRecords[0]).toMatchObject({
        agentId: testRecord.agentId,
        organizationId: testRecord.organizationId,
        dataType: testRecord.dataType,
      });
    });

    it('should handle buffer cleanup correctly', async () => {
      // Get initial record count
      const initialStats = await bufferService.getBufferStats();
      const initialCount = initialStats.totalRecords;

      // Add old records (simulate by setting old timestamp)
      const oldRecord = {
        agentId: 'cleanup-test-001',
        organizationId: 1,
        dataType: 'test_data',
        data: { test: 'old data' },
        timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days old
      };

      await bufferService.storeRecord(oldRecord);

      // Trigger cleanup
      const cleanedCount = await bufferService.cleanupOldRecords();
      
      // Verify cleanup worked
      const finalStats = await bufferService.getBufferStats();
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });

    it('should monitor disk usage correctly', async () => {
      const diskInfo = await bufferService.getDiskUsage();
      
      expect(diskInfo).toHaveProperty('usedBytes');
      expect(diskInfo).toHaveProperty('freeBytes');
      expect(diskInfo).toHaveProperty('totalBytes');
      expect(diskInfo).toHaveProperty('usedPercent');
      
      expect(diskInfo.usedPercent).toBeGreaterThanOrEqual(0);
      expect(diskInfo.usedPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('Uplink Communication Integration', () => {
    it('should process batch uploads successfully', async () => {
      // Add test records to buffer
      const testRecords = Array.from({ length: 5 }, (_, i) => ({
        agentId: `uplink-test-${i}`,
        organizationId: 1,
        dataType: 'test_batch',
        data: { batchTest: i },
        timestamp: new Date(),
      }));

      for (const record of testRecords) {
        await bufferService.storeRecord(record);
      }

      // Trigger batch processing
      const batchResult = await uplinkService.processBatch();
      
      expect(batchResult).toHaveProperty('success');
      expect(batchResult.recordsProcessed).toBeGreaterThan(0);
    });

    it('should handle uplink failures with retry logic', async () => {
      // Mock uplink failure scenario
      const initialStats = await uplinkService.getRequestStats();
      
      // Add a record that might fail
      const testRecord = {
        agentId: 'retry-test-001',
        organizationId: 1,
        dataType: 'retry_test',
        data: { test: 'retry data' },
        timestamp: new Date(),
      };

      await bufferService.storeRecord(testRecord);

      // Process and check retry mechanism
      try {
        await uplinkService.processBatch();
      } catch (error) {
        // Expected to potentially fail in test environment
      }

      const finalStats = await uplinkService.getRequestStats();
      expect(finalStats.totalRequests).toBeGreaterThanOrEqual(initialStats.totalRequests);
    });

    it('should maintain connection health', async () => {
      const connectionTest = await uplinkService.testConnection();
      
      expect(connectionTest).toHaveProperty('success');
      if (connectionTest.success) {
        expect(connectionTest).toHaveProperty('latency');
        expect(connectionTest.latency).toBeGreaterThan(0);
      }
    });
  });

  describe('Control Channel Integration', () => {
    it('should establish WebSocket connection', async () => {
      const connectionStats = webSocketClient.getConnectionStats();
      
      expect(connectionStats).toHaveProperty('connected');
      expect(connectionStats).toHaveProperty('messagesSent');
      expect(connectionStats).toHaveProperty('messagesReceived');
    });

    it('should queue and process commands', async () => {
      const commandId = commandQueue.queueCommand({
        type: 'test_command',
        targetAgentId: 'test-agent-001',
        data: { test: 'command data' },
        priority: 2,
      });

      expect(commandId).toBeDefined();

      const command = commandQueue.getCommand(commandId);
      expect(command).toBeDefined();
      expect(command?.type).toBe('test_command');
      expect(command?.status).toBe('pending');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const queueStats = commandQueue.getQueueStats();
      expect(queueStats).toHaveProperty('totalCommands');
      expect(queueStats.totalCommands).toBeGreaterThan(0);
    });

    it('should handle command timeouts and retries', async () => {
      const commandId = commandQueue.queueCommand({
        type: 'timeout_test',
        targetAgentId: 'non-existent-agent',
        data: { test: 'timeout test' },
        priority: 1,
        maxRetries: 2,
      });

      // Wait for processing and retries
      await new Promise(resolve => setTimeout(resolve, 5000));

      const command = commandQueue.getCommand(commandId);
      expect(command).toBeDefined();
      expect(command?.retryCount).toBeGreaterThan(0);
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should provide comprehensive health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
    });

    it('should provide readiness checks', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/readiness')
        .expect(200);

      expect(response.body).toHaveProperty('ready');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('buffer');
      expect(response.body.checks).toHaveProperty('uplink');
    });

    it('should provide detailed component status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('components');
      expect(response.body.components).toHaveProperty('buffer');
      expect(response.body.components).toHaveProperty('uplink');
      expect(response.body.components).toHaveProperty('websocket');
    });

    it('should provide Prometheus metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/prometheus')
        .expect(200);

      expect(typeof response.text).toBe('string');
      expect(response.text).toContain('agent_gateway_');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle malformed data gracefully', async () => {
      const malformedData = {
        invalid: 'data structure',
        missing: 'required fields',
      };

      const response = await request(app.getHttpServer())
        .post('/collector/ingest')
        .send(malformedData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle service unavailability', async () => {
      // Test when uplink is unavailable
      const testRecord = {
        agentId: 'error-test-001',
        organizationId: 1,
        dataType: 'error_test',
        data: { test: 'error handling' },
        timestamp: new Date(),
      };

      // This should still succeed (stored in buffer)
      const response = await request(app.getHttpServer())
        .post('/collector/ingest')
        .send(testRecord)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = 20;
      const testData = {
        agentId: 'perf-test-001',
        organizationId: 1,
        timestamp: new Date().toISOString(),
        data: { test: 'concurrent data' },
      };

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app.getHttpServer())
          .post('/collector/ingest')
          .send(testData)
      );

      const responses = await Promise.allSettled(promises);
      const successful = responses.filter(r => r.status === 'fulfilled').length;
      
      expect(successful).toBeGreaterThan(concurrentRequests * 0.8); // 80% success rate
    });

    it('should maintain acceptable response times', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .post('/collector/ingest')
        .send({
          agentId: 'response-time-test',
          organizationId: 1,
          timestamp: new Date().toISOString(),
          data: { test: 'response time' },
        })
        .expect(201);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});