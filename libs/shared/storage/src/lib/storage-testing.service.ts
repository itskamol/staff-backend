import { Injectable, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IFileStorageService } from './file-storage.interface';
import { FileStorageFactory, StorageDriver } from './file-storage.factory';
import { StorageMigrationService } from './storage-migration.service';
import { EncryptionService } from './encryption.service';
import { RetentionService, RetentionAction } from './retention.service';
import * as crypto from 'crypto';

export interface StorageTestResult {
  testName: string;
  driver: StorageDriver;
  passed: boolean;
  duration: number;
  details: string;
  error?: string;
}

export interface StorageTestSuite {
  suiteName: string;
  driver: StorageDriver;
  results: StorageTestResult[];
  overallPassed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalDuration: number;
}

export interface LoadTestResult {
  driver: StorageDriver;
  concurrentOperations: number;
  totalOperations: number;
  duration: number;
  throughput: number; // operations per second
  averageLatency: number;
  maxLatency: number;
  errorRate: number;
  errors: string[];
}

@Injectable()
export class StorageTestingService {
  private readonly logger = new Logger(StorageTestingService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly storageFactory: FileStorageFactory,
    private readonly migrationService: StorageMigrationService,
    private readonly encryptionService: EncryptionService,
    private readonly retentionService: RetentionService,
  ) {}

  async runComprehensiveStorageTests(): Promise<StorageTestSuite[]> {
    this.logger.log('Starting comprehensive storage test suite');

    const drivers: StorageDriver[] = ['local', 's3', 'minio'];
    const suites: StorageTestSuite[] = [];

    for (const driver of drivers) {
      try {
        // Validate driver configuration first
        const validation = await this.storageFactory.validateConfiguration(driver);
        if (!validation.valid) {
          this.logger.warn(`Skipping ${driver} tests due to configuration issues: ${validation.errors.join(', ')}`);
          continue;
        }

        const suite = await this.runStorageTestSuite(driver);
        suites.push(suite);
      } catch (error) {
        this.logger.error(`Failed to run tests for ${driver}: ${error.message}`);
        
        // Create failed suite
        suites.push({
          suiteName: `${driver.toUpperCase()} Storage Tests`,
          driver,
          results: [{
            testName: 'Configuration Test',
            driver,
            passed: false,
            duration: 0,
            details: 'Driver configuration failed',
            error: error.message,
          }],
          overallPassed: false,
          totalTests: 1,
          passedTests: 0,
          failedTests: 1,
          totalDuration: 0,
        });
      }
    }

    this.logger.log('Comprehensive storage tests completed');
    return suites;
  }

  async runStorageTestSuite(driver: StorageDriver): Promise<StorageTestSuite> {
    const startTime = Date.now();
    const results: StorageTestResult[] = [];

    // Basic functionality tests
    results.push(await this.testBasicUploadDownload(driver));
    results.push(await this.testFileMetadata(driver));
    results.push(await this.testFileExists(driver));
    results.push(await this.testFileList(driver));
    results.push(await this.testFileCopyMove(driver));
    results.push(await this.testFileDelete(driver));

    // Advanced functionality tests
    results.push(await this.testEncryption(driver));
    results.push(await this.testRangeRequests(driver));
    results.push(await this.testPresignedUrls(driver));
    results.push(await this.testLargeFiles(driver));

    // Error handling tests
    results.push(await this.testErrorHandling(driver));
    results.push(await this.testConcurrentAccess(driver));

    const totalDuration = Date.now() - startTime;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.filter(r => !r.passed).length;

    return {
      suiteName: `${driver.toUpperCase()} Storage Tests`,
      driver,
      results,
      overallPassed: failedTests === 0,
      totalTests: results.length,
      passedTests,
      failedTests,
      totalDuration,
    };
  }

  private async testBasicUploadDownload(driver: StorageDriver): Promise<StorageTestResult> {
    const startTime = Date.now();
    
    try {
      const storage = this.storageFactory.create(driver);
      const testData = Buffer.from('Hello, World! This is a test file.');
      const testPath = `test/basic-${Date.now()}.txt`;

      // Upload
      const etag = await storage.upload(testData, testPath, {
        contentType: 'text/plain',
        metadata: { organizationId: 1 },
      });

      // Download
      const downloadedData = await storage.download(testPath);

      // Verify
      const dataMatches = testData.equals(downloadedData);
      const hasEtag = !!etag;

      // Cleanup
      await storage.delete(testPath);

      const passed = dataMatches && hasEtag;
      const duration = Date.now() - startTime;

      return {
        testName: 'Basic Upload/Download',
        driver,
        passed,
        duration,
        details: `Data matches: ${dataMatches}, ETag: ${hasEtag}`,
      };
    } catch (error) {
      return {
        testName: 'Basic Upload/Download',
        driver,
        passed: false,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error.message,
      };
    }
  }

