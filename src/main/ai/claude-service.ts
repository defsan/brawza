import { BaseAIService, AIMessage, AIResponse, AIServiceConfig } from './base-service';

export class ClaudeService extends BaseAIService {
  constructor(config: AIServiceConfig) {
    super(config);
  }

  getServiceName(): string {
    return 'Claude';
  }

  getDefaultModel(): string {
    return 'claude-3-haiku-20240307';
  }

  supportsToolCalling(): boolean {
    return true; // Claude 3 supports tool use
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Test the API key with a simple request
      const response = await this.makeHttpRequest('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: {
          model: this.model,
          max_tokens: 10,
          messages: [{
            role: 'user',
            content: 'Test'
          }]
        }
      });

      return response.status === 200;
    } catch (error) {
      console.error('Claude API key validation failed:', error);
      return false;
    }
  }

  async sendMessage(messages: AIMessage[]): Promise<AIResponse> {
    try {
      // Claude uses a different format - separate system message from conversation
      const { systemMessage, conversationMessages } = this.processMessagesForClaude(messages);

      const requestBody: any = {
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: conversationMessages
      };

      // Add system message if present
      if (systemMessage) {
        requestBody.system = systemMessage;
      }

      const response = await this.makeHttpRequest('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: requestBody
      });

      if (response.status !== 200) {
        throw new Error(`Claude API error: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      const data = response.data;
      
      if (!data.content || data.content.length === 0) {
        throw new Error('No response content returned from Claude');
      }

      // Claude returns content as an array of content blocks
      const responseText = data.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');

      return {
        content: responseText,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        } : undefined,
        model: data.model,
        finishReason: data.stop_reason
      };

    } catch (error) {
      this.handleError(error, 'sending message');
    }
  }

  async sendMessageWithTools(messages: AIMessage[], tools?: any[]): Promise<AIResponse> {
    try {
      // Claude uses a different format - separate system message from conversation
      const { systemMessage, conversationMessages } = this.processMessagesForClaude(messages);

      const requestBody: any = {
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: conversationMessages
      };

      if (systemMessage) {
        requestBody.system = systemMessage;
      }

      if (tools && tools.length > 0) {
        requestBody.tools = tools;
      }

      const response = await this.makeHttpRequest('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: requestBody
      });

      if (response.status !== 200) {
        throw new Error(`Claude API error: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      const data = response.data;
      
      if (!data.content || data.content.length === 0) {
        throw new Error('No content returned from Claude');
      }

      // Handle text response
      let responseText = '';
      let toolCalls: any[] | undefined;
      
      for (const content of data.content) {
        if (content.type === 'text') {
          responseText += content.text;
        } else if (content.type === 'tool_use') {
          if (!toolCalls) toolCalls = [];
          toolCalls.push({
            id: content.id,
            name: content.name,
            arguments: content.input
          });
        }
      }

      return {
        content: responseText,
        toolCalls,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        } : undefined,
        model: data.model,
        finishReason: data.stop_reason
      };

    } catch (error) {
      this.handleError(error, 'sending message with tools');
    }
  }

  private processMessagesForClaude(messages: AIMessage[]): { systemMessage?: string; conversationMessages: any[] } {
    let systemMessage: string | undefined;
    const conversationMessages: any[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemMessage = message.content;
      } else {
        conversationMessages.push({
          role: message.role,
          content: message.content
        });
      }
    }

    return { systemMessage, conversationMessages };
  }

  // Claude-specific methods
  async getAvailableModels(): Promise<string[]> {
    // Claude models are not dynamically listed via API
    // Return known models as of the implementation date
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229', 
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2'
    ];
  }

  // Helper for detailed web page analysis
  async analyzeWebPage(pageContent: string, userQuery: string): Promise<string> {
    const systemPrompt = `You are Claude, an AI assistant created by Anthropic. You're helping a user analyze web pages.
    Provide thorough, accurate analysis based on the page content provided.
    Be helpful, harmless, and honest in your responses.`;

    const userPrompt = `I'm looking at a web page and have a question about it.

Web page content:
${pageContent.substring(0, 15000)} ${pageContent.length > 15000 ? '...(content continues but was truncated)' : ''}

My question: ${userQuery}

Please analyze the page content and provide a comprehensive answer to my question.`;

    return await this.sendSingleMessage(userPrompt, systemPrompt);
  }

  // Helper for generating detailed summaries
  async createDetailedSummary(content: string): Promise<string> {
    const systemPrompt = `You are an expert at creating comprehensive summaries. 
    Analyze the provided content and create a well-structured summary that captures:
    - Main topics and themes
    - Key information and data points  
    - Important conclusions or takeaways
    - Any actionable insights`;

    const userPrompt = `Please create a detailed summary of this content:

${content.substring(0, 20000)} ${content.length > 20000 ? '...(content continues but was truncated)' : ''}

Provide a comprehensive, well-organized summary.`;

    return await this.sendSingleMessage(userPrompt, systemPrompt);
  }

  // Helper for complex reasoning about web content
  async reasonAboutContent(pageContent: string, userQuery: string): Promise<string> {
    const systemPrompt = `You are Claude, an AI assistant that excels at careful reasoning and analysis.
    When analyzing web content, think step by step and consider multiple perspectives.
    Provide thoughtful, nuanced responses that demonstrate deep understanding.`;

    const userPrompt = `I need you to think carefully about this web page content and provide a reasoned response to my query.

Web page content:
${pageContent.substring(0, 18000)} ${pageContent.length > 18000 ? '...(content truncated for length)' : ''}

My query: ${userQuery}

Please think through this systematically and provide a well-reasoned response.`;

    return await this.sendSingleMessage(userPrompt, systemPrompt);
  }

  // Helper for generating automation strategies
  async planAutomation(pageContent: string, userObjective: string): Promise<string> {
    const systemPrompt = `You are an expert in web automation and user experience.
    Given page content and a user objective, create a detailed plan for achieving that objective.
    Consider the user's intent, available page elements, and potential challenges.`;

    const userPrompt = `Page content:
${pageContent.substring(0, 12000)} ${pageContent.length > 12000 ? '...(truncated)' : ''}

User objective: ${userObjective}

Please create a detailed automation plan including:
1. Analysis of what's available on the page
2. Step-by-step approach to achieve the objective
3. Potential challenges and how to handle them
4. Alternative approaches if the primary plan fails`;

    return await this.sendSingleMessage(userPrompt, systemPrompt);
  }

  // Helper for code and technical content analysis
  async analyzeCodeContent(pageContent: string, userQuestion: string): Promise<string> {
    const systemPrompt = `You are Claude, an AI assistant with expertise in programming and technical content.
    Analyze code, documentation, and technical content with precision and provide clear explanations.`;

    const userPrompt = `I'm looking at a technical page or documentation. Here's the content:

${pageContent.substring(0, 16000)} ${pageContent.length > 16000 ? '...(content truncated)' : ''}

My question: ${userQuestion}

Please provide a technical analysis and answer my question with appropriate detail.`;

    return await this.sendSingleMessage(userPrompt, systemPrompt);
  }
}