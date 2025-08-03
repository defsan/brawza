export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  service: string; // Service name for tracking
}

export interface RateLimitStatus {
  remaining: number;
  resetTime: number;
  isLimited: boolean;
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    // Default rate limits for AI services
    this.addService('openai', { windowMs: 60000, maxRequests: 50, service: 'openai' });
    this.addService('gemini', { windowMs: 60000, maxRequests: 60, service: 'gemini' });
    this.addService('claude', { windowMs: 60000, maxRequests: 40, service: 'claude' });
    this.addService('puppeteer', { windowMs: 10000, maxRequests: 20, service: 'puppeteer' });
  }

  addService(service: string, config: RateLimitConfig): void {
    this.configs.set(service, config);
    this.requests.set(service, []);
    console.log(`Rate limiter configured for ${service}: ${config.maxRequests} requests per ${config.windowMs}ms`);
  }

  async checkLimit(service: string): Promise<RateLimitStatus> {
    const config = this.configs.get(service);
    if (!config) {
      throw new Error(`No rate limit configuration found for service: ${service}`);
    }

    const now = Date.now();
    const serviceRequests = this.requests.get(service) || [];

    // Remove old requests outside the time window
    const windowStart = now - config.windowMs;
    const validRequests = serviceRequests.filter(timestamp => timestamp > windowStart);
    this.requests.set(service, validRequests);

    const remaining = Math.max(0, config.maxRequests - validRequests.length);
    const isLimited = validRequests.length >= config.maxRequests;
    const resetTime = validRequests.length > 0 ? validRequests[0] + config.windowMs : now;

    return {
      remaining,
      resetTime,
      isLimited
    };
  }

  async recordRequest(service: string): Promise<void> {
    const status = await this.checkLimit(service);
    
    if (status.isLimited) {
      const waitTime = status.resetTime - Date.now();
      throw new Error(`Rate limit exceeded for ${service}. Try again in ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    const serviceRequests = this.requests.get(service) || [];
    serviceRequests.push(Date.now());
    this.requests.set(service, serviceRequests);
  }

  async waitForLimit(service: string): Promise<void> {
    const status = await this.checkLimit(service);
    
    if (status.isLimited) {
      const waitTime = status.resetTime - Date.now();
      if (waitTime > 0) {
        console.log(`Rate limited for ${service}, waiting ${Math.ceil(waitTime / 1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  getServiceStats(service: string): { requests: number; windowMs: number; maxRequests: number } | null {
    const config = this.configs.get(service);
    const requests = this.requests.get(service);
    
    if (!config || !requests) {
      return null;
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;
    const validRequests = requests.filter(timestamp => timestamp > windowStart);

    return {
      requests: validRequests.length,
      windowMs: config.windowMs,
      maxRequests: config.maxRequests
    };
  }

  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const service of this.configs.keys()) {
      stats[service] = this.getServiceStats(service);
    }
    
    return stats;
  }

  updateConfig(service: string, config: Partial<RateLimitConfig>): void {
    const existing = this.configs.get(service);
    if (!existing) {
      throw new Error(`Service ${service} not found`);
    }

    const updated = { ...existing, ...config };
    this.configs.set(service, updated);
    console.log(`Rate limit updated for ${service}:`, updated);
  }

  clearService(service: string): void {
    this.requests.set(service, []);
    console.log(`Rate limit history cleared for ${service}`);
  }

  clearAll(): void {
    for (const service of this.requests.keys()) {
      this.requests.set(service, []);
    }
    console.log('All rate limit histories cleared');
  }
}