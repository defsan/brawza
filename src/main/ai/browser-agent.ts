// Browser Agent - Intelligent browser automation orchestrator

import { BaseAIService, AIMessage, AIResponse } from './base-service';
import { AIManager, AIServiceType } from './ai-manager';
import { BrowserToolExecutor, ToolExecutionOptions } from '../browser/browser-tool-executor';
import { BrowserToolCall, BrowserToolResult, getToolsForOpenAI, getToolsForClaude, ToolSafetyLevel } from '../../shared/browser-tools';
import { BrowserContext, BrowserContextOptions } from '../../shared/browser-context';
import { PuppeteerManager } from '../automation/puppeteer-manager';

export interface AgentConversation {
  id: string;
  messages: AIMessage[];
  currentUrl?: string;
  pageId: string;
  createdAt: number;
  lastActivity: number;
}

export interface AgentExecutionOptions {
  serviceType: AIServiceType;
  pageId: string;
  autoConfirm?: boolean;
  safetyLevel?: ToolSafetyLevel;
  maxIterations?: number;
  includeScreenshot?: boolean;
}

export interface AgentResponse {
  message: string;
  toolResults?: BrowserToolResult[];
  contextUpdate?: string;
  requiresConfirmation?: boolean;
  pendingActions?: BrowserToolCall[];
  screenshot?: Buffer;
}

export class BrowserAgent {
  private aiManager: AIManager;
  private toolExecutor: BrowserToolExecutor;
  private conversations: Map<string, AgentConversation> = new Map();
  private systemPrompt: string;

  constructor(aiManager: AIManager, puppeteerManager: PuppeteerManager) {
    this.aiManager = aiManager;
    this.toolExecutor = new BrowserToolExecutor(puppeteerManager);
    this.systemPrompt = this.createSystemPrompt();
  }

  // Create a new conversation or get existing one
  async createOrGetConversation(id: string, pageId: string, initialUrl?: string): Promise<AgentConversation> {
    if (this.conversations.has(id)) {
      const conversation = this.conversations.get(id)!;
      conversation.lastActivity = Date.now();
      return conversation;
    }

    const conversation: AgentConversation = {
      id,
      messages: [],
      currentUrl: initialUrl,
      pageId,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    this.conversations.set(id, conversation);
    return conversation;
  }

  // Send a message to the agent and get a response with actions
  async sendMessage(
    conversationId: string,
    userMessage: string,
    options: AgentExecutionOptions
  ): Promise<AgentResponse> {
    try {
      const conversation = await this.createOrGetConversation(conversationId, options.pageId);
      
      // Update browser context
      const context = await this.toolExecutor.updateContext(options.pageId, {
        includeScreenshot: options.includeScreenshot,
        maxContentLength: 2000
      });

      // Create enhanced system prompt with current context
      const contextualSystemPrompt = this.createContextualSystemPrompt(context);
      
      // Add system message with context (if this is a new conversation or context changed significantly)
      if (conversation.messages.length === 0 || this.hasContextChanged(conversation, context)) {
        conversation.messages.push({
          role: 'system',
          content: contextualSystemPrompt,
          timestamp: Date.now()
        });
      }

      // Add user message
      conversation.messages.push({
        role: 'user',
        content: userMessage,
        timestamp: Date.now()
      });

      // Get AI service and tools
      const service = this.aiManager.getService(options.serviceType);
      if (!service) {
        throw new Error(`AI service ${options.serviceType} is not available`);
      }

      let tools: any[] = [];
      if (service.supportsToolCalling()) {
        tools = this.getToolsForService(options.serviceType);
      }

      // Send message to AI service
      let response: AIResponse;
      if (service.supportsToolCalling() && tools.length > 0) {
        response = await service.sendMessageWithTools(conversation.messages, tools);
      } else {
        response = await service.sendMessage(conversation.messages);
      }

      // Process the response
      let agentResponse: AgentResponse = {
        message: response.content || 'I understand. Let me help you with that.',
        toolResults: [],
        screenshot: options.includeScreenshot ? context.screenshot : undefined
      };

      // Execute tool calls if present
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults = await this.executeToolCalls(
          response.toolCalls,
          options,
          conversation
        );

        agentResponse.toolResults = toolResults;

        // Add assistant message with tool calls to conversation
        conversation.messages.push({
          role: 'assistant',
          content: response.content || '',
          toolCalls: response.toolCalls,
          timestamp: Date.now()
        });

        // Add tool results to conversation
        for (let i = 0; i < response.toolCalls.length; i++) {
          const toolCall = response.toolCalls[i];
          const result = toolResults[i];
          
          conversation.messages.push({
            role: 'tool',
            content: this.formatToolResult(result),
            toolCallId: toolCall.id,
            timestamp: Date.now()
          });
        }

        // Get follow-up response from AI after tool execution
        if (toolResults.some(r => r.success)) {
          const followUpResponse = await this.getFollowUpResponse(service, conversation.messages, tools);
          if (followUpResponse.content) {
            agentResponse.message = followUpResponse.content;
          }
        }

        // Update context after actions
        const updatedContext = await this.toolExecutor.updateContext(options.pageId);
        const contextChange = this.toolExecutor.getContextSummary();
        if (contextChange) {
          agentResponse.contextUpdate = contextChange;
        }
      } else {
        // No tool calls, just add assistant message
        conversation.messages.push({
          role: 'assistant',
          content: response.content || '',
          timestamp: Date.now()
        });
      }

      conversation.lastActivity = Date.now();
      
      return agentResponse;

    } catch (error) {
      console.error('Agent message processing failed:', error);
      return {
        message: `I encountered an error: ${(error as Error).message}. Please try again.`,
        toolResults: []
      };
    }
  }

