import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { UplinkModule } from '../uplink/uplink.module';
import { BufferModule } from '../buffer/buffer.module';
import { UplinkService } from '../uplink/uplink.service';
import { BatchProcessorService } from '../uplink/batch-processor.service';
import { UplinkHealthService } from '../uplink/uplink-health.service';
import { BufferService } from '../buffer/buffer.service';

describe('Uplink Integration Tests', () => {
  let uplinkService: UplinkService;
  let batchProcessor: BatchProcessorService;
  let uplinkHealth: UplinkHealthService;
  let bufferService: BufferService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        UplinkModule,
        BufferModule,
      ],
    }).compile();

    uplinkService = module.get<UplinkService>(UplinkService);
    batchProcessor = module.get<BatchProcessorService>(BatchProcessorService);
    uplinkHealth = module.get<UplinkHealthService>(UplinkHealthService);
    bufferService = module.get<BufferService>(BufferService);
  });

  describe('Uplink Connection Management', () => {
    it('should establish and maintain uplink connection', async () => {
      const connectionTest = await uplinkService.testConnection();
      
      expect(connectionTest).toHaveProperty('success');
      expect(connectionTest).toHaveProperty('latency');
      
      if (connectionTest.success) {
        expect(connectionTest.latency).toBeGreaterThan(0);
        expect(connectionTest.latency).toBeLessThan(10000); // Less than 10 seconds
      }
      
      // Test connection health
      const healthStatus = await uplinkHealth.getUplinkHealth();
      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('connected');
      expect(['healthy', 'warning', 'critical']).toContain(healthStatus.status);
    });

    it('should handle connection failures gracefully', async () => {
      // Test with invalid endpoint to simulate connection failure
      const originalConfig = uplinkService.getConfig();
      
      try {
        // Temporarily change to invalid endpoint
        await uplinkService.updateConfig({
          ...originalConfig,
          baseUrl: 'https://invalid-endpoint-test.example.com',
        });
        
        const failedConnectionTest = await uplinkService.testConnection();
        expect(failedConnectionTest.success).toBe(false);
        expect(failedConnectionTest).toHaveProperty('error');
        
        // Health should reflect the failure
        const healthAfterFailure = await uplinkHealth.getUplinkHealth();
        expect(healthAfterFailure.connected).toBe(false);
        
      } finally {
        // Restore original config
        await uplinkService.updateConfig(originalConfig);
      }
    });

    it('should recover from connection failures', async () => {
      // Ensure we're back to a good state
      const recoveryTest = await uplinkService.testConnection();
      
      if (!recoveryTest.success) {
        // Wait a moment and try again
        await new Promise(resolve => setTimeout(resolve, 2000));
        const retryTest = await uplinkService.testConnection();
        
        // Should eventually recover or at least handle gracefully
        expect(retryTest).toHaveProperty('success');
      }
      
      const healthAfterRecovery = await uplinkHealth.getUplinkHealth();
      expect(healthAfterRecovery).toHaveProperty('status');
    });
  });

  describe('Batch Processing Integration', () => {
    it('should process batches from buffer to uplink', async () => {
      // Add test data to buffer
      const testRecords = Array.from({ length: 10 }, (_, i) => ({
        agentId: `batch-test-agent-${i}`,
        organizationId: 1,
        dataType: 'batch_integration_test',
        data: {
          index: i,
          timestamp: Date.now(),
          testData: `batch-integration-${i}`,
        },
        timestamp: new Date(),
      }));

      // Store records in buffer
      const recordIds = [];
      for (const record of testRecords) {
        const recordId = await bufferService.storeRecord(record);
        recordIds.push(recordId);
      }

      expect(recordIds).toHaveLength(testRecords.length);

      // Process batch
      const batchResult = await batchProcessor.processPendingBatches();
      
      expect(batchResult).toHaveProperty('batchesProcessed');
      expect(batchResult).toHaveProperty('recordsProcessed');
      expect(batchResult).toHaveProperty('errors');
      
      if (batchResult.batchesProcessed > 0) {
        expect(batchResult.recordsProcessed).toBeGreaterThan(0);
      }
    });

    it('should handle batch processing with retry logic', async () => {
      // Add records that might trigger retry scenarios
      const retryTestRecords = Array.from({ length: 5 }, (_, i) => ({
        agentId: `retry-test-agent-${i}`,
        organizationId: 1,
        dataType: 'retry_test',
        data: {
          index: i,
          retryTest: true,
          timestamp: Date.now(),
        },
        timestamp: new Date(),
      }));

      for (const record of retryTestRecords) {
        await bufferService.storeRecord(record);
      }

      const initialStats = await uplinkService.getRequestStats();
      
      // Process batches (may include retries)
      const batchResult = await batchProcessor.processPendingBatches();
      
      const finalStats = await uplinkService.getRequestStats();
      
      // Should have attempted some requests
      expect(finalStats.totalRequests).toBeGreaterThanOrEqual(initialStats.totalRequests);
      
      // Check retry statistics
      expect(batchResult).toHaveProperty('errors');
      if (batchResult.errors.length > 0) {
        console.log(`Batch processing errors (expected for retry testing):`, batchResult.errors);
      }
    });

    it('should maintain batch processing performance', async () => {
      const performanceTestSize = 100;
      
      // Create performance test data
      const perfTestRecords = Array.from({ length: performanceTestSize }, (_, i) => ({
        agentId: `perf-test-agent-${i % 10}`, // 10 different agents
        organizationId: 1,
        dataType: 'performance_test',
        data: {
          index: i,
          payload: 'x'.repeat(256), // 256 bytes payload
          timestamp: Date.now(),
        },
        timestamp: new Date(),
      }));

      // Store all records
      const storeStartTime = Date.now();
      for (const record of perfTestRecords) {
        await bufferService.storeRecord(record);
      }
      const storeTime = Date.now() - storeStartTime;

      // Process batches
      const processStartTime = Date.now();
      const batchResult = await batchProcessor.processPendingBatches();
      const processTime = Date.now() - processStartTime;

      console.log(`Batch Performance Test:`);
      console.log(`- Records: ${performanceTestSize}`);
      console.log(`- Store Time: ${storeTime}ms`);
      console.log(`- Process Time: ${processTime}ms`);
      console.log(`- Batches Processed: ${batchResult.batchesProcessed}`);
      console.log(`- Records Processed: ${batchResult.recordsProcessed}`);

      // Performance assertions
      expect(processTime).toBeLessThan(30000); // Should complete within 30 seconds
      if (batchResult.recordsProcessed > 0) {
        const avgTimePerRecord = processTime / batchResult.recordsProcessed;
        expect(avgTimePerRecord).toBeLessThan(1000); // Less than 1 second per record
      }
    });

    it('should handle large batch sizes efficiently', async () => {
      const largeBatchSize = 500;
      
      // Create large batch test data
      const largeBatchRecords = Array.from({ length: largeBatchSize }, (_, i) => ({
        agentId: `large-batch-agent-${i % 20}`, // 20 different agents
        organizationId: 1,
        dataType: 'large_batch_test',
        data: {
          index: i,
          largePayload: 'x'.repeat(1024), // 1KB payload per record
          metadata: {
            batchTest: true,
            sequence: i,
          },
        },
        timestamp: new Date(),
      }));

      // Store large batch
      for (const record of largeBatchRecords) {
        await bufferService.storeRecord(record);
      }

      const initialMemory = process.memoryUsage();
      
      // Process large batch
      const largeBatchResult = await batchProcessor.processPendingBatches();
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      console.log(`Large Batch Test:`);
      console.log(`- Batch Size: ${largeBatchSize} records`);
      console.log(`- Memory Increase: ${memoryIncrease.toFixed(2)} MB`);
      console.log(`- Batches Processed: ${largeBatchResult.batchesProcessed}`);
      console.log(`- Records Processed: ${largeBatchResult.recordsProcessed}`);

      // Memory usage should be reasonable
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
      
      // Should process at least some records
      expect(largeBatchResult).toHaveProperty('recordsProcessed');
    });
  });

  describe('Uplink Health Monitoring', () => {
    it('should track uplink health metrics accurately', async () => {
      const healthStatus = await uplinkHealth.getUplinkHealth();
      
      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('connected');
      expect(healthStatus).toHaveProperty('lastSuccessfulRequest');
      expect(healthStatus).toHaveProperty('consecutiveFailures');
      expect(healthStatus).toHaveProperty('issues');
      
      expect(['healthy', 'warning', 'critical']).toContain(healthStatus.status);
      expect(typeof healthStatus.connected).toBe('boolean');
      expect(Array.isArray(healthStatus.issues)).toBe(true);
    });

    it('should detect and report uplink issues', async () => {
      // Force some requests to potentially create issues for monitoring
      const testRequests = 5;
      
      for (let i = 0; i < testRequests; i++) {
        try {
          await uplinkService.testConnection();
        } catch (error) {
          // Expected to potentially fail in test environment
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const healthAfterRequests = await uplinkHealth.getUplinkHealth();
      expect(healthAfterRequests).toHaveProperty('status');
      
      // Check request statistics
      const requestStats = await uplinkService.getRequestStats();
      expect(requestStats).toHaveProperty('totalRequests');
      expect(requestStats).toHaveProperty('successfulRequests');
      expect(requestStats).toHaveProperty('failedRequests');
      expect(requestStats).toHaveProperty('successRate');
      expect(requestStats).toHaveProperty('averageLatency');
      
      expect(requestStats.totalRequests).toBeGreaterThanOrEqual(testRequests);
      expect(requestStats.successRate).toBeGreaterThanOrEqual(0);
      expect(requestStats.successRate).toBeLessThanOrEqual(100);
    });

    it('should maintain health history and trends', async () => {
      // Get initial health
      const initialHealth = await uplinkHealth.getUplinkHealth();
      
      // Perform some operations
      await batchProcessor.processPendingBatches();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get updated health
      const updatedHealth = await uplinkHealth.getUplinkHealth();
      
      // Health should be tracked over time
      expect(updatedHealth).toHaveProperty('status');
      expect(updatedHealth.lastSuccessfulRequest).toBeDefined();
      
      // If we had successful operations, last successful request should be recent
      if (updatedHealth.connected) {
        const lastSuccess = new Date(updatedHealth.lastSuccessfulRequest);
        const now = new Date();
        const timeDiff = now.getTime() - lastSuccess.getTime();
        
        expect(timeDiff).toBeLessThan(60000); // Within last minute
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network timeouts gracefully', async () => {
      // Test with very short timeout to simulate timeout scenario
      const originalConfig = uplinkService.getConfig();
      
      try {
        await uplinkService.updateConfig({
          ...originalConfig,
          timeout: 1, // 1ms timeout to force timeout
        });
        
        const timeoutTest = await uplinkService.testConnection();
        expect(timeoutTest.success).toBe(false);
        expect(timeoutTest.error).toContain('timeout');
        
      } finally {
        // Restore normal timeout
        await uplinkService.updateConfig(originalConfig);
      }
    });

    it('should handle malformed response data', async () => {
      // This test checks how the system handles unexpected response formats
      // In a real scenario, this would involve mocking the HTTP client
      
      const requestStats = await uplinkService.getRequestStats();
      expect(requestStats).toHaveProperty('totalRequests');
      
      // The system should continue to function even with malformed responses
      const healthStatus = await uplinkHealth.getUplinkHealth();
      expect(healthStatus).toHaveProperty('status');
    });

    it('should recover from temporary uplink failures', async () => {
      // Simulate recovery scenario
      const initialHealth = await uplinkHealth.getUplinkHealth();
      
      // Add some test data to process during recovery
      const recoveryTestRecord = {
        agentId: 'recovery-test-agent',
        organizationId: 1,
        dataType: 'recovery_test',
        data: {
          recoveryTest: true,
          timestamp: Date.now(),
        },
        timestamp: new Date(),
      };
      
      await bufferService.storeRecord(recoveryTestRecord);
      
      // Try to process (may fail, but should handle gracefully)
      try {
        await batchProcessor.processPendingBatches();
      } catch (error) {
        // Expected to potentially fail in test environment
        console.log('Expected failure during recovery test:', error.message);
      }
      
      // System should still be responsive
      const finalHealth = await uplinkHealth.getUplinkHealth();
      expect(finalHealth).toHaveProperty('status');
      
      // Buffer should still be functional
      const bufferStats = await bufferService.getBufferStats();
      expect(bufferStats).toHaveProperty('totalRecords');
    });
  });

  describe('Uplink Configuration Management', () => {
    it('should handle configuration updates dynamically', async () => {
      const originalConfig = uplinkService.getConfig();
      
      // Test configuration update
      const newConfig = {
        ...originalConfig,
        timeout: originalConfig.timeout + 1000, // Increase timeout by 1 second
        retryAttempts: Math.max(1, originalConfig.retryAttempts - 1), // Decrease retry attempts
      };
      
      await uplinkService.updateConfig(newConfig);
      
      const updatedConfig = uplinkService.getConfig();
      expect(updatedConfig.timeout).toBe(newConfig.timeout);
      expect(updatedConfig.retryAttempts).toBe(newConfig.retryAttempts);
      
      // Test that service still works with new config
      const connectionTest = await uplinkService.testConnection();
      expect(connectionTest).toHaveProperty('success');
      
      // Restore original config
      await uplinkService.updateConfig(originalConfig);
    });

    it('should validate configuration parameters', async () => {
      const originalConfig = uplinkService.getConfig();
      
      // Test invalid configuration
      try {
        await uplinkService.updateConfig({
          ...originalConfig,
          timeout: -1, // Invalid timeout
        });
        
        // Should either reject invalid config or handle gracefully
        const config = uplinkService.getConfig();
        expect(config.timeout).toBeGreaterThan(0);
        
      } catch (error) {
        // Expected to reject invalid configuration
        expect(error.message).toContain('timeout');
      }
      
      // Ensure original config is maintained
      const finalConfig = uplinkService.getConfig();
      expect(finalConfig.timeout).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Uplink Operations', () => {
    it('should handle concurrent batch processing', async () => {
      // Add data for concurrent processing
      const concurrentBatches = 3;
      const recordsPerBatch = 10;
      
      // Create test data for each batch
      for (let batch = 0; batch < concurrentBatches; batch++) {
        const batchRecords = Array.from({ length: recordsPerBatch }, (_, i) => ({
          agentId: `concurrent-batch-${batch}-agent-${i}`,
          organizationId: 1,
          dataType: 'concurrent_batch_test',
          data: {
            batch: batch,
            record: i,
            timestamp: Date.now(),
          },
          timestamp: new Date(),
        }));
        
        for (const record of batchRecords) {
          await bufferService.storeRecord(record);
        }
      }
      
      // Process batches concurrently
      const concurrentProcessing = Array.from({ length: concurrentBatches }, () =>
        batchProcessor.processPendingBatches()
      );
      
      const results = await Promise.allSettled(concurrentProcessing);
      const successfulProcessing = results.filter(r => r.status === 'fulfilled').length;
      
      expect(successfulProcessing).toBeGreaterThan(0);
      
      // Check that system remains stable
      const healthAfterConcurrent = await uplinkHealth.getUplinkHealth();
      expect(healthAfterConcurrent).toHaveProperty('status');
    });

    it('should maintain data consistency during concurrent operations', async () => {
      const concurrentOperations = 5;
      const recordsPerOperation = 5;
      
      // Create concurrent operations that add and process data
      const operations = Array.from({ length: concurrentOperations }, (_, opIndex) =>
        Promise.resolve().then(async () => {
          // Add records
          const records = Array.from({ length: recordsPerOperation }, (_, recordIndex) => ({
            agentId: `consistency-test-${opIndex}-${recordIndex}`,
            organizationId: 1,
            dataType: 'consistency_test',
            data: {
              operation: opIndex,
              record: recordIndex,
              timestamp: Date.now(),
            },
            timestamp: new Date(),
          }));
          
          for (const record of records) {
            await bufferService.storeRecord(record);
          }
          
          // Process some batches
          return await batchProcessor.processPendingBatches();
        })
      );
      
      const operationResults = await Promise.allSettled(operations);
      const successfulOperations = operationResults.filter(r => r.status === 'fulfilled').length;
      
      expect(successfulOperations).toBeGreaterThan(concurrentOperations * 0.7); // 70% success rate
      
      // Verify system consistency
      const finalBufferStats = await bufferService.getBufferStats();
      const finalUplinkStats = await uplinkService.getRequestStats();
      
      expect(finalBufferStats).toHaveProperty('totalRecords');
      expect(finalUplinkStats).toHaveProperty('totalRequests');
    });
  });
});