// Base AI service interface and abstract class
import { BrowserToolCall } from '../../shared/browser-tools';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: number;
  toolCalls?: BrowserToolCall[];
  toolCallId?: string; // For tool result messages
}

export interface AIResponse {
  content: string;
  toolCalls?: BrowserToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

export interface AIServiceConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export abstract class BaseAIService {
  protected apiKey: string;
  protected model: string;
  protected maxTokens: number;
  protected temperature: number;
  protected timeout: number;

  constructor(config: AIServiceConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || this.getDefaultModel();
    this.maxTokens = config.maxTokens || 1000;
    this.temperature = config.temperature || 0.7;
    this.timeout = config.timeout || 30000;
  }

  // Abstract methods to be implemented by each service
  abstract getServiceName(): string;
  abstract getDefaultModel(): string;
  abstract sendMessage(messages: AIMessage[]): Promise<AIResponse>;
  abstract sendMessageWithTools(messages: AIMessage[], tools?: any[]): Promise<AIResponse>;
  abstract validateApiKey(): Promise<boolean>;
  abstract supportsToolCalling(): boolean;

  // Common utility methods
  protected createUserMessage(content: string): AIMessage {
    return {
      role: 'user',
      content,
      timestamp: Date.now()
    };
  }

  protected createSystemMessage(content: string): AIMessage {
    return {
      role: 'system',
      content,
      timestamp: Date.now()
    };
  }

  protected createToolMessage(toolCallId: string, content: string): AIMessage {
    return {
      role: 'tool',
      content,
      toolCallId,
      timestamp: Date.now()
    };
  }

  protected createAssistantMessage(content: string, toolCalls?: BrowserToolCall[]): AIMessage {
    return {
      role: 'assistant',
      content,
      toolCalls,
      timestamp: Date.now()
    };
  }

  protected handleError(error: any, context: string): never {
    const serviceName = this.getServiceName();
    console.error(`[${serviceName}] ${context}:`, error);
    
    if (error.response?.status === 401) {
      throw new Error(`${serviceName} authentication failed. Please check your API key.`);
    } else if (error.response?.status === 429) {
      throw new Error(`${serviceName} rate limit exceeded. Please try again later.`);
    } else if (error.response?.status >= 500) {
      throw new Error(`${serviceName} server error. Please try again later.`);
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error(`Network error connecting to ${serviceName}. Please check your internet connection.`);
    } else if (error.code === 'TIMEOUT') {
      throw new Error(`${serviceName} request timed out. Please try again.`);
    } else {
      throw new Error(`${serviceName} error: ${error.message || 'Unknown error occurred'}`);
    }
  }

  protected async makeHttpRequest(url: string, options: any): Promise<any> {
    const https = require('https');
    const { URL } = require('url');

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Brawza/1.0.0',
          ...options.headers
        },
        timeout: this.timeout
      };

      const req = https.request(requestOptions, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => data += chunk);
        res.on('end', () => {
          try {
            const response = {
              status: res.statusCode,
              headers: res.headers,
              data: res.headers['content-type']?.includes('application/json') 
                ? JSON.parse(data) 
                : data
            };
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }

      req.end();
    });
  }

  // Helper method for quick single message requests
  async sendSingleMessage(content: string, systemPrompt?: string): Promise<string> {
    const messages: AIMessage[] = [];
    
    if (systemPrompt) {
      messages.push(this.createSystemMessage(systemPrompt));
    }
    
    messages.push(this.createUserMessage(content));
    
    const response = await this.sendMessage(messages);
    return response.content;
  }

  // Helper method for tool-enabled requests
  async sendSingleMessageWithTools(content: string, tools?: any[], systemPrompt?: string): Promise<AIResponse> {
    const messages: AIMessage[] = [];
    
    if (systemPrompt) {
      messages.push(this.createSystemMessage(systemPrompt));
    }
    
    messages.push(this.createUserMessage(content));
    
    if (this.supportsToolCalling() && tools) {
      return await this.sendMessageWithTools(messages, tools);
    } else {
      return await this.sendMessage(messages);
    }
  }

  // Get service status and configuration
  getConfig(): Partial<AIServiceConfig> {
    return {
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
      timeout: this.timeout
    };
  }

  // Update configuration
  updateConfig(config: Partial<AIServiceConfig>): void {
    if (config.model) this.model = config.model;
    if (config.maxTokens) this.maxTokens = config.maxTokens;
    if (config.temperature) this.temperature = config.temperature;
    if (config.timeout) this.timeout = config.timeout;
  }
}