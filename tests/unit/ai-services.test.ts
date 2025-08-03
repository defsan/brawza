import { BaseAIService, AIMessage } from '../../src/main/ai/base-service';
import { OpenAIService } from '../../src/main/ai/openai-service';
import { GeminiService } from '../../src/main/ai/gemini-service';
import { ClaudeService } from '../../src/main/ai/claude-service';
import { AIManager } from '../../src/main/ai/ai-manager';
import { KeychainManager } from '../../src/main/security/keychain';

// Mock HTTP requests
const mockHttpRequest = jest.fn();

// Mock the HTTP module
jest.mock('https', () => ({
  request: mockHttpRequest
}));

// Mock KeychainManager
jest.mock('../../src/main/security/keychain');

describe('AI Services', () => {
  let mockKeychainManager: jest.Mocked<KeychainManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockKeychainManager = new KeychainManager() as jest.Mocked<KeychainManager>;
  });

  describe('BaseAIService', () => {
    class TestAIService extends BaseAIService {
      getServiceName(): string {
        return 'TestService';
      }

      getDefaultModel(): string {
        return 'test-model';
      }

      async sendMessage(messages: AIMessage[]) {
        return {
          content: 'Test response',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
        };
      }

      async validateApiKey(): Promise<boolean> {
        return true;
      }
    }

    test('should initialize with correct configuration', () => {
      const service = new TestAIService({
        apiKey: 'test-key',
        model: 'custom-model',
        maxTokens: 2000,
        temperature: 0.5
      });

      expect(service.getServiceName()).toBe('TestService');
      
      const config = service.getConfig();
      expect(config.model).toBe('custom-model');
      expect(config.maxTokens).toBe(2000);
      expect(config.temperature).toBe(0.5);
    });

    test('should use default values when not provided', () => {
      const service = new TestAIService({ apiKey: 'test-key' });
      
      const config = service.getConfig();
      expect(config.model).toBe('test-model');
      expect(config.maxTokens).toBe(1000);
      expect(config.temperature).toBe(0.7);
    });

    test('should create user and system messages correctly', () => {
      const service = new TestAIService({ apiKey: 'test-key' });
      
      const userMessage = (service as any).createUserMessage('Hello');
      expect(userMessage.role).toBe('user');
      expect(userMessage.content).toBe('Hello');
      expect(userMessage.timestamp).toBeDefined();

      const systemMessage = (service as any).createSystemMessage('System prompt');
      expect(systemMessage.role).toBe('system');
      expect(systemMessage.content).toBe('System prompt');
    });

    test('should handle single message requests', async () => {
      const service = new TestAIService({ apiKey: 'test-key' });
      
      const response = await service.sendSingleMessage('Hello');
      expect(response).toBe('Test response');
    });

    test('should update configuration', () => {
      const service = new TestAIService({ apiKey: 'test-key' });
      
      service.updateConfig({
        model: 'new-model',
        maxTokens: 1500,
        temperature: 0.3
      });

      const config = service.getConfig();
      expect(config.model).toBe('new-model');
      expect(config.maxTokens).toBe(1500);
      expect(config.temperature).toBe(0.3);
    });
  });

  describe('OpenAIService', () => {
    let service: OpenAIService;

    beforeEach(() => {
      service = new OpenAIService({ apiKey: 'test-openai-key' });
    });

    test('should have correct service name and default model', () => {
      expect(service.getServiceName()).toBe('OpenAI');
      expect(service.getDefaultModel()).toBe('gpt-3.5-turbo');
    });

    test('should handle API key validation', async () => {
      // Mock successful validation
      mockHttpRequest.mockImplementationOnce((options, callback) => {
        const mockResponse = {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          on: jest.fn((event, handler) => {
            if (event === 'data') handler('{"data": []}');
            if (event === 'end') handler();
          })
        };
        callback(mockResponse);
        return { on: jest.fn(), end: jest.fn() };
      });

      const isValid = await service.validateApiKey();
      expect(isValid).toBe(true);
    });

    test('should handle message sending format', async () => {
      const messages: AIMessage[] = [
        { role: 'user', content: 'Hello', timestamp: Date.now() }
      ];

      // Mock successful API response
      mockHttpRequest.mockImplementationOnce((options, callback) => {
        const mockResponse = {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(JSON.stringify({
                choices: [{
                  message: { content: 'Hello! How can I help you?' },
                  finish_reason: 'stop'
                }],
                usage: {
                  prompt_tokens: 10,
                  completion_tokens: 15,
                  total_tokens: 25
                },
                model: 'gpt-3.5-turbo'
              }));
            }
            if (event === 'end') handler();
          })
        };
        callback(mockResponse);
        return { 
          on: jest.fn(), 
          end: jest.fn(),
          write: jest.fn()
        };
      });

      const response = await service.sendMessage(messages);
      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.usage?.totalTokens).toBe(25);
    });
  });

  describe('GeminiService', () => {
    let service: GeminiService;

    beforeEach(() => {
      service = new GeminiService({ apiKey: 'test-gemini-key' });
    });

    test('should have correct service name and default model', () => {
      expect(service.getServiceName()).toBe('Gemini');
      expect(service.getDefaultModel()).toBe('gemini-pro');
    });

    test('should convert messages to Gemini format correctly', () => {
      const messages: AIMessage[] = [
        { role: 'system', content: 'You are helpful', timestamp: Date.now() },
        { role: 'user', content: 'Hello', timestamp: Date.now() },
        { role: 'assistant', content: 'Hi there!', timestamp: Date.now() }
      ];

      const converted = (service as any).convertMessagesToGeminiFormat(messages);
      
      expect(converted).toHaveLength(2); // system message merged with first user message
      expect(converted[0].role).toBe('user');
      expect(converted[0].parts[0].text).toContain('You are helpful');
      expect(converted[0].parts[0].text).toContain('Hello');
      expect(converted[1].role).toBe('model');
      expect(converted[1].parts[0].text).toBe('Hi there!');
    });

    test('should handle API response format', async () => {
      const messages: AIMessage[] = [
        { role: 'user', content: 'Test message', timestamp: Date.now() }
      ];

      // Mock Gemini API response
      mockHttpRequest.mockImplementationOnce((options, callback) => {
        const mockResponse = {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(JSON.stringify({
                candidates: [{
                  content: {
                    parts: [{ text: 'Test response from Gemini' }]
                  },
                  finishReason: 'STOP'
                }],
                usageMetadata: {
                  promptTokenCount: 5,
                  candidatesTokenCount: 10,
                  totalTokenCount: 15
                }
              }));
            }
            if (event === 'end') handler();
          })
        };
        callback(mockResponse);
        return { 
          on: jest.fn(), 
          end: jest.fn(),
          write: jest.fn()
        };
      });

      const response = await service.sendMessage(messages);
      expect(response.content).toBe('Test response from Gemini');
      expect(response.usage?.totalTokens).toBe(15);
    });
  });

  describe('ClaudeService', () => {
    let service: ClaudeService;

    beforeEach(() => {
      service = new ClaudeService({ apiKey: 'test-claude-key' });
    });

    test('should have correct service name and default model', () => {
      expect(service.getServiceName()).toBe('Claude');
      expect(service.getDefaultModel()).toBe('claude-3-haiku-20240307');
    });

    test('should process messages for Claude format correctly', () => {
      const messages: AIMessage[] = [
        { role: 'system', content: 'You are Claude', timestamp: Date.now() },
        { role: 'user', content: 'Hello', timestamp: Date.now() },
        { role: 'assistant', content: 'Hi!', timestamp: Date.now() }
      ];

      const processed = (service as any).processMessagesForClaude(messages);
      
      expect(processed.systemMessage).toBe('You are Claude');
      expect(processed.conversationMessages).toHaveLength(2);
      expect(processed.conversationMessages[0].role).toBe('user');
      expect(processed.conversationMessages[1].role).toBe('assistant');
    });

    test('should return available models', async () => {
      const models = await service.getAvailableModels();
      expect(models).toContain('claude-3-opus-20240229');
      expect(models).toContain('claude-3-sonnet-20240229');
      expect(models).toContain('claude-3-haiku-20240307');
    });

    test('should handle Claude API response format', async () => {
      const messages: AIMessage[] = [
        { role: 'user', content: 'Test', timestamp: Date.now() }
      ];

      // Mock Claude API response
      mockHttpRequest.mockImplementationOnce((options, callback) => {
        const mockResponse = {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(JSON.stringify({
                content: [
                  { type: 'text', text: 'Hello from Claude!' }
                ],
                usage: {
                  input_tokens: 8,
                  output_tokens: 12
                },
                model: 'claude-3-haiku-20240307',
                stop_reason: 'end_turn'
              }));
            }
            if (event === 'end') handler();
          })
        };
        callback(mockResponse);
        return { 
          on: jest.fn(), 
          end: jest.fn(),
          write: jest.fn()
        };
      });

      const response = await service.sendMessage(messages);
      expect(response.content).toBe('Hello from Claude!');
      expect(response.usage?.totalTokens).toBe(20);
    });
  });

  describe('AIManager', () => {
    let aiManager: AIManager;

    beforeEach(() => {
      aiManager = new AIManager(mockKeychainManager);
    });

    test('should initialize with keychain manager', () => {
      expect(aiManager).toBeInstanceOf(AIManager);
    });

    test('should handle service initialization', async () => {
      mockKeychainManager.getToken.mockResolvedValue('test-api-key');
      
      // Mock successful validation
      jest.spyOn(OpenAIService.prototype, 'validateApiKey').mockResolvedValue(true);
      
      const result = await aiManager.initializeService('openai');
      expect(result).toBe(true);
      expect(mockKeychainManager.getToken).toHaveBeenCalledWith('openai');
    });

    test('should handle missing API key', async () => {
      mockKeychainManager.getToken.mockResolvedValue(null);
      
      const result = await aiManager.initializeService('openai');
      expect(result).toBe(false);
    });

    test('should handle invalid API key', async () => {
      mockKeychainManager.getToken.mockResolvedValue('invalid-key');
      jest.spyOn(OpenAIService.prototype, 'validateApiKey').mockResolvedValue(false);
      
      const result = await aiManager.initializeService('openai');
      expect(result).toBe(false);
    });

    test('should initialize all services', async () => {
      mockKeychainManager.getToken
        .mockResolvedValueOnce('openai-key')
        .mockResolvedValueOnce('gemini-key')
        .mockResolvedValueOnce(null); // Claude key missing

      jest.spyOn(OpenAIService.prototype, 'validateApiKey').mockResolvedValue(true);
      jest.spyOn(GeminiService.prototype, 'validateApiKey').mockResolvedValue(true);

      const results = await aiManager.initializeAllServices();
      
      expect(results.openai).toBe(true);
      expect(results.gemini).toBe(true);
      expect(results.claude).toBe(false);
    });

    test('should send messages to initialized services', async () => {
      // Setup initialized service
      mockKeychainManager.getToken.mockResolvedValue('test-key');
      jest.spyOn(OpenAIService.prototype, 'validateApiKey').mockResolvedValue(true);
      jest.spyOn(OpenAIService.prototype, 'sendMessage').mockResolvedValue({
        content: 'Test response',
        usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 }
      });

      await aiManager.initializeService('openai');
      
      const response = await aiManager.sendMessage('openai', 'Hello');
      expect(response).toBe('Test response');
    });

    test('should handle connection testing', async () => {
      // Setup service
      mockKeychainManager.getToken.mockResolvedValue('test-key');
      jest.spyOn(OpenAIService.prototype, 'validateApiKey').mockResolvedValue(true);
      jest.spyOn(OpenAIService.prototype, 'sendMessage').mockResolvedValue({
        content: 'Connection test successful'
      });

      await aiManager.initializeService('openai');
      
      const result = await aiManager.testConnection('openai');
      expect(result).toBe(true);
    });

    test('should handle web page analysis', async () => {
      // Setup service with specialized method
      mockKeychainManager.getToken.mockResolvedValue('test-key');
      jest.spyOn(OpenAIService.prototype, 'validateApiKey').mockResolvedValue(true);
      jest.spyOn(OpenAIService.prototype, 'analyzeWebPage').mockResolvedValue('Page analysis result');

      await aiManager.initializeService('openai');
      
      const result = await aiManager.analyzeWebPage('openai', '<html>Test page</html>', 'What is this page about?');
      expect(result).toBe('Page analysis result');
    });

    test('should get available services', async () => {
      mockKeychainManager.getToken.mockResolvedValue('test-key');
      jest.spyOn(OpenAIService.prototype, 'validateApiKey').mockResolvedValue(true);
      jest.spyOn(GeminiService.prototype, 'validateApiKey').mockResolvedValue(true);

      await aiManager.initializeService('openai');
      await aiManager.initializeService('gemini');
      
      const services = aiManager.getAvailableServices();
      expect(services).toContain('openai');
      expect(services).toContain('gemini');
      expect(services).toHaveLength(2);
    });

    test('should check service initialization status', async () => {
      expect(aiManager.isServiceInitialized('openai')).toBe(false);
      
      mockKeychainManager.getToken.mockResolvedValue('test-key');
      jest.spyOn(OpenAIService.prototype, 'validateApiKey').mockResolvedValue(true);
      
      await aiManager.initializeService('openai');
      expect(aiManager.isServiceInitialized('openai')).toBe(true);
    });

    test('should handle service removal', async () => {
      mockKeychainManager.getToken.mockResolvedValue('test-key');
      jest.spyOn(OpenAIService.prototype, 'validateApiKey').mockResolvedValue(true);
      
      await aiManager.initializeService('openai');
      expect(aiManager.isServiceInitialized('openai')).toBe(true);
      
      aiManager.removeService('openai');
      expect(aiManager.isServiceInitialized('openai')).toBe(false);
    });

    test('should manage active service', () => {
      expect(aiManager.getActiveService()).toBe('openai'); // default
      
      aiManager.setActiveService('claude');
      expect(aiManager.getActiveService()).toBe('claude');
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors appropriately', () => {
      const service = new OpenAIService({ apiKey: 'test-key' });
      
      const networkError = { code: 'ENOTFOUND' };
      expect(() => {
        (service as any).handleError(networkError, 'test operation');
      }).toThrow('Network error connecting to OpenAI');
    });

    test('should handle authentication errors', () => {
      const service = new OpenAIService({ apiKey: 'test-key' });
      
      const authError = { response: { status: 401 } };
      expect(() => {
        (service as any).handleError(authError, 'test operation');
      }).toThrow('OpenAI authentication failed');
    });

    test('should handle rate limit errors', () => {
      const service = new GeminiService({ apiKey: 'test-key' });
      
      const rateLimitError = { response: { status: 429 } };
      expect(() => {
        (service as any).handleError(rateLimitError, 'test operation');
      }).toThrow('Gemini rate limit exceeded');
    });

    test('should handle server errors', () => {
      const service = new ClaudeService({ apiKey: 'test-key' });
      
      const serverError = { response: { status: 500 } };
      expect(() => {
        (service as any).handleError(serverError, 'test operation');
      }).toThrow('Claude server error');
    });

    test('should handle timeout errors', () => {
      const service = new OpenAIService({ apiKey: 'test-key' });
      
      const timeoutError = { code: 'TIMEOUT' };
      expect(() => {
        (service as any).handleError(timeoutError, 'test operation');
      }).toThrow('OpenAI request timed out');
    });
  });
});