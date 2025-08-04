import { BaseAIService, AIMessage, AIResponse } from './base-service';
import { OpenAIService } from './openai-service';
import { GeminiService } from './gemini-service';
import { ClaudeService } from './claude-service';
import { KeychainManager } from '../security/keychain';

export type AIServiceType = 'openai' | 'gemini' | 'claude';

export class AIManager {
  private services: Map<AIServiceType, BaseAIService> = new Map();
  private keychainManager: KeychainManager;
  private activeService: AIServiceType = 'openai';

  constructor(keychainManager: KeychainManager) {
    this.keychainManager = keychainManager;
  }

  /**
   * Get a specific AI service
   */
  getService(serviceType: AIServiceType): BaseAIService | null {
    return this.services.get(serviceType) || null;
  }

  /**
   * Initialize an AI service with its API key
   */
  async initializeService(serviceType: AIServiceType): Promise<boolean> {
    try {
      const apiKey = await this.keychainManager.getToken(serviceType);
      
      if (!apiKey) {
        console.warn(`No API key found for ${serviceType}`);
        return false;
      }

      let service: BaseAIService;

      switch (serviceType) {
        case 'openai':
          service = new OpenAIService({ apiKey });
          break;
        case 'gemini':
          service = new GeminiService({ apiKey });
          break;
        case 'claude':
          service = new ClaudeService({ apiKey });
          break;
        default:
          throw new Error(`Unknown service type: ${serviceType}`);
      }

      // Validate the API key
      const isValid = await service.validateApiKey();
      
      if (!isValid) {
        console.error(`Invalid API key for ${serviceType}`);
        return false;
      }

      this.services.set(serviceType, service);
      console.log(`${serviceType} service initialized successfully`);
      return true;

    } catch (error) {
      console.error(`Failed to initialize ${serviceType} service:`, error);
      return false;
    }
  }

  /**
   * Initialize all available services
   */
  async initializeAllServices(): Promise<{ [key in AIServiceType]: boolean }> {
    const results = await Promise.allSettled([
      this.initializeService('openai'),
      this.initializeService('gemini'),
      this.initializeService('claude')
    ]);

    return {
      openai: results[0].status === 'fulfilled' ? results[0].value : false,
      gemini: results[1].status === 'fulfilled' ? results[1].value : false,
      claude: results[2].status === 'fulfilled' ? results[2].value : false
    };
  }

  /**
   * Send a message to a specific AI service
   */
  async sendMessage(serviceType: AIServiceType, message: string, context?: string): Promise<string> {
    const service = this.services.get(serviceType);
    
    if (!service) {
      // Try to initialize the service if it's not already initialized
      const initialized = await this.initializeService(serviceType);
      if (!initialized) {
        throw new Error(`${serviceType} service is not available. Please check your API key.`);
      }
    }

    const activeService = this.services.get(serviceType)!;
    
    try {
      const messages: AIMessage[] = [];
      
      // Add context as system message if provided
      if (context) {
        messages.push({
          role: 'system',
          content: context,
          timestamp: Date.now()
        });
      }

      // Add user message
      messages.push({
        role: 'user',
        content: message,
        timestamp: Date.now()
      });

      const response = await activeService.sendMessage(messages);
      return response.content;

    } catch (error) {
      console.error(`Error sending message to ${serviceType}:`, error);
      throw error;
    }
  }

  /**
   * Send a message with conversation history
   */
  async sendConversation(serviceType: AIServiceType, messages: AIMessage[]): Promise<AIResponse> {
    const service = this.services.get(serviceType);
    
    if (!service) {
      throw new Error(`${serviceType} service is not initialized`);
    }

    return await service.sendMessage(messages);
  }

