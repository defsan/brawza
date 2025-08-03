import { PerformanceMonitor, RateLimiter } from '../../src/main/monitoring';

// Mock os module
jest.mock('os', () => ({
  totalmem: jest.fn().mockReturnValue(8 * 1024 * 1024 * 1024), // 8GB
  freemem: jest.fn().mockReturnValue(4 * 1024 * 1024 * 1024), // 4GB free
  loadavg: jest.fn().mockReturnValue([1.5, 1.2, 1.0]),
  cpus: jest.fn().mockReturnValue(new Array(8).fill({})), // 8 CPU cores
}));

// Mock process module
const mockMemoryUsage = {
  rss: 100 * 1024 * 1024, // 100MB
  heapTotal: 80 * 1024 * 1024, // 80MB
  heapUsed: 60 * 1024 * 1024, // 60MB
  external: 20 * 1024 * 1024, // 20MB
  arrayBuffers: 5 * 1024 * 1024, // 5MB
};

Object.defineProperty(process, 'memoryUsage', {
  value: jest.fn().mockReturnValue(mockMemoryUsage),
});

describe('Performance Monitoring System', () => {
  describe('PerformanceMonitor', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
      monitor = new PerformanceMonitor();
      jest.clearAllMocks();
    });

    afterEach(() => {
      monitor.stop();
    });

    describe('Initialization and Control', () => {
      test('should initialize with correct default state', () => {
        expect(monitor.isMonitoring).toBe(false);
        expect(monitor.getLatestMetrics()).toBeNull();
        expect(monitor.getMetricsHistory()).toHaveLength(0);
      });

      test('should start monitoring', () => {
        monitor.start(1000);
        expect(monitor.isMonitoring).toBe(true);
        expect(monitor.getLatestMetrics()).toBeDefined();
      });

      test('should stop monitoring', () => {
        monitor.start(1000);
        expect(monitor.isMonitoring).toBe(true);
        
        monitor.stop();
        expect(monitor.isMonitoring).toBe(false);
      });

      test('should not start monitoring if already started', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        
        monitor.start(1000);
        monitor.start(1000); // Try to start again
        
        expect(consoleSpy).toHaveBeenCalledWith('Performance monitoring already started');
        consoleSpy.mockRestore();
      });
    });

    describe('Metrics Collection', () => {
      test('should collect valid performance metrics', () => {
        monitor.start(1000);
        const metrics = monitor.getLatestMetrics();

        expect(metrics).toBeDefined();
        expect(metrics!.cpu).toBeDefined();
        expect(metrics!.memory).toBeDefined();
        expect(metrics!.puppeteer).toBeDefined();
        expect(metrics!.timestamp).toBeGreaterThan(0);

        // CPU metrics
        expect(metrics!.cpu.usage).toBeGreaterThanOrEqual(0);
        expect(metrics!.cpu.loadAverage).toHaveLength(3);

        // Memory metrics
        expect(metrics!.memory.used).toBeGreaterThan(0);
        expect(metrics!.memory.total).toBeGreaterThan(0);
        expect(metrics!.memory.percentage).toBeGreaterThanOrEqual(0);
        expect(metrics!.memory.percentage).toBeLessThanOrEqual(100);

        // Heap metrics
        expect(metrics!.memory.heap.used).toBeGreaterThan(0);
        expect(metrics!.memory.heap.total).toBeGreaterThan(0);
        expect(metrics!.memory.heap.percentage).toBeGreaterThanOrEqual(0);
        expect(metrics!.memory.heap.percentage).toBeLessThanOrEqual(100);
      });

      test('should maintain metrics history', async () => {
        monitor.start(100); // Fast interval for testing
        
        // Wait for multiple collections
        await new Promise(resolve => setTimeout(resolve, 350));
        
        const history = monitor.getMetricsHistory();
        expect(history.length).toBeGreaterThan(1);
        expect(history.length).toBeLessThanOrEqual(100); // Max history size
      });

      test('should limit history size', async () => {
        const monitor = new PerformanceMonitor();
        monitor['maxHistorySize'] = 3; // Override for testing
        
        monitor.start(50);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const history = monitor.getMetricsHistory();
        expect(history.length).toBeLessThanOrEqual(3);
        
        monitor.stop();
      });
    });

    describe('Threshold Monitoring', () => {
      test('should emit performance warnings when thresholds exceeded', (done) => {
        monitor.updateThresholds({
          maxMemoryPercentage: 10, // Very low threshold
          maxCpuUsage: 5, // Very low threshold
        });

        monitor.on('performanceWarning', ({ metrics, warnings }) => {
          expect(warnings).toBeDefined();
          expect(warnings.length).toBeGreaterThan(0);
          expect(metrics).toBeDefined();
          done();
        });

        monitor.start(100);
      });

      test('should update thresholds correctly', () => {
        const newThresholds = {
          maxMemoryPercentage: 90,
          maxCpuUsage: 85,
        };

        monitor.updateThresholds(newThresholds);
        const thresholds = monitor.getThresholds();

        expect(thresholds.maxMemoryPercentage).toBe(90);
        expect(thresholds.maxCpuUsage).toBe(85);
      });

      test('should identify critical performance states', () => {
        // Mock high usage
        (process.memoryUsage as jest.Mock).mockReturnValue({
          ...mockMemoryUsage,
          heapUsed: mockMemoryUsage.heapTotal * 0.96, // 96% heap usage
        });

        monitor.start(100);
        
        // Update thresholds to trigger critical state
        monitor.updateThresholds({
          maxMemoryPercentage: 95,
          maxHeapPercentage: 95,
        });

        expect(monitor.isPerformanceCritical()).toBe(true);
      });
    });

    describe('Memory Optimization', () => {
      test('should optimize memory', async () => {
        monitor.start(100);
        
        // Add some history
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const optimizeSpy = jest.fn();
        monitor.on('memoryOptimized', optimizeSpy);
        
        await monitor.optimizeMemory();
        expect(optimizeSpy).toHaveBeenCalled();
      });

      test('should handle optimization errors gracefully', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation();
        
        // Mock global.gc to throw error
        (global as any).gc = jest.fn().mockImplementation(() => {
          throw new Error('GC error');
        });

        await monitor.optimizeMemory();
        expect(errorSpy).toHaveBeenCalled();
        
        errorSpy.mockRestore();
        delete (global as any).gc;
      });
    });

    describe('Reporting', () => {
      test('should generate memory report', () => {
        monitor.start(100);
        const report = monitor.getMemoryReport();

        expect(typeof report).toBe('string');
        expect(report).toContain('Performance Report');
        expect(report).toContain('Current Memory');
        expect(report).toContain('CPU Usage');
        expect(report).toContain('Heap Usage');
      });

      test('should return empty report when no data', () => {
        const report = monitor.getMemoryReport();
        expect(report).toBe('No performance data available');
      });

      test('should calculate average metrics', async () => {
        monitor.start(50);
        await new Promise(resolve => setTimeout(resolve, 200));

        const averages = monitor.getAverageMetrics(3);
        expect(averages).toBeDefined();
        expect(averages!.cpu?.usage).toBeGreaterThanOrEqual(0);
        expect(averages!.memory?.percentage).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Event Handling', () => {
      test('should emit metrics updates', (done) => {
        monitor.on('metricsUpdated', (metrics) => {
          expect(metrics).toBeDefined();
          expect(metrics.timestamp).toBeGreaterThan(0);
          done();
        });

        monitor.start(100);
      });

      test('should handle collection errors gracefully', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation();
        
        // Mock os.totalmem to throw error
        const os = require('os');
        os.totalmem.mockImplementation(() => {
          throw new Error('OS error');
        });

        monitor.start(100);
        
        // Let it try to collect metrics
        setTimeout(() => {
          expect(errorSpy).toHaveBeenCalled();
          errorSpy.mockRestore();
        }, 150);
      });
    });
  });

  describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter();
    });

    describe('Service Management', () => {
      test('should initialize with default services', () => {
        const stats = rateLimiter.getAllStats();
        expect(stats.openai).toBeDefined();
        expect(stats.gemini).toBeDefined();
        expect(stats.claude).toBeDefined();
        expect(stats.puppeteer).toBeDefined();
      });

      test('should add custom service', () => {
        rateLimiter.addService('custom', {
          windowMs: 30000,
          maxRequests: 25,
          service: 'custom'
        });

        const stats = rateLimiter.getAllStats();
        expect(stats.custom).toBeDefined();
        expect(stats.custom.maxRequests).toBe(25);
        expect(stats.custom.windowMs).toBe(30000);
      });

      test('should update service configuration', () => {
        rateLimiter.updateConfig('openai', {
          maxRequests: 100,
          windowMs: 120000
        });

        const stats = rateLimiter.getServiceStats('openai');
        expect(stats!.maxRequests).toBe(100);
        expect(stats!.windowMs).toBe(120000);
      });

      test('should throw error for unknown service configuration update', () => {
        expect(() => {
          rateLimiter.updateConfig('unknown', { maxRequests: 10 });
        }).toThrow('Service unknown not found');
      });
    });

    describe('Rate Limiting Logic', () => {
      test('should allow requests within limit', async () => {
        const status = await rateLimiter.checkLimit('openai');
        expect(status.isLimited).toBe(false);
        expect(status.remaining).toBeGreaterThan(0);

        await rateLimiter.recordRequest('openai');
        // Should still be allowed
        const statusAfter = await rateLimiter.checkLimit('openai');
        expect(statusAfter.isLimited).toBe(false);
      });

      test('should enforce rate limits', async () => {
        // Add service with very low limit for testing
        rateLimiter.addService('test', {
          windowMs: 10000,
          maxRequests: 2,
          service: 'test'
        });

        // Make requests up to limit
        await rateLimiter.recordRequest('test');
        await rateLimiter.recordRequest('test');

        // Should now be limited
        const status = await rateLimiter.checkLimit('test');
        expect(status.isLimited).toBe(true);
        expect(status.remaining).toBe(0);
      });

      test('should throw error when limit exceeded', async () => {
        rateLimiter.addService('strict', {
          windowMs: 10000,
          maxRequests: 1,
          service: 'strict'
        });

        await rateLimiter.recordRequest('strict');

        await expect(rateLimiter.recordRequest('strict')).rejects.toThrow(
          'Rate limit exceeded for strict'
        );
      });

      test('should reset limits after time window', async () => {
        rateLimiter.addService('reset-test', {
          windowMs: 100, // Very short window
          maxRequests: 1,
          service: 'reset-test'
        });

        await rateLimiter.recordRequest('reset-test');
        
        // Should be limited immediately
        let status = await rateLimiter.checkLimit('reset-test');
        expect(status.isLimited).toBe(true);

        // Wait for window to reset
        await new Promise(resolve => setTimeout(resolve, 150));

        // Should be available again
        status = await rateLimiter.checkLimit('reset-test');
        expect(status.isLimited).toBe(false);
      });

      test('should wait for rate limit reset', async () => {
        rateLimiter.addService('wait-test', {
          windowMs: 200,
          maxRequests: 1,
          service: 'wait-test'
        });

        await rateLimiter.recordRequest('wait-test');
        
        const startTime = Date.now();
        await rateLimiter.waitForLimit('wait-test');
        const endTime = Date.now();

        // Should have waited approximately 200ms
        expect(endTime - startTime).toBeGreaterThanOrEqual(150);
      });
    });

    describe('Statistics and Management', () => {
      test('should provide accurate service stats', async () => {
        await rateLimiter.recordRequest('openai');
        await rateLimiter.recordRequest('openai');

        const stats = rateLimiter.getServiceStats('openai');
        expect(stats).toBeDefined();
        expect(stats!.requests).toBe(2);
        expect(stats!.maxRequests).toBe(50); // Default for OpenAI
      });

      test('should return null for unknown service stats', () => {
        const stats = rateLimiter.getServiceStats('unknown');
        expect(stats).toBeNull();
      });

      test('should get all service stats', async () => {
        await rateLimiter.recordRequest('openai');
        await rateLimiter.recordRequest('gemini');

        const allStats = rateLimiter.getAllStats();
        expect(allStats.openai.requests).toBe(1);
        expect(allStats.gemini.requests).toBe(1);
        expect(allStats.claude.requests).toBe(0);
      });

      test('should clear service history', async () => {
        await rateLimiter.recordRequest('openai');
        expect(rateLimiter.getServiceStats('openai')!.requests).toBe(1);

        rateLimiter.clearService('openai');
        expect(rateLimiter.getServiceStats('openai')!.requests).toBe(0);
      });

      test('should clear all service histories', async () => {
        await rateLimiter.recordRequest('openai');
        await rateLimiter.recordRequest('gemini');

        rateLimiter.clearAll();

        const allStats = rateLimiter.getAllStats();
        expect(allStats.openai.requests).toBe(0);
        expect(allStats.gemini.requests).toBe(0);
      });
    });

    describe('Error Handling', () => {
      test('should throw error for unknown service', async () => {
        await expect(rateLimiter.checkLimit('unknown')).rejects.toThrow(
          'No rate limit configuration found for service: unknown'
        );
      });

      test('should handle concurrent requests correctly', async () => {
        rateLimiter.addService('concurrent', {
          windowMs: 10000,
          maxRequests: 5,
          service: 'concurrent'
        });

        // Make concurrent requests
        const promises = Array(3).fill(null).map(() => 
          rateLimiter.recordRequest('concurrent')
        );

        await Promise.all(promises);
        
        const stats = rateLimiter.getServiceStats('concurrent');
        expect(stats!.requests).toBe(3);
      });
    });
  });

  describe('Integration Tests', () => {
    test('should work together - monitor and rate limiter', async () => {
      const monitor = new PerformanceMonitor();
      const rateLimiter = new RateLimiter();

      monitor.start(100);
      
      // Simulate API usage
      await rateLimiter.recordRequest('openai');
      await rateLimiter.recordRequest('gemini');

      // Check that both systems are working
      const metrics = monitor.getLatestMetrics();
      const rateLimitStats = rateLimiter.getAllStats();

      expect(metrics).toBeDefined();
      expect(rateLimitStats.openai.requests).toBe(1);
      expect(rateLimitStats.gemini.requests).toBe(1);

      monitor.stop();
    });

    test('should handle high load scenarios', async () => {
      const monitor = new PerformanceMonitor();
      const rateLimiter = new RateLimiter();

      // Set up aggressive monitoring
      monitor.start(50);
      
      // Simulate rapid API calls
      const rapidCalls = Array(10).fill(null).map(async (_, i) => {
        try {
          await rateLimiter.recordRequest('openai');
        } catch (error) {
          // Some will be rate limited, which is expected
        }
      });

      await Promise.allSettled(rapidCalls);

      // System should still be responsive
      const metrics = monitor.getLatestMetrics();
      const stats = rateLimiter.getServiceStats('openai');

      expect(metrics).toBeDefined();
      expect(stats).toBeDefined();
      expect(stats!.requests).toBeLessThanOrEqual(50); // OpenAI limit

      monitor.stop();
    });
  });
});