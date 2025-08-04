import { BaseAIService, AIMessage, AIResponse, AIServiceConfig } from './base-service';
import { BrowserToolCall } from '../../shared/browser-tools';

export class OpenAIService extends BaseAIService {
  constructor(config: AIServiceConfig) {
    super(config);
  }

  getServiceName(): string {
    return 'OpenAI';
  }

  getDefaultModel(): string {
    return 'gpt-3.5-turbo';
  }

  supportsToolCalling(): boolean {
    return true;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.makeHttpRequest('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.status === 200;
    } catch (error) {
      console.error('OpenAI API key validation failed:', error);
      return false;
    }
  }

  async sendMessage(messages: AIMessage[]): Promise<AIResponse> {
    try {
      const openaiMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const requestBody = {
        model: this.model,
        messages: openaiMessages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        user: 'brawza-user'
      };

      const response = await this.makeHttpRequest('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: requestBody
      });

      if (response.status !== 200) {
        throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      const data = response.data;
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response choices returned from OpenAI');
      }

      const choice = data.choices[0];
      
      return {
        content: choice.message.content,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined,
        model: data.model,
        finishReason: choice.finish_reason
      };

    } catch (error) {
      this.handleError(error, 'sending message');
    }
  }

  async sendMessageWithTools(messages: AIMessage[], tools?: any[]): Promise<AIResponse> {
    try {
      const openaiMessages = messages.map(msg => {
        if (msg.role === 'tool') {
          return {
            role: 'tool' as const,
            content: msg.content,
            tool_call_id: msg.toolCallId
          };
        } else if (msg.role === 'assistant' && msg.toolCalls) {
          return {
            role: 'assistant' as const,
            content: msg.content,
            tool_calls: msg.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments)
              }
            }))
          };
        } else {
          return {
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content
          };
        }
      });

      const requestBody: any = {
        model: this.model,
        messages: openaiMessages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        user: 'brawza-user'
      };

      if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = 'auto';
      }

      const response = await this.makeHttpRequest('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: requestBody
      });

      if (response.status !== 200) {
        throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      const data = response.data;
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response choices returned from OpenAI');
      }

      const choice = data.choices[0];
      const message = choice.message;
      
      // Parse tool calls if present
      let toolCalls: BrowserToolCall[] | undefined;
      if (message.tool_calls && message.tool_calls.length > 0) {
        toolCalls = message.tool_calls.map((tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        }));
      }
      
      return {
        content: message.content || '',
        toolCalls,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined,
        model: data.model,
        finishReason: choice.finish_reason
      };

    } catch (error) {
      this.handleError(error, 'sending message with tools');
    }
  }

  // OpenAI-specific methods
  async listModels(): Promise<string[]> {
    try {
      const response = await this.makeHttpRequest('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to list models: ${response.status}`);
      }

      return response.data.data
        .filter((model: any) => model.id.includes('gpt'))
        .map((model: any) => model.id)
        .sort();

    } catch (error) {
      console.error('Failed to list OpenAI models:', error);
      return [this.getDefaultModel()]; // Return default if listing fails
    }
  }

  async checkUsage(): Promise<any> {
    try {
      // Note: Usage endpoint might require different API access
      const response = await this.makeHttpRequest('https://api.openai.com/v1/usage', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data;
    } catch (error) {
      console.warn('Could not retrieve OpenAI usage data:', (error as Error).message);
      return null;
    }
  }

  // Helper for web page analysis
  async analyzeWebPage(pageContent: string, userQuery: string): Promise<string> {
    const systemPrompt = `You are an AI assistant helping users analyze web pages. 
    You will be given the content of a web page and a user query about it. 
    Provide helpful, accurate information based on the page content.
    If the page content is not relevant to the query, say so clearly.`;

    const userPrompt = `Web page content:
${pageContent.substring(0, 8000)} ${pageContent.length > 8000 ? '...(truncated)' : ''}

User query: ${userQuery}

Please analyze the page content and answer the user's query.`;

    return await this.sendSingleMessage(userPrompt, systemPrompt);
  }

  // Helper for generating automation commands
  async generateAutomationScript(pageContent: string, userIntent: string): Promise<string> {
    const systemPrompt = `You are an expert at browser automation. Given web page content and user intent,
    generate specific, actionable steps for browser automation. Focus on CSS selectors and actions.
    Format your response as a JSON array of steps with 'action' and 'selector' properties.
    Available actions: 'click', 'type', 'scroll', 'wait', 'navigate'.`;

    const userPrompt = `Page content:
${pageContent.substring(0, 6000)} ${pageContent.length > 6000 ? '...(truncated)' : ''}

User wants to: ${userIntent}

Generate automation steps:`;

    return await this.sendSingleMessage(userPrompt, systemPrompt);
  }
}