  /**
   * Analyze a web page with AI
   */
  async analyzeWebPage(serviceType: AIServiceType, pageContent: string, userQuery: string): Promise<string> {
    const service = this.services.get(serviceType);
    
    if (!service) {
      await this.initializeService(serviceType);
    }

    const activeService = this.services.get(serviceType);
    if (!activeService) {
      throw new Error(`${serviceType} service is not available`);
    }

    // Use service-specific web page analysis if available
    if ('analyzeWebPage' in activeService && typeof activeService.analyzeWebPage === 'function') {
      return await (activeService as any).analyzeWebPage(pageContent, userQuery);
    }

    // Fallback to generic approach
    const context = `You are analyzing a web page for a user. Here's the page content: ${pageContent.substring(0, 10000)}`;
    return await this.sendMessage(serviceType, userQuery, context);
  }

  /**
   * Test connection to a service
   */
  async testConnection(serviceType: AIServiceType): Promise<boolean> {
    try {
      const testMessage = "Hello! This is a connection test from Brawza browser.";
      const response = await this.sendMessage(serviceType, testMessage);
      return response.length > 0;
    } catch (error) {
      console.error(`Connection test failed for ${serviceType}:`, error);
      return false;
    }
  }

  /**
   * Get available services
   */
  getAvailableServices(): AIServiceType[] {
    return Array.from(this.services.keys());
  }

  /**
   * Check if a service is initialized
   */
  isServiceInitialized(serviceType: AIServiceType): boolean {
    return this.services.has(serviceType);
  }

  /**
   * Get service configuration
   */
  getServiceConfig(serviceType: AIServiceType): any {
    const service = this.services.get(serviceType);
    return service ? service.getConfig() : null;
  }

  /**
   * Update service configuration
   */
  updateServiceConfig(serviceType: AIServiceType, config: any): void {
    const service = this.services.get(serviceType);
    if (service) {
      service.updateConfig(config);
    }
  }

  /**
   * Remove a service (when API key is removed)
   */
  removeService(serviceType: AIServiceType): void {
    this.services.delete(serviceType);
    console.log(`${serviceType} service removed`);
  }

  /**
   * Get the active service
   */
  getActiveService(): AIServiceType {
    return this.activeService;
  }

  /**
   * Set the active service
   */
  setActiveService(serviceType: AIServiceType): void {
    this.activeService = serviceType;
  }

  /**
   * Generate automation suggestions
   */
  async generateAutomationSuggestions(serviceType: AIServiceType, pageContent: string, userIntent: string): Promise<string> {
    const service = this.services.get(serviceType);
    
    if (!service) {
      await this.initializeService(serviceType);
    }

    const activeService = this.services.get(serviceType);
    if (!activeService) {
      throw new Error(`${serviceType} service is not available`);
    }

    // Use service-specific automation methods if available
    if (serviceType === 'openai' && 'generateAutomationScript' in activeService) {
      return await (activeService as any).generateAutomationScript(pageContent, userIntent);
    } else if (serviceType === 'gemini' && 'suggestAutomation' in activeService) {
      return await (activeService as any).suggestAutomation(pageContent, userIntent);
    } else if (serviceType === 'claude' && 'planAutomation' in activeService) {
      return await (activeService as any).planAutomation(pageContent, userIntent);
    }

    // Fallback to generic approach
    const context = `You are helping with browser automation. Page content: ${pageContent.substring(0, 8000)}`;
    const prompt = `I want to: ${userIntent}. Please suggest specific steps to automate this on the current page.`;
    
    return await this.sendMessage(serviceType, prompt, context);
  }

  /**
   * Summarize page content
   */
  async summarizeContent(serviceType: AIServiceType, pageContent: string): Promise<string> {
    const service = this.services.get(serviceType);
    
    if (!service) {
      await this.initializeService(serviceType);
    }

    const activeService = this.services.get(serviceType);
    if (!activeService) {
      throw new Error(`${serviceType} service is not available`);
    }

    // Use service-specific summarization if available
    if (serviceType === 'gemini' && 'summarizeContent' in activeService) {
      return await (activeService as any).summarizeContent(pageContent);
    } else if (serviceType === 'claude' && 'createDetailedSummary' in activeService) {
      return await (activeService as any).createDetailedSummary(pageContent);
    }

    // Fallback to generic approach
    const prompt = `Please summarize this web page content: ${pageContent.substring(0, 12000)}`;
    return await this.sendMessage(serviceType, prompt);
  }
}