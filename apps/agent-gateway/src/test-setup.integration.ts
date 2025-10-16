import { config } from 'dotenv';
import { join } from 'path';

// Load test environment variables
config({ path: join(__dirname, '../../../.env.test') });

// Set test-specific environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.BUFFER_DATABASE_PATH = ':memory:'; // Use in-memory database for tests
process.env.BUFFER_RETENTION_DAYS = '1'; // Short retention for tests
process.env.UPLINK_BASE_URL = process.env.TEST_UPLINK_URL || 'https://httpbin.org'; // Mock endpoint
process.env.CONTROL_WEBSOCKET_URL = process.env.TEST_WEBSOCKET_URL || 'wss://echo.websocket.org';
process.env.CONTROL_API_KEY = 'test-api-key';
process.env.CONTROL_ORGANIZATION_ID = '1';

// Mock external dependencies if needed
jest.setTimeout(60000); // 60 seconds timeout for integration tests

// Global test utilities
global.testUtils = {
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  generateTestData: (count: number, prefix = 'test') => {
    return Array.from({ length: count }, (_, i) => ({
      agentId: `${prefix}-agent-${i}`,
      organizationId: 1,
      timestamp: new Date().toISOString(),
      data: {
        index: i,
        timestamp: Date.now(),
        testData: `${prefix}-data-${i}`,
      },
    }));
  },
  
  expectWithinRange: (actual: number, expected: number, tolerance: number) => {
    expect(actual).toBeGreaterThanOrEqual(expected - tolerance);
    expect(actual).toBeLessThanOrEqual(expected + tolerance);
  },
  
  waitForCondition: async (
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100
  ) => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  },
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(expected: number, tolerance: number): R;
    }
  }
  
  var testUtils: {
    delay: (ms: number) => Promise<void>;
    generateTestData: (count: number, prefix?: string) => any[];
    expectWithinRange: (actual: number, expected: number, tolerance: number) => void;
    waitForCondition: (
      condition: () => boolean | Promise<boolean>,
      timeout?: number,
      interval?: number
    ) => Promise<boolean>;
  };
}

expect.extend({
  toBeWithinRange(received: number, expected: number, tolerance: number) {
    const pass = received >= expected - tolerance && received <= expected + tolerance;
    
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${expected - tolerance} to ${expected + tolerance}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${expected - tolerance} to ${expected + tolerance}`,
        pass: false,
      };
    }
  },
});

// Setup and teardown hooks
beforeAll(async () => {
  console.log('🚀 Starting integration tests...');
  
  // Clean up any existing test data
  if (process.env.BUFFER_DATABASE_PATH && process.env.BUFFER_DATABASE_PATH !== ':memory:') {
    const fs = require('fs');
    const path = require('path');
    
    try {
      if (fs.existsSync(process.env.BUFFER_DATABASE_PATH)) {
        fs.unlinkSync(process.env.BUFFER_DATABASE_PATH);
      }
    } catch (error) {
      console.warn('Could not clean up test database:', error.message);
    }
  }
});

afterAll(async () => {
  console.log('🏁 Integration tests completed');
  
  // Clean up test resources
  await new Promise(resolve => setTimeout(resolve, 1000)); // Allow cleanup time
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

export {};