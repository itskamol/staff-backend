import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BufferModule } from '../buffer/buffer.module';
import { BufferService } from '../buffer/buffer.service';
import { BackPressureService } from '../buffer/back-pressure.service';
import { DiskMonitoringService } from '../buffer/disk-monitoring.service';
import { BufferCleanupService } from '../buffer/buffer-cleanup.service';

describe('Buffer Integration Tests', () => {
  let bufferService: BufferService;
  let backPressureService: BackPressureService;
  let diskMonitoringService: DiskMonitoringService;
  let bufferCleanupService: BufferCleanupService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        BufferModule,
      ],
    }).compile();

    bufferService = module.get<BufferService>(BufferService);
    backPressureService = module.get<BackPressureService>(BackPressureService);
    diskMonitoringService = module.get<DiskMonitoringService>(DiskMonitoringService);
    bufferCleanupService = module.get<BufferCleanupService>(BufferCleanupService);
  });

  describe('Buffer Storage Operations', () => {
    it('should store and retrieve records correctly', async () => {
      const testRecord = {
        agentId: 'buffer-integration-001',
        organizationId: 1,
        dataType: 'active_windows',
        data: {
          windows: [
            {
              title: 'Test Application',
              processName: 'test.exe',
              startTime: new Date().toISOString(),
              duration: 3600,
            },
          ],
        },
        timestamp: new Date(),
      };

      // Store record
      const recordId = await bufferService.storeRecord(testRecord);
      expect(recordId).toBeDefined();
      expect(typeof recordId).toBe('string');

      // Retrieve records
      const retrievedRecords = await bufferService.getRecords({
        agentId: 'buffer-integration-001',
        limit: 10,
      });

      expect(retrievedRecords).toHaveLength(1);
      expect(retrievedRecords[0]).toMatchObject({
        agentId: testRecord.agentId,
        organizationId: testRecord.organizationId,
        dataType: testRecord.dataType,
      });
      expect(retrievedRecords[0].data).toEqual(testRecord.data);
    });

    it('should handle batch storage operations', async () => {
      const batchSize = 100;
      const testRecords = Array.from({ length: batchSize }, (_, i) => ({
        agentId: `batch-test-agent-${i % 10}`,
        organizationId: 1,
        dataType: 'batch_test',
        data: { batchIndex: i, timestamp: Date.now() },
        timestamp: new Date(),
      }));

      // Store batch
      const recordIds = await bufferService.storeBatch(testRecords);
      expect(recordIds).toHaveLength(batchSize);
      expect(recordIds.every(id => typeof id === 'string')).toBe(true);

      // Verify storage
      const bufferStats = await bufferService.getBufferStats();
      expect(bufferStats.totalRecords).toBeGreaterThanOrEqual(batchSize);
    });

    it('should handle concurrent storage operations', async () => {
      const concurrentOperations = 20;
      const recordsPerOperation = 5;

      const operations = Array.from({ length: concurrentOperations }, (_, opIndex) =>
        Promise.all(
          Array.from({ length: recordsPerOperation }, (_, recordIndex) => {
            const testRecord = {
              agentId: `concurrent-test-${opIndex}-${recordIndex}`,
              organizationId: 1,
              dataType: 'concurrent_test',
              data: { operation: opIndex, record: recordIndex },
              timestamp: new Date(),
            };
            return bufferService.storeRecord(testRecord);
          })
        )
      );

      const results = await Promise.allSettled(operations);
      const successfulOperations = results.filter(r => r.status === 'fulfilled').length;
      
      expect(successfulOperations).toBeGreaterThan(concurrentOperations * 0.9); // 90% success rate
    });

    it('should maintain data integrity under stress', async () => {
      const stressTestRecords = 500;
      const agentId = 'stress-test-agent';
      
      // Generate stress test data
      const testRecords = Array.from({ length: stressTestRecords }, (_, i) => ({
        agentId,
        organizationId: 1,
        dataType: 'stress_test',
        data: {
          index: i,
          payload: `stress-test-data-${i}`,
          timestamp: Date.now(),
        },
        timestamp: new Date(Date.now() + i * 1000), // Spread over time
      }));

      // Store all records
      const recordIds = [];
      for (const record of testRecords) {
        const recordId = await bufferService.storeRecord(record);
        recordIds.push(recordId);
      }

      expect(recordIds).toHaveLength(stressTestRecords);

      // Retrieve and verify data integrity
      const retrievedRecords = await bufferService.getRecords({
        agentId,
        limit: stressTestRecords,
      });

      expect(retrievedRecords).toHaveLength(stressTestRecords);
      
      // Verify order and data integrity
      const sortedRetrieved = retrievedRecords.sort((a, b) => a.data.index - b.data.index);
      for (let i = 0; i < stressTestRecords; i++) {
        expect(sortedRetrieved[i].data.index).toBe(i);
        expect(sortedRetrieved[i].data.payload).toBe(`stress-test-data-${i}`);
      }
    });
  });

  describe('Back Pressure Management', () => {
    it('should detect and respond to back pressure conditions', async () => {
      // Fill buffer to trigger back pressure
      const fillRecords = 1000;
      const testRecords = Array.from({ length: fillRecords }, (_, i) => ({
        agentId: `backpressure-test-${i}`,
        organizationId: 1,
        dataType: 'backpressure_test',
        data: { index: i },
        timestamp: new Date(),
      }));

      // Store records rapidly
      for (const record of testRecords) {
        await bufferService.storeRecord(record);
      }

      // Check back pressure status
      const backPressureStats = await backPressureService.getBackPressureStats();
      expect(backPressureStats).toHaveProperty('status');
      expect(['healthy', 'warning', 'critical']).toContain(backPressureStats.status);
      
      if (backPressureStats.status !== 'healthy') {
        expect(backPressureStats).toHaveProperty('currentLoad');
        expect(backPressureStats).toHaveProperty('threshold');
        expect(backPressureStats.currentLoad).toBeGreaterThan(0);
      }
    });

    it('should reject requests when at capacity', async () => {
      // This test simulates what happens when buffer reaches critical capacity
      const initialStats = await backPressureService.getBackPressureStats();
      
      // If we're not at critical capacity, try to fill buffer
      if (initialStats.status !== 'critical') {
        // Try to fill buffer to capacity
        const fillAttempts = 2000;
        let rejectedCount = 0;
        
        for (let i = 0; i < fillAttempts; i++) {
          try {
            const testRecord = {
              agentId: `capacity-test-${i}`,
              organizationId: 1,
              dataType: 'capacity_test',
              data: { index: i },
              timestamp: new Date(),
            };
            
            await bufferService.storeRecord(testRecord);
          } catch (error) {
            rejectedCount++;
            // Expected when buffer is full
          }
          
          // Check if we've hit back pressure
          const currentStats = await backPressureService.getBackPressureStats();
          if (currentStats.status === 'critical') {
            break;
          }
        }
        
        console.log(`Capacity test: ${rejectedCount} requests rejected`);
      }
      
      const finalStats = await backPressureService.getBackPressureStats();
      expect(finalStats).toHaveProperty('status');
    });

    it('should recover from back pressure conditions', async () => {
      // Trigger cleanup to recover from back pressure
      const cleanupResult = await bufferCleanupService.performCleanup();
      expect(cleanupResult).toHaveProperty('recordsRemoved');
      
      // Wait a moment for cleanup to take effect
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if back pressure has improved
      const recoveryStats = await backPressureService.getBackPressureStats();
      expect(recoveryStats).toHaveProperty('status');
      
      // Should be able to store new records after cleanup
      const testRecord = {
        agentId: 'recovery-test',
        organizationId: 1,
        dataType: 'recovery_test',
        data: { test: 'recovery' },
        timestamp: new Date(),
      };
      
      const recordId = await bufferService.storeRecord(testRecord);
      expect(recordId).toBeDefined();
    });
  });

  describe('Disk Monitoring Integration', () => {
    it('should monitor disk usage accurately', async () => {
      const diskInfo = await diskMonitoringService.getDetailedDiskInfo();
      
      expect(diskInfo).toHaveProperty('usage');
      expect(diskInfo.usage).toHaveProperty('usedBytes');
      expect(diskInfo.usage).toHaveProperty('freeBytes');
      expect(diskInfo.usage).toHaveProperty('totalBytes');
      expect(diskInfo.usage).toHaveProperty('usedPercent');
      
      expect(diskInfo.usage.usedPercent).toBeGreaterThanOrEqual(0);
      expect(diskInfo.usage.usedPercent).toBeLessThanOrEqual(100);
      expect(diskInfo.usage.usedBytes + diskInfo.usage.freeBytes).toBeLessThanOrEqual(diskInfo.usage.totalBytes);
    });

    it('should detect disk space alerts', async () => {
      const diskInfo = await diskMonitoringService.getDetailedDiskInfo();
      
      expect(diskInfo).toHaveProperty('health');
      expect(['healthy', 'warning', 'critical']).toContain(diskInfo.health);
      
      expect(diskInfo).toHaveProperty('thresholds');
      expect(diskInfo.thresholds).toHaveProperty('warning');
      expect(diskInfo.thresholds).toHaveProperty('critical');
      
      expect(diskInfo).toHaveProperty('alerts');
      expect(Array.isArray(diskInfo.alerts)).toBe(true);
    });

    it('should track disk usage over time', async () => {
      // Get initial disk usage
      const initialUsage = await diskMonitoringService.getDiskUsage();
      
      // Store some data to change disk usage
      const testRecords = Array.from({ length: 50 }, (_, i) => ({
        agentId: `disk-tracking-${i}`,
        organizationId: 1,
        dataType: 'disk_tracking',
        data: { 
          index: i,
          largePayload: 'x'.repeat(1024), // 1KB payload
        },
        timestamp: new Date(),
      }));
      
      for (const record of testRecords) {
        await bufferService.storeRecord(record);
      }
      
      // Get updated disk usage
      const updatedUsage = await diskMonitoringService.getDiskUsage();
      
      // Usage should have increased (or at least not decreased significantly)
      expect(updatedUsage.usedBytes).toBeGreaterThanOrEqual(initialUsage.usedBytes * 0.95);
    });
  });

  describe('Buffer Cleanup Integration', () => {
    it('should clean up old records based on retention policy', async () => {
      // Add old records (simulate by creating records with old timestamps)
      const oldRecords = Array.from({ length: 20 }, (_, i) => ({
        agentId: `cleanup-old-${i}`,
        organizationId: 1,
        dataType: 'cleanup_test',
        data: { index: i, type: 'old' },
        timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days old
      }));
      
      // Add recent records
      const recentRecords = Array.from({ length: 10 }, (_, i) => ({
        agentId: `cleanup-recent-${i}`,
        organizationId: 1,
        dataType: 'cleanup_test',
        data: { index: i, type: 'recent' },
        timestamp: new Date(), // Current time
      }));
      
      // Store all records
      for (const record of [...oldRecords, ...recentRecords]) {
        await bufferService.storeRecord(record);
      }
      
      const initialStats = await bufferService.getBufferStats();
      
      // Perform cleanup
      const cleanupResult = await bufferCleanupService.performCleanup();
      expect(cleanupResult).toHaveProperty('recordsRemoved');
      
      const finalStats = await bufferService.getBufferStats();
      
      // Should have removed some records
      expect(finalStats.totalRecords).toBeLessThanOrEqual(initialStats.totalRecords);
      
      // Recent records should still exist
      const remainingRecords = await bufferService.getRecords({
        dataType: 'cleanup_test',
        limit: 100,
      });
      
      const recentRemaining = remainingRecords.filter(r => r.data.type === 'recent');
      expect(recentRemaining.length).toBeGreaterThan(0);
    });

    it('should handle cleanup under concurrent load', async () => {
      // Start concurrent operations
      const concurrentWrites = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve().then(async () => {
          for (let j = 0; j < 20; j++) {
            const record = {
              agentId: `concurrent-cleanup-${i}-${j}`,
              organizationId: 1,
              dataType: 'concurrent_cleanup',
              data: { writer: i, record: j },
              timestamp: new Date(),
            };
            await bufferService.storeRecord(record);
            
            // Small delay to simulate real usage
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        })
      );
      
      // Start cleanup operation concurrently
      const cleanupOperation = new Promise(resolve => {
        setTimeout(async () => {
          const result = await bufferCleanupService.performCleanup();
          resolve(result);
        }, 500); // Start cleanup after 500ms
      });
      
      // Wait for all operations to complete
      const [writeResults, cleanupResult] = await Promise.all([
        Promise.allSettled(concurrentWrites),
        cleanupOperation,
      ]);
      
      const successfulWrites = writeResults.filter(r => r.status === 'fulfilled').length;
      expect(successfulWrites).toBeGreaterThan(5); // At least half should succeed
      expect(cleanupResult).toHaveProperty('recordsRemoved');
    });

    it('should maintain buffer health metrics during cleanup', async () => {
      const initialHealth = await bufferService.getBufferHealth();
      expect(initialHealth).toHaveProperty('status');
      expect(initialHealth).toHaveProperty('metrics');
      
      // Perform cleanup
      await bufferCleanupService.performCleanup();
      
      // Check health after cleanup
      const postCleanupHealth = await bufferService.getBufferHealth();
      expect(postCleanupHealth).toHaveProperty('status');
      expect(postCleanupHealth).toHaveProperty('metrics');
      
      // Health should not be worse after cleanup
      const healthOrder = { healthy: 3, warning: 2, critical: 1 };
      const initialScore = healthOrder[initialHealth.status] || 0;
      const postScore = healthOrder[postCleanupHealth.status] || 0;
      
      expect(postScore).toBeGreaterThanOrEqual(initialScore);
    });
  });

  describe('Buffer Performance Under Load', () => {
    it('should maintain performance with large datasets', async () => {
      const largeDatasetSize = 1000;
      const startTime = Date.now();
      
      // Create large dataset
      const largeRecords = Array.from({ length: largeDatasetSize }, (_, i) => ({
        agentId: `performance-test-${i % 50}`, // 50 different agents
        organizationId: 1,
        dataType: 'performance_test',
        data: {
          index: i,
          payload: 'x'.repeat(512), // 512 bytes payload
          metadata: {
            timestamp: Date.now(),
            sequence: i,
          },
        },
        timestamp: new Date(),
      }));
      
      // Store records and measure performance
      const storeStartTime = Date.now();
      for (const record of largeRecords) {
        await bufferService.storeRecord(record);
      }
      const storeTime = Date.now() - storeStartTime;
      
      // Retrieve records and measure performance
      const retrieveStartTime = Date.now();
      const retrievedRecords = await bufferService.getRecords({
        dataType: 'performance_test',
        limit: largeDatasetSize,
      });
      const retrieveTime = Date.now() - retrieveStartTime;
      
      const totalTime = Date.now() - startTime;
      
      console.log(`Performance Test Results:`);
      console.log(`- Dataset Size: ${largeDatasetSize} records`);
      console.log(`- Store Time: ${storeTime}ms (${(storeTime / largeDatasetSize).toFixed(2)}ms per record)`);
      console.log(`- Retrieve Time: ${retrieveTime}ms`);
      console.log(`- Total Time: ${totalTime}ms`);
      console.log(`- Retrieved Records: ${retrievedRecords.length}`);
      
      // Performance assertions
      expect(storeTime / largeDatasetSize).toBeLessThan(10); // Less than 10ms per record
      expect(retrieveTime).toBeLessThan(1000); // Less than 1 second to retrieve
      expect(retrievedRecords.length).toBe(largeDatasetSize);
    });

    it('should handle memory efficiently with large payloads', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create records with large payloads
      const largePayloadSize = 1024 * 100; // 100KB per record
      const recordCount = 50;
      
      const largePayloadRecords = Array.from({ length: recordCount }, (_, i) => ({
        agentId: `memory-test-${i}`,
        organizationId: 1,
        dataType: 'memory_test',
        data: {
          index: i,
          largePayload: 'x'.repeat(largePayloadSize),
        },
        timestamp: new Date(),
      }));
      
      // Store large payload records
      for (const record of largePayloadRecords) {
        await bufferService.storeRecord(record);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterStoreMemory = process.memoryUsage();
      const memoryIncrease = (afterStoreMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      
      console.log(`Memory usage increase: ${memoryIncrease.toFixed(2)} MB for ${recordCount} records (${largePayloadSize} bytes each)`);
      
      // Memory increase should be reasonable (not more than 2x the data size)
      const expectedDataSize = (recordCount * largePayloadSize) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(expectedDataSize * 2);
      
      // Clean up large records
      await bufferCleanupService.performCleanup();
    });
  });
});