  // Execute tool calls from AI response
  private async executeToolCalls(
    toolCalls: BrowserToolCall[],
    options: AgentExecutionOptions,
    conversation: AgentConversation
  ): Promise<BrowserToolResult[]> {
    const results: BrowserToolResult[] = [];

    for (const toolCall of toolCalls) {
      console.log(`Executing tool: ${toolCall.name}`, toolCall.arguments);

      const executionOptions: ToolExecutionOptions = {
        pageId: options.pageId,
        autoConfirm: options.autoConfirm,
        safetyLevel: options.safetyLevel,
        updateContext: true
      };

      const result = await this.toolExecutor.executeTool(toolCall, executionOptions);
      results.push(result);

      // Add delay between actions for stability
      if (toolCalls.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  // Get follow-up response after tool execution
  private async getFollowUpResponse(
    service: BaseAIService,
    messages: AIMessage[],
    tools: any[]
  ): Promise<AIResponse> {
    try {
      if (service.supportsToolCalling()) {
        return await service.sendMessageWithTools(messages, tools);
      } else {
        return await service.sendMessage(messages);
      }
    } catch (error) {
      console.error('Follow-up response failed:', error);
      return {
        content: 'Actions completed successfully.'
      };
    }
  }

  // Format tool result for AI consumption
  private formatToolResult(result: BrowserToolResult): string {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    let response = result.message || 'Action completed successfully';
    
    if (result.data) {
      if (typeof result.data === 'string') {
        response += `\nResult: ${result.data}`;
      } else {
        response += `\nResult: ${JSON.stringify(result.data, null, 2)}`;
      }
    }

    return response;
  }

  // Create system prompt with browser capabilities
  private createSystemPrompt(): string {
    return `You are an intelligent browser automation agent. You can help users navigate websites, interact with elements, fill forms, and extract information.

CAPABILITIES:
- Navigate to URLs
- Click buttons and links
- Fill form fields
- Scroll pages
- Extract text and links
- Take screenshots
- Wait for elements to appear
- Execute custom JavaScript

GUIDELINES:
1. Always explain what you're doing before taking actions
2. For destructive actions (like form submissions), ask for confirmation
3. If an action fails, try alternative approaches
4. Provide clear feedback about what happened
5. Use screenshots when visual confirmation is helpful
6. Be proactive in suggesting next steps

SAFETY:
- Never submit forms with sensitive information without explicit confirmation
- Avoid clicking on suspicious links or downloads
- Don't execute arbitrary JavaScript that could be harmful
- Ask for permission before making purchases or financial transactions

Remember: You're helping the user browse and automate their web interactions. Be helpful, safe, and explain your actions clearly.`;
  }

  // Create contextual system prompt with current page state
  private createContextualSystemPrompt(context: BrowserContext): string {
    const basePrompt = this.createSystemPrompt();
    
    const contextInfo = `

CURRENT PAGE CONTEXT:
URL: ${context.currentUrl}
Title: ${context.pageTitle}
Domain: ${context.domain}

Available Elements:
- Buttons: ${context.buttons.length} (${context.buttons.slice(0, 3).map(b => `"${b.text || b.selector}"`).join(', ')}${context.buttons.length > 3 ? '...' : ''})
- Links: ${context.links.length} (${context.links.slice(0, 3).map(l => `"${l.text}"`).join(', ')}${context.links.length > 3 ? '...' : ''})
- Form Fields: ${context.formFields.length} (${context.formFields.slice(0, 3).map(f => f.type).join(', ')}${context.formFields.length > 3 ? '...' : ''})

Navigation: ${context.canGoBack ? 'Can go back' : 'Cannot go back'}, ${context.canGoForward ? 'Can go forward' : 'Cannot go forward'}

Use this context to make informed decisions about what actions to take.`;

    return basePrompt + contextInfo;
  }

  // Check if context has changed significantly
  private hasContextChanged(conversation: AgentConversation, context: BrowserContext): boolean {
    if (!conversation.currentUrl) {
      conversation.currentUrl = context.currentUrl;
      return true;
    }

    // URL changed
    if (conversation.currentUrl !== context.currentUrl) {
      conversation.currentUrl = context.currentUrl;
      return true;
    }

    // Could add more sophisticated context change detection here
    return false;
  }

  // Get tools for specific AI service
  private getToolsForService(serviceType: AIServiceType): any[] {
    switch (serviceType) {
      case 'openai':
        return getToolsForOpenAI();
      case 'claude':
        return getToolsForClaude();
      case 'gemini':
        // Gemini tools will be added when function calling is implemented
        return [];
      default:
        return [];
    }
  }

  // Get conversation history
  getConversation(id: string): AgentConversation | null {
    return this.conversations.get(id) || null;
  }

  // Clear conversation
  clearConversation(id: string): void {
    this.conversations.delete(id);
  }

  // Get all active conversations
  getActiveConversations(): AgentConversation[] {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    return Array.from(this.conversations.values())
      .filter(conv => now - conv.lastActivity < maxAge)
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }

  // Cleanup old conversations
  cleanupOldConversations(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [id, conversation] of this.conversations.entries()) {
      if (now - conversation.lastActivity > maxAge) {
        this.conversations.delete(id);
      }
    }
  }

  // Get current browser context
  getCurrentContext(): BrowserContext | null {
    return this.toolExecutor.getCurrentContext();
  }

  // Manual context update
  async updateContext(pageId: string, options: BrowserContextOptions = {}): Promise<BrowserContext> {
    return await this.toolExecutor.updateContext(pageId, options);
  }
}