  private async testFileMetadata(driver: StorageDriver): Promise<StorageTestResult> {
    const startTime = Date.now();
    
    try {
      const storage = this.storageFactory.create(driver);
      const testData = Buffer.from('Metadata test file');
      const testPath = `test/metadata-${Date.now()}.txt`;
      const testMetadata = {
        organizationId: 1,
        uploadedBy: 123,
        tags: { category: 'test', priority: 'high' },
      };

      // Upload with metadata
      await storage.upload(testData, testPath, {
        contentType: 'text/plain',
        metadata: testMetadata,
      });

      // Get metadata
      const retrievedMetadata = await storage.getMetadata(testPath);

      // Verify metadata
      const orgIdMatches = retrievedMetadata?.organizationId === testMetadata.organizationId;
      const uploadedByMatches = retrievedMetadata?.uploadedBy === testMetadata.uploadedBy;
      const contentTypeMatches = retrievedMetadata?.contentType === 'text/plain';

      // Cleanup
      await storage.delete(testPath);

      const passed = orgIdMatches && uploadedByMatches && contentTypeMatches;
      const duration = Date.now() - startTime;

      return {
        testName: 'File Metadata',
        driver,
        passed,
        duration,
        details: `OrgId: ${orgIdMatches}, UploadedBy: ${uploadedByMatches}, ContentType: ${contentTypeMatches}`,
      };
    } catch (error) {
      return {
        testName: 'File Metadata',
        driver,
        passed: false,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error.message,
      };
    }
  }

  private async testFileExists(driver: StorageDriver): Promise<StorageTestResult> {
    const startTime = Date.now();
    
    try {
      const storage = this.storageFactory.create(driver);
      const testData = Buffer.from('Exists test file');
      const testPath = `test/exists-${Date.now()}.txt`;

      // Test non-existent file
      const existsBeforeUpload = await storage.exists(testPath);

      // Upload file
      await storage.upload(testData, testPath);

      // Test existing file
      const existsAfterUpload = await storage.exists(testPath);

      // Delete file
      await storage.delete(testPath);

      // Test deleted file
      const existsAfterDelete = await storage.exists(testPath);

      const passed = !existsBeforeUpload && existsAfterUpload && !existsAfterDelete;
      const duration = Date.now() - startTime;

      return {
        testName: 'File Exists Check',
        driver,
        passed,
        duration,
        details: `Before: ${!existsBeforeUpload}, After: ${existsAfterUpload}, Deleted: ${!existsAfterDelete}`,
      };
    } catch (error) {
      return {
        testName: 'File Exists Check',
        driver,
        passed: false,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error.message,
      };
    }
  }

  private async testFileList(driver: StorageDriver): Promise<StorageTestResult> {
    const startTime = Date.now();
    
    try {
      const storage = this.storageFactory.create(driver);
      const testPrefix = `test/list-${Date.now()}`;
      const testFiles = ['file1.txt', 'file2.txt', 'subdir/file3.txt'];

      // Upload test files
      for (const fileName of testFiles) {
        const filePath = `${testPrefix}/${fileName}`;
        await storage.upload(Buffer.from(`Content of ${fileName}`), filePath);
      }

      // List files with prefix
      const listResult = await storage.list({
        prefix: testPrefix,
        recursive: true,
      });

      // Verify all files are listed
      const listedPaths = listResult.files.map(f => f.path);
      const allFilesListed = testFiles.every(fileName => 
        listedPaths.some(path => path.endsWith(fileName))
      );

      // Cleanup
      for (const fileName of testFiles) {
        const filePath = `${testPrefix}/${fileName}`;
        await storage.delete(filePath);
      }

      const passed = allFilesListed && listResult.files.length >= testFiles.length;
      const duration = Date.now() - startTime;

      return {
        testName: 'File List',
        driver,
        passed,
        duration,
        details: `Listed ${listResult.files.length} files, expected ${testFiles.length}`,
      };
    } catch (error) {
      return {
        testName: 'File List',
        driver,
        passed: false,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error.message,
      };
    }
  }

