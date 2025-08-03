import { EventEmitter } from 'events';
import * as os from 'os';
import * as process from 'process';

export interface PerformanceMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heap: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  puppeteer: {
    pages: number;
    memoryUsage: number;
  };
  timestamp: number;
}

export interface PerformanceThresholds {
  maxMemoryPercentage: number;
  maxCpuUsage: number;
  maxPuppeteerPages: number;
  maxHeapPercentage: number;
}

export class PerformanceMonitor extends EventEmitter {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize: number = 100;
  public isMonitoring: boolean = false;

  private thresholds: PerformanceThresholds = {
    maxMemoryPercentage: 80, // 80% of system memory
    maxCpuUsage: 70, // 70% CPU usage
    maxPuppeteerPages: 10, // Max 10 Puppeteer pages
    maxHeapPercentage: 85, // 85% of heap size
  };

  constructor() {
    super();
  }

  start(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      console.log('Performance monitoring already started');
      return;
    }

    console.log(`Starting performance monitoring (interval: ${intervalMs}ms)`);
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    // Collect initial metrics
    this.collectMetrics();
  }

  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    console.log('Stopping performance monitoring');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private collectMetrics(): void {
    try {
      const metrics = this.getCurrentMetrics();
      this.addToHistory(metrics);
      this.checkThresholds(metrics);
      this.emit('metricsUpdated', metrics);
    } catch (error) {
      console.error('Error collecting performance metrics:', error);
    }
  }

  private getCurrentMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      cpu: {
        usage: this.getCpuUsage(),
        loadAverage: os.loadavg(),
      },
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100,
        heap: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        },
      },
      puppeteer: {
        pages: this.getPuppeteerPageCount(),
        memoryUsage: memUsage.external,
      },
      timestamp: Date.now(),
    };
  }

  private getCpuUsage(): number {
    // Simple CPU usage estimation based on load average
    const cpus = os.cpus();
    const loadAvg = os.loadavg()[0]; // 1-minute load average
    return Math.min((loadAvg / cpus.length) * 100, 100);
  }

  private getPuppeteerPageCount(): number {
    // This would need to be updated by the PuppeteerManager
    // For now, return 0 as placeholder
    return 0;
  }

  private addToHistory(metrics: PerformanceMetrics): void {
    this.metricsHistory.push(metrics);
    
    // Keep only the last N metrics
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  private checkThresholds(metrics: PerformanceMetrics): void {
    const warnings: string[] = [];

    if (metrics.memory.percentage > this.thresholds.maxMemoryPercentage) {
      warnings.push(`High memory usage: ${metrics.memory.percentage.toFixed(1)}%`);
    }

    if (metrics.cpu.usage > this.thresholds.maxCpuUsage) {
      warnings.push(`High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`);
    }

    if (metrics.memory.heap.percentage > this.thresholds.maxHeapPercentage) {
      warnings.push(`High heap usage: ${metrics.memory.heap.percentage.toFixed(1)}%`);
    }

    if (metrics.puppeteer.pages > this.thresholds.maxPuppeteerPages) {
      warnings.push(`Too many Puppeteer pages: ${metrics.puppeteer.pages}`);
    }

    if (warnings.length > 0) {
      console.warn('Performance warnings:', warnings);
      this.emit('performanceWarning', { metrics, warnings });
    }
  }

  getLatestMetrics(): PerformanceMetrics | null {
    return this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1] 
      : null;
  }

  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  getAverageMetrics(samples: number = 10): Partial<PerformanceMetrics> | null {
    if (this.metricsHistory.length === 0) {
      return null;
    }

    const recentMetrics = this.metricsHistory.slice(-samples);
    const count = recentMetrics.length;

    const averages = recentMetrics.reduce(
      (acc, metrics) => {
        acc.cpu.usage += metrics.cpu.usage;
        acc.memory.percentage += metrics.memory.percentage;
        acc.memory.heap.percentage += metrics.memory.heap.percentage;
        acc.puppeteer.pages += metrics.puppeteer.pages;
        return acc;
      },
      {
        cpu: { usage: 0 },
        memory: { 
          percentage: 0,
          heap: { percentage: 0 }
        },
        puppeteer: { pages: 0 }
      }
    );

    return {
      cpu: {
        usage: averages.cpu.usage / count,
        loadAverage: recentMetrics[recentMetrics.length - 1].cpu.loadAverage,
      },
      memory: {
        percentage: averages.memory.percentage / count,
        heap: {
          percentage: averages.memory.heap.percentage / count,
        },
      } as any,
      puppeteer: {
        pages: Math.round(averages.puppeteer.pages / count),
      } as any,
    };
  }

  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('Performance thresholds updated:', this.thresholds);
  }

  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  async optimizeMemory(): Promise<void> {
    console.log('Running memory optimization...');
    
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('Garbage collection triggered');
      }

      // Clear metrics history if it's too large
      if (this.metricsHistory.length > this.maxHistorySize * 0.5) {
        this.metricsHistory = this.metricsHistory.slice(-Math.floor(this.maxHistorySize * 0.3));
        console.log('Metrics history pruned');
      }

      this.emit('memoryOptimized');
    } catch (error) {
      console.error('Error during memory optimization:', error);
    }
  }

  getMemoryReport(): string {
    const latest = this.getLatestMetrics();
    const average = this.getAverageMetrics();

    if (!latest || !average) {
      return 'No performance data available';
    }

    const formatBytes = (bytes: number): string => {
      const mb = bytes / (1024 * 1024);
      return `${mb.toFixed(1)} MB`;
    };

    return `
Performance Report:
==================
Current Memory: ${formatBytes(latest.memory.used)} / ${formatBytes(latest.memory.total)} (${latest.memory.percentage.toFixed(1)}%)
Average Memory: ${average.memory?.percentage?.toFixed(1)}% over last 10 samples
Heap Usage: ${formatBytes(latest.memory.heap.used)} / ${formatBytes(latest.memory.heap.total)} (${latest.memory.heap.percentage.toFixed(1)}%)
CPU Usage: ${latest.cpu.usage.toFixed(1)}% (Load: ${latest.cpu.loadAverage[0].toFixed(2)})
Puppeteer Pages: ${latest.puppeteer.pages}
Timestamp: ${new Date(latest.timestamp).toLocaleString()}
    `.trim();
  }

  isPerformanceCritical(): boolean {
    const latest = this.getLatestMetrics();
    if (!latest) return false;

    return (
      latest.memory.percentage > 90 ||
      latest.cpu.usage > 90 ||
      latest.memory.heap.percentage > 95 ||
      latest.puppeteer.pages > 15
    );
  }
}