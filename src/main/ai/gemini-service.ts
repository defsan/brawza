import { BaseAIService, AIMessage, AIResponse, AIServiceConfig } from './base-service';

export class GeminiService extends BaseAIService {
  constructor(config: AIServiceConfig) {
    super(config);
  }

  getServiceName(): string {
    return 'Gemini';
  }

  getDefaultModel(): string {
    return 'gemini-pro';
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
      const response = await this.makeHttpRequest(url, {
        method: 'GET'
      });

      return response.status === 200;
    } catch (error) {
      console.error('Gemini API key validation failed:', error);
      return false;
    }
  }

  async sendMessage(messages: AIMessage[]): Promise<AIResponse> {
    try {
      // Gemini uses a different message format
      const contents = this.convertMessagesToGeminiFormat(messages);

      const requestBody = {
        contents,
        generationConfig: {
          temperature: this.temperature,
          maxOutputTokens: this.maxTokens,
          topP: 0.8,
          topK: 10
        }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      
      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestBody
      });

      if (response.status !== 200) {
        throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      const data = response.data;
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response candidates returned from Gemini');
      }

      const candidate = data.candidates[0];
      
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error('Invalid response format from Gemini');
      }

      const responseText = candidate.content.parts[0].text;

      return {
        content: responseText,
        usage: data.usageMetadata ? {
          promptTokens: data.usageMetadata.promptTokenCount || 0,
          completionTokens: data.usageMetadata.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata.totalTokenCount || 0
        } : undefined,
        model: this.model,
        finishReason: candidate.finishReason
      };

    } catch (error) {
      this.handleError(error, 'sending message');
    }
  }

  private convertMessagesToGeminiFormat(messages: AIMessage[]): any[] {
    const contents: any[] = [];
    let systemMessage = '';

    // Extract system message and convert user/assistant messages
    for (const message of messages) {
      if (message.role === 'system') {
        systemMessage = message.content;
      } else {
        contents.push({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        });
      }
    }

    // If there's a system message, prepend it to the first user message
    if (systemMessage && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${systemMessage}\n\n${contents[0].parts[0].text}`;
    }

    return contents;
  }

  // Gemini-specific methods
  async listModels(): Promise<string[]> {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
      const response = await this.makeHttpRequest(url, {
        method: 'GET'
      });

      if (response.status !== 200) {
        throw new Error(`Failed to list models: ${response.status}`);
      }

      return response.data.models
        .filter((model: any) => model.name.includes('gemini'))
        .map((model: any) => model.name.split('/').pop())
        .sort();

    } catch (error) {
      console.error('Failed to list Gemini models:', error);
      return [this.getDefaultModel()]; // Return default if listing fails
    }
  }

  // Helper for web page analysis with Gemini
  async analyzeWebPage(pageContent: string, userQuery: string): Promise<string> {
    const systemPrompt = `You are an AI assistant helping users analyze web pages. 
    Analyze the provided web page content and answer the user's query accurately.
    Be concise but thorough in your analysis.`;

    const userPrompt = `Please analyze this web page content and answer my question.

Web page content:
${pageContent.substring(0, 10000)} ${pageContent.length > 10000 ? '...(content truncated)' : ''}

My question: ${userQuery}

Please provide a helpful analysis based on the page content.`;

    return await this.sendSingleMessage(userPrompt, systemPrompt);
  }

  // Helper for content summarization
  async summarizeContent(content: string): Promise<string> {
    const systemPrompt = `You are an expert at summarizing web content. 
    Create concise, informative summaries that capture the key points and main ideas.`;

    const userPrompt = `Please summarize this content:

${content.substring(0, 12000)} ${content.length > 12000 ? '...(content truncated)' : ''}

Create a clear, concise summary highlighting the main points.`;

    return await this.sendSingleMessage(userPrompt, systemPrompt);
  }

  // Helper for generating browser automation suggestions
  async suggestAutomation(pageContent: string, userGoal: string): Promise<string> {
    const systemPrompt = `You are an expert in web automation. Given page content and a user goal,
    suggest specific steps they could take to accomplish their objective.
    Be practical and specific about elements they should interact with.`;

    const userPrompt = `Page content:
${pageContent.substring(0, 8000)} ${pageContent.length > 8000 ? '...(truncated)' : ''}

User goal: ${userGoal}

Suggest specific automation steps:`;

    return await this.sendSingleMessage(userPrompt, systemPrompt);
  }

  // Helper for answering questions about page functionality
  async explainPageFunction(pageContent: string, userQuestion: string): Promise<string> {
    const systemPrompt = `You are a helpful assistant that explains how websites work.
    Based on the page content provided, explain website functionality and features to users.`;

    const userPrompt = `Here's a web page:
${pageContent.substring(0, 9000)} ${pageContent.length > 9000 ? '...(truncated)' : ''}

User question: ${userQuestion}

Please explain based on what you can see in the page content.`;

    return await this.sendSingleMessage(userPrompt, systemPrompt);
  }
}