  private async testFileCopyMove(driver: StorageDriver): Promise<StorageTestResult> {
    const startTime = Date.now();
    
    try {
      const storage = this.storageFactory.create(driver);
      const testData = Buffer.from('Copy/Move test file');
      const sourcePath = `test/copy-source-${Date.now()}.txt`;
      const copyPath = `test/copy-dest-${Date.now()}.txt`;
      const movePath = `test/move-dest-${Date.now()}.txt`;

      // Upload source file
      await storage.upload(testData, sourcePath);

      // Test copy
      await storage.copy(sourcePath, copyPath);
      const copyExists = await storage.exists(copyPath);
      const sourceStillExists = await storage.exists(sourcePath);

      // Test move
      await storage.move(copyPath, movePath);
      const moveExists = await storage.exists(movePath);
      const copyNoLongerExists = !(await storage.exists(copyPath));

      // Verify moved file content
      const movedData = await storage.download(movePath);
      const contentMatches = testData.equals(movedData);

      // Cleanup
      await storage.delete(sourcePath);
      await storage.delete(movePath);

      const passed = copyExists && sourceStillExists && moveExists && copyNoLongerExists && contentMatches;
      const duration = Date.now() - startTime;

      return {
        testName: 'File Copy/Move',
        driver,
        passed,
        duration,
        details: `Copy: ${copyExists}, Move: ${moveExists}, Content: ${contentMatches}`,
      };
    } catch (error) {
      return {
        testName: 'File Copy/Move',
        driver,
        passed: false,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error.message,
      };
    }
  }

  private async testFileDelete(driver: StorageDriver): Promise<StorageTestResult> {
    const startTime = Date.now();
    
    try {
      const storage = this.storageFactory.create(driver);
      const testData = Buffer.from('Delete test file');
      const testPath = `test/delete-${Date.now()}.txt`;

      // Upload file
      await storage.upload(testData, testPath);
      const existsBeforeDelete = await storage.exists(testPath);

      // Delete file
      await storage.delete(testPath);
      const existsAfterDelete = await storage.exists(testPath);

      // Test deleting non-existent file (should not throw)
      await storage.delete(`test/non-existent-${Date.now()}.txt`);

      const passed = existsBeforeDelete && !existsAfterDelete;
      const duration = Date.now() - startTime;

      return {
        testName: 'File Delete',
        driver,
        passed,
        duration,
        details: `Before: ${existsBeforeDelete}, After: ${!existsAfterDelete}`,
      };
    } catch (error) {
      return {
        testName: 'File Delete',
        driver,
        passed: false,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error.message,
      };
    }
  }

  private async testEncryption(driver: StorageDriver): Promise<StorageTestResult> {
    const startTime = Date.now();
    
    try {
      const storage = this.storageFactory.create(driver);
      const testData = Buffer.from('Encryption test file with sensitive data');
      const testPath = `test/encrypted-${Date.now()}.txt`;

      // Upload with encryption
      await storage.upload(testData, testPath, {
        encrypt: true,
        metadata: { organizationId: 1 },
      });

      // Download with decryption
      const decryptedData = await storage.download(testPath, { decrypt: true });

      // Download without decryption (should be encrypted)
      const encryptedData = await storage.download(testPath);

      // Verify
      const decryptionWorks = testData.equals(decryptedData);
      const dataIsEncrypted = !testData.equals(encryptedData);

      // Cleanup
      await storage.delete(testPath);

      const passed = decryptionWorks && dataIsEncrypted;
      const duration = Date.now() - startTime;

      return {
        testName: 'File Encryption',
        driver,
        passed,
        duration,
        details: `Decryption: ${decryptionWorks}, Encrypted: ${dataIsEncrypted}`,
      };
    } catch (error) {
      return {
        testName: 'File Encryption',
        driver,
        passed: false,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error.message,
      };
    }
  }

  private async testRangeRequests(driver: StorageDriver): Promise<StorageTestResult> {
    const startTime = Date.now();
    
    try {
      const capabilities = await this.storageFactory.getDriverCapabilities(driver);
      if (!capabilities.supportsRangeRequests) {
        return {
          testName: 'Range Requests',
          driver,
          passed: true,
          duration: Date.now() - startTime,
          details: 'Range requests not supported by driver (skipped)',
        };
      }

      const storage = this.storageFactory.create(driver);
      const testData = Buffer.from('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      const testPath = `test/range-${Date.now()}.txt`;

      // Upload file
      await storage.upload(testData, testPath);

      // Test range request
      const rangeData = await storage.download(testPath, {
        range: { start: 10, end: 19 },
      });

      // Verify range data
      const expectedRange = testData.slice(10, 20);
      const rangeMatches = expectedRange.equals(rangeData);

      // Cleanup
      await storage.delete(testPath);

      const passed = rangeMatches;
      const duration = Date.now() - startTime;

      return {
        testName: 'Range Requests',
        driver,
        passed,
        duration,
        details: `Range data matches: ${rangeMatches}`,
      };
    } catch (error) {
      return {
        testName: 'Range Requests',
        driver,
        passed: false,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error.message,
      };
    }
  }

  private async testPresignedUrls(driver: StorageDriver): Promise<StorageTestResult> {
    const startTime = Date.now();
    
    try {
      const capabilities = await this.storageFactory.getDriverCapabilities(driver);
      if (!capabilities.supportsPresignedUrls) {
        return {
          testName: 'Presigned URLs',
          driver,
          passed: true,
          duration: Date.now() - startTime,
          details: 'Presigned URLs not supported by driver (skipped)',
        };
      }

      const storage = this.storageFactory.create(driver);
      const testData = Buffer.from('Presigned URL test file');
      const testPath = `test/presigned-${Date.now()}.txt`;

      // Upload file
      await storage.upload(testData, testPath);

      // Generate presigned URL
      const presignedUrl = await storage.getUrl(testPath, 3600);

      // Verify URL format
      const isValidUrl = presignedUrl.startsWith('http');

      // Cleanup
      await storage.delete(testPath);

      const passed = isValidUrl;
      const duration = Date.now() - startTime;

      return {
        testName: 'Presigned URLs',
        driver,
        passed,
        duration,
        details: `Valid URL generated: ${isValidUrl}`,
      };
    } catch (error) {
      return {
        testName: 'Presigned URLs',
        driver,
        passed: false,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error.message,
      };
    }
  }

  private async testLargeFiles(driver: StorageDriver): Promise<StorageTestResult> {
    const startTime = Date.now();
    
    try {
      const storage = this.storageFactory.create(driver);
      const largeData = Buffer.alloc(10 * 1024 * 1024, 'A'); // 10MB file
      const testPath = `test/large-${Date.now()}.bin`;

      // Upload large file
      await storage.upload(largeData, testPath);

      // Download and verify
      const downloadedData = await storage.download(testPath);
      const dataMatches = largeData.equals(downloadedData);

      // Check file size
      const metadata = await storage.getMetadata(testPath);
      const sizeMatches = metadata?.size === largeData.length;

      // Cleanup
      await storage.delete(testPath);

      const passed = dataMatches && sizeMatches;
      const duration = Date.now() - startTime;

      return {
        testName: 'Large Files',
        driver,
        passed,
        duration,
        details: `Data matches: ${dataMatches}, Size matches: ${sizeMatches}`,
      };
    } catch (error) {
      return {
        testName: 'Large Files',
        driver,
        passed: false,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error.message,
      };
    }
  }

  private async testErrorHandling(driver: StorageDriver): Promise<StorageTestResult> {
    const startTime = Date.now();
    
    try {
      const storage = this.storageFactory.create(driver);
      let errorsCaught = 0;

      // Test downloading non-existent file
      try {
        await storage.download('test/non-existent-file.txt');
      } catch (error) {
        errorsCaught++;
      }

      // Test getting metadata for non-existent file
      try {
        const metadata = await storage.getMetadata('test/non-existent-file.txt');
        if (metadata === null) {
          errorsCaught++; // Null is acceptable for non-existent files
        }
      } catch (error) {
        errorsCaught++;
      }

      // Test copying non-existent file
      try {
        await storage.copy('test/non-existent-source.txt', 'test/copy-dest.txt');
      } catch (error) {
        errorsCaught++;
      }

      const passed = errorsCaught >= 2; // At least 2 errors should be handled properly
      const duration = Date.now() - startTime;

      return {
        testName: 'Error Handling',
        driver,
        passed,
        duration,
        details: `Errors properly handled: ${errorsCaught}/3`,
      };
    } catch (error) {
      return {
        testName: 'Error Handling',
        driver,
        passed: false,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error.message,
      };
    }
  }

  private async testConcurrentAccess(driver: StorageDriver): Promise<StorageTestResult> {
    const startTime = Date.now();
    
    try {
      const storage = this.storageFactory.create(driver);
      const concurrentOperations = 10;
      const promises: Promise<void>[] = [];

      // Create concurrent upload operations
      for (let i = 0; i < concurrentOperations; i++) {
        const testData = Buffer.from(`Concurrent test file ${i}`);
        const testPath = `test/concurrent-${Date.now()}-${i}.txt`;
        
        const promise = storage.upload(testData, testPath)
          .then(() => storage.download(testPath))
          .then(() => storage.delete(testPath));
        
        promises.push(promise);
      }

      // Wait for all operations to complete
      await Promise.all(promises);

      const passed = true; // If we get here, all operations succeeded
      const duration = Date.now() - startTime;

      return {
        testName: 'Concurrent Access',
        driver,
        passed,
        duration,
        details: `${concurrentOperations} concurrent operations completed successfully`,
      };
    } catch (error) {
      return {
        testName: 'Concurrent Access',
        driver,
        passed: false,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error.message,
      };
    }
  }

  async runLoadTest(driver: StorageDriver, options: {
    concurrentOperations?: number;
    totalOperations?: number;
    fileSize?: number;
  } = {}): Promise<LoadTestResult> {
    const concurrentOps = options.concurrentOperations || 10;
    const totalOps = options.totalOperations || 100;
    const fileSize = options.fileSize || 1024; // 1KB default

    this.logger.log(`Starting load test for ${driver}: ${totalOps} operations, ${concurrentOps} concurrent`);

    const storage = this.storageFactory.create(driver);
    const testData = Buffer.alloc(fileSize, 'X');
    const startTime = Date.now();
    const latencies: number[] = [];
    const errors: string[] = [];

    // Create batches of concurrent operations
    const batchSize = concurrentOps;
    const batches = Math.ceil(totalOps / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchPromises: Promise<void>[] = [];
      const currentBatchSize = Math.min(batchSize, totalOps - batch * batchSize);

      for (let i = 0; i < currentBatchSize; i++) {
        const opIndex = batch * batchSize + i;
        const testPath = `test/load-${Date.now()}-${opIndex}.txt`;

        const promise = this.performLoadTestOperation(storage, testData, testPath, latencies, errors);
        batchPromises.push(promise);
      }

      await Promise.all(batchPromises);
    }

    const totalDuration = Date.now() - startTime;
    const throughput = totalOps / (totalDuration / 1000);
    const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const errorRate = errors.length / totalOps;

    return {
      driver,
      concurrentOperations: concurrentOps,
      totalOperations: totalOps,
      duration: totalDuration,
      throughput,
      averageLatency,
      maxLatency,
      errorRate,
      errors: errors.slice(0, 10), // Limit to first 10 errors
    };
  }

  private async performLoadTestOperation(
    storage: IFileStorageService,
    testData: Buffer,
    testPath: string,
    latencies: number[],
    errors: string[],
  ): Promise<void> {
    const opStart = Date.now();

    try {
      // Upload
      await storage.upload(testData, testPath);
      
      // Download
      await storage.download(testPath);
      
      // Delete
      await storage.delete(testPath);

      const latency = Date.now() - opStart;
      latencies.push(latency);
    } catch (error) {
      errors.push(error.message);
    }
  }

  async generateTestReport(suites: StorageTestSuite[]): Promise<string> {
    let report = `# Storage Integration Test Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Summary
    const totalTests = suites.reduce((sum, suite) => sum + suite.totalTests, 0);
    const totalPassed = suites.reduce((sum, suite) => sum + suite.passedTests, 0);
    const totalFailed = suites.reduce((sum, suite) => sum + suite.failedTests, 0);
    const totalDuration = suites.reduce((sum, suite) => sum + suite.totalDuration, 0);

    report += `## Summary\n\n`;
    report += `- **Total Tests:** ${totalTests}\n`;
    report += `- **Passed:** ${totalPassed}\n`;
    report += `- **Failed:** ${totalFailed}\n`;
    report += `- **Success Rate:** ${((totalPassed / totalTests) * 100).toFixed(2)}%\n`;
    report += `- **Total Duration:** ${totalDuration}ms\n\n`;

    // Driver-specific results
    for (const suite of suites) {
      report += `## ${suite.suiteName}\n\n`;
      report += `**Status:** ${suite.overallPassed ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `**Tests:** ${suite.passedTests}/${suite.totalTests} passed\n`;
      report += `**Duration:** ${suite.totalDuration}ms\n\n`;

      for (const result of suite.results) {
        const status = result.passed ? '✅' : '❌';
        report += `### ${status} ${result.testName}\n\n`;
        report += `**Duration:** ${result.duration}ms\n`;
        report += `**Details:** ${result.details}\n`;
        
        if (result.error) {
          report += `**Error:** ${result.error}\n`;
        }
        
        report += `\n`;
      }
    }

    return report;
  }
}