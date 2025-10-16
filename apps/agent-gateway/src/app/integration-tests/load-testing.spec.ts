import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { BufferModule } from '../buffer/buffer.module';
import { UplinkModule } from '../uplink/uplink.module';
import { ControlChannelModule } from '../control-channel/control-channel.module';
import { CollectorModule } from '../collector/collector.module';
import { WebSocketClientService } from '../control-channel/websocket-client.service';
import { BufferService } from '../buffer/buffer.service';
import { PerformanceTrackingService } from '../health/performance-tracking.service';

describe('Load Testing', () => {
  let app: INestApplication;
  let webSocketClient: WebSocketClientService;
  let bufferService: BufferService;
  let performanceTracking: PerformanceTrackingService;

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
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    webSocketClient = moduleFixture.get<WebSocketClientService>(WebSocketClientService);
    bufferService = moduleFixture.get<BufferService>(BufferService);
    performanceTracking = moduleFixture.get<PerformanceTrackingService>(PerformanceTrackingService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('HTTP Load Testing', () => {
    it('should handle 100 requests per second for 60 seconds', async () => {
      const targetRPS = 100;
      const testDurationSeconds = 60;
      const totalRequests = targetRPS * testDurationSeconds;
      
      console.log(`Starting load test: ${targetRPS} RPS for ${testDurationSeconds}s (${totalRequests} total requests)`);
      
      const startTime = Date.now();
      const results = {
        successful: 0,
        failed: 0,
        responseTimes: [] as number[],
        errors: [] as string[],
      };

      // Generate test data
      const generateTestData = (index: number) => ({
        agentId: `load-test-agent-${index % 10}`, // 10 different agents
        organizationId: 1,
        timestamp: new Date().toISOString(),
        data: {
          activeWindows: [{
            title: `Test Window ${index}`,
            processName: 'test.exe',
            startTime: new Date().toISOString(),
            duration: Math.floor(Math.random() * 3600),
          }],
          visitedSites: [{
            url: `https://example-${index % 100}.com`,
            title: `Test Site ${index}`,
            visitTime: new Date().toISOString(),
            duration: Math.floor(Math.random() * 300),
          }],
        },
      });

      // Execute load test
      const batchSize = 10; // Process in batches to avoid overwhelming
      const batchDelay = (1000 / targetRPS) * batchSize; // Delay between batches

      for (let batch = 0; batch < totalRequests / batchSize; batch++) {
        const batchPromises = [];
        
        for (let i = 0; i < batchSize; i++) {
          const requestIndex = batch * batchSize + i;
          const testData = generateTestData(requestIndex);
          
          const requestStartTime = Date.now();
          
          const promise = request(app.getHttpServer())
            .post('/collector/ingest')
            .send(testData)
            .then(response => {
              const responseTime = Date.now() - requestStartTime;
              results.responseTimes.push(responseTime);
              
              if (response.status === 201) {
                results.successful++;
              } else {
                results.failed++;
                results.errors.push(`Status ${response.status}: ${response.text}`);
              }
            })
            .catch(error => {
              const responseTime = Date.now() - requestStartTime;
              results.responseTimes.push(responseTime);
              results.failed++;
              results.errors.push(error.message);
            });
          
          batchPromises.push(promise);
        }
        
        // Wait for batch to complete
        await Promise.allSettled(batchPromises);
        
        // Delay before next batch (rate limiting)
        if (batch < (totalRequests / batchSize) - 1) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
        
        // Log progress every 10 batches
        if (batch % 10 === 0) {
          const progress = ((batch + 1) * batchSize / totalRequests * 100).toFixed(1);
          console.log(`Progress: ${progress}% (${results.successful} successful, ${results.failed} failed)`);
        }
      }

      const totalTime = Date.now() - startTime;
      const actualRPS = (results.successful + results.failed) / (totalTime / 1000);
      
      // Calculate statistics
      const responseTimes = results.responseTimes.sort((a, b) => a - b);
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)];
      const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)];
      const successRate = (results.successful / (results.successful + results.failed)) * 100;

      console.log('Load Test Results:');
      console.log(`- Total Requests: ${results.successful + results.failed}`);
      console.log(`- Successful: ${results.successful} (${successRate.toFixed(2)}%)`);
      console.log(`- Failed: ${results.failed}`);
      console.log(`- Actual RPS: ${actualRPS.toFixed(2)}`);
      console.log(`- Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`- 95th Percentile: ${p95ResponseTime}ms`);
      console.log(`- 99th Percentile: ${p99ResponseTime}ms`);
      console.log(`- Test Duration: ${(totalTime / 1000).toFixed(2)}s`);

      // Assertions
      expect(successRate).toBeGreaterThan(95); // 95% success rate
      expect(avgResponseTime).toBeLessThan(500); // Average response time under 500ms
      expect(p95ResponseTime).toBeLessThan(1000); // 95th percentile under 1s
      expect(actualRPS).toBeGreaterThan(targetRPS * 0.8); // At least 80% of target RPS

      // Check buffer health after load test
      const bufferStats = await bufferService.getBufferStats();
      expect(bufferStats.totalRecords).toBeGreaterThan(0);
      
      const bufferHealth = await bufferService.getBufferHealth();
      expect(bufferHealth.status).not.toBe('critical');
    }, 120000); // 2 minute timeout

    it('should handle burst traffic patterns', async () => {
      console.log('Testing burst traffic pattern...');
      
      const burstSize = 50;
      const burstCount = 5;
      const burstInterval = 2000; // 2 seconds between bursts
      
      const results = {
        successful: 0,
        failed: 0,
        responseTimes: [] as number[],
      };

      for (let burst = 0; burst < burstCount; burst++) {
        console.log(`Executing burst ${burst + 1}/${burstCount} (${burstSize} requests)`);
        
        const burstPromises = Array.from({ length: burstSize }, (_, i) => {
          const testData = {
            agentId: `burst-test-agent-${i}`,
            organizationId: 1,
            timestamp: new Date().toISOString(),
            data: { burst: burst, request: i },
          };
          
          const requestStartTime = Date.now();
          
          return request(app.getHttpServer())
            .post('/collector/ingest')
            .send(testData)
            .then(response => {
              const responseTime = Date.now() - requestStartTime;
              results.responseTimes.push(responseTime);
              
              if (response.status === 201) {
                results.successful++;
              } else {
                results.failed++;
              }
            })
            .catch(() => {
              const responseTime = Date.now() - requestStartTime;
              results.responseTimes.push(responseTime);
              results.failed++;
            });
        });
        
        await Promise.allSettled(burstPromises);
        
        // Wait between bursts
        if (burst < burstCount - 1) {
          await new Promise(resolve => setTimeout(resolve, burstInterval));
        }
      }

      const successRate = (results.successful / (results.successful + results.failed)) * 100;
      const avgResponseTime = results.responseTimes.reduce((sum, time) => sum + time, 0) / results.responseTimes.length;
      
      console.log(`Burst Test Results: ${successRate.toFixed(2)}% success rate, ${avgResponseTime.toFixed(2)}ms avg response time`);
      
      expect(successRate).toBeGreaterThan(90); // 90% success rate for burst traffic
      expect(avgResponseTime).toBeLessThan(1000); // Average response time under 1s
    }, 60000);
  });

  describe('WebSocket Stability Testing', () => {
    it('should maintain WebSocket connection for 24 hours (simulated)', async () => {
      // Simulate 24-hour test by running for shorter duration with accelerated timeline
      const testDurationMs = 60000; // 1 minute test
      const heartbeatInterval = 1000; // 1 second heartbeats (normally 30s)
      const expectedHeartbeats = Math.floor(testDurationMs / heartbeatInterval);
      
      console.log(`Starting WebSocket stability test (${testDurationMs / 1000}s duration, ${expectedHeartbeats} expected heartbeats)`);
      
      let heartbeatCount = 0;
      let connectionDrops = 0;
      let reconnections = 0;
      
      // Monitor connection events
      const connectionHandler = () => {
        reconnections++;
        console.log(`WebSocket reconnected (${reconnections} total reconnections)`);
      };
      
      const disconnectionHandler = () => {
        connectionDrops++;
        console.log(`WebSocket disconnected (${connectionDrops} total drops)`);
      };
      
      webSocketClient.on('connected', connectionHandler);
      webSocketClient.on('disconnected', disconnectionHandler);
      
      const startTime = Date.now();
      
      // Send periodic heartbeats and monitor connection
      const heartbeatTimer = setInterval(() => {
        if (webSocketClient.isConnected()) {
          const success = webSocketClient.sendHeartbeat();
          if (success) {
            heartbeatCount++;
          }
        }
        
        // Log progress every 10 heartbeats
        if (heartbeatCount % 10 === 0) {
          const elapsed = Date.now() - startTime;
          const progress = (elapsed / testDurationMs * 100).toFixed(1);
          console.log(`Progress: ${progress}% (${heartbeatCount} heartbeats sent)`);
        }
      }, heartbeatInterval);
      
      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, testDurationMs));
      
      clearInterval(heartbeatTimer);
      
      // Remove event listeners
      webSocketClient.off('connected', connectionHandler);
      webSocketClient.off('disconnected', disconnectionHandler);
      
      const connectionStats = webSocketClient.getConnectionStats();
      const uptime = (Date.now() - startTime) / 1000;
      const heartbeatSuccessRate = (heartbeatCount / expectedHeartbeats) * 100;
      
      console.log('WebSocket Stability Test Results:');
      console.log(`- Test Duration: ${uptime.toFixed(2)}s`);
      console.log(`- Heartbeats Sent: ${heartbeatCount}/${expectedHeartbeats} (${heartbeatSuccessRate.toFixed(2)}%)`);
      console.log(`- Connection Drops: ${connectionDrops}`);
      console.log(`- Reconnections: ${reconnections}`);
      console.log(`- Final Connection Status: ${connectionStats.connected ? 'Connected' : 'Disconnected'}`);
      console.log(`- Messages Sent: ${connectionStats.messagesSent}`);
      console.log(`- Messages Received: ${connectionStats.messagesReceived}`);
      console.log(`- Average Latency: ${connectionStats.latency}ms`);
      
      // Assertions
      expect(heartbeatSuccessRate).toBeGreaterThan(80); // 80% heartbeat success rate
      expect(connectionDrops).toBeLessThan(5); // Less than 5 connection drops
      expect(connectionStats.connected).toBe(true); // Should be connected at the end
      
      if (connectionStats.latency > 0) {
        expect(connectionStats.latency).toBeLessThan(5000); // Latency under 5 seconds
      }
    }, 90000); // 1.5 minute timeout

    it('should handle WebSocket message flooding', async () => {
      const messageCount = 1000;
      const batchSize = 50;
      const batchDelay = 100; // 100ms between batches
      
      console.log(`Testing WebSocket message flooding (${messageCount} messages)`);
      
      let messagesSent = 0;
      let messagesSuccessful = 0;
      
      for (let batch = 0; batch < messageCount / batchSize; batch++) {
        for (let i = 0; i < batchSize; i++) {
          const message = {
            type: 'test_flood',
            data: {
              batch: batch,
              message: i,
              timestamp: Date.now(),
            },
            timestamp: new Date(),
          };
          
          const success = webSocketClient.sendMessage(message);
          messagesSent++;
          
          if (success) {
            messagesSuccessful++;
          }
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, batchDelay));
        
        // Log progress
        if (batch % 5 === 0) {
          const progress = ((batch + 1) * batchSize / messageCount * 100).toFixed(1);
          console.log(`Flood test progress: ${progress}% (${messagesSuccessful}/${messagesSent} successful)`);
        }
      }
      
      const successRate = (messagesSuccessful / messagesSent) * 100;
      
      console.log(`Message Flooding Results: ${messagesSuccessful}/${messagesSent} (${successRate.toFixed(2)}% success rate)`);
      
      expect(successRate).toBeGreaterThan(95); // 95% message success rate
      expect(webSocketClient.isConnected()).toBe(true); // Connection should still be alive
    }, 30000);
  });

  describe('Memory and Resource Testing', () => {
    it('should not have memory leaks during sustained load', async () => {
      const initialMemory = process.memoryUsage();
      console.log(`Initial memory usage: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      
      // Run sustained load for memory leak detection
      const requestCount = 500;
      const batchSize = 25;
      
      for (let batch = 0; batch < requestCount / batchSize; batch++) {
        const promises = Array.from({ length: batchSize }, (_, i) => {
          const testData = {
            agentId: `memory-test-${batch}-${i}`,
            organizationId: 1,
            timestamp: new Date().toISOString(),
            data: { memoryTest: true, batch, request: i },
          };
          
          return request(app.getHttpServer())
            .post('/collector/ingest')
            .send(testData);
        });
        
        await Promise.allSettled(promises);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Check memory every 10 batches
        if (batch % 10 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryIncrease = (currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
          console.log(`Batch ${batch}: Memory usage: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB (+${memoryIncrease.toFixed(2)} MB)`);
        }
      }
      
      // Final memory check
      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      
      console.log(`Final memory usage: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB (+${memoryIncrease.toFixed(2)} MB)`);
      
      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100);
      
      // Check buffer stats to ensure it's not growing indefinitely
      const bufferStats = await bufferService.getBufferStats();
      expect(bufferStats.totalRecords).toBeLessThan(requestCount * 2); // Should have been processed/cleaned up
    }, 60000);

    it('should handle resource exhaustion gracefully', async () => {
      // Test behavior when system resources are under pressure
      const heavyPayloadSize = 1024 * 1024; // 1MB payload
      const heavyPayload = 'x'.repeat(heavyPayloadSize);
      
      const testData = {
        agentId: 'resource-exhaustion-test',
        organizationId: 1,
        timestamp: new Date().toISOString(),
        data: {
          heavyData: heavyPayload,
          metadata: { size: heavyPayloadSize },
        },
      };
      
      // Send multiple heavy requests
      const heavyRequests = 10;
      const promises = Array.from({ length: heavyRequests }, () =>
        request(app.getHttpServer())
          .post('/collector/ingest')
          .send(testData)
          .timeout(10000) // 10 second timeout
      );
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`Resource exhaustion test: ${successful} successful, ${failed} failed out of ${heavyRequests} heavy requests`);
      
      // Should handle at least some requests gracefully
      expect(successful).toBeGreaterThan(0);
      
      // System should still be responsive after heavy load
      const lightTestData = {
        agentId: 'post-exhaustion-test',
        organizationId: 1,
        timestamp: new Date().toISOString(),
        data: { test: 'light payload' },
      };
      
      const response = await request(app.getHttpServer())
        .post('/collector/ingest')
        .send(lightTestData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
    }, 30000);
  });
});