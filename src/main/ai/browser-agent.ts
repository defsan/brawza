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

  constructor(aiManager: AIManager, puppeteerManager: PuppeteerManager) {
    this.aiManager = aiManager;
    this.toolExecutor = new BrowserToolExecutor(puppeteerManager);
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
        // includeScreenshot: options.includeScreenshot,
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

      console.log(`\n=== USER MESSAGE ===`);
      console.log(`User message: "${userMessage}"`);
      console.log(`\n=== CONTEXT ===`);
      console.log(`Context: ${contextualSystemPrompt}`);

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

      // Log raw AI response for debugging
      console.log(`\n=== RAW AI RESPONSE ===`);
      console.log(`Service: ${options.serviceType}`);
      console.log(`Content: "${response.content}"`);
      console.log(`Tool Calls: ${response.toolCalls?.length || 0} calls`);
      if (response.toolCalls && response.toolCalls.length > 0) {
        response.toolCalls.forEach((call, index) => {
          console.log(`  Call ${index + 1}: ${call.name}(${JSON.stringify(call.arguments)})`);
        });
      }
      console.log(`=======================\n`);

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
          options
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
        await this.toolExecutor.updateContext(options.pageId);
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
    options: AgentExecutionOptions
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


SAFETY:
- Never submit forms with sensitive information without explicit confirmation
- Avoid clicking on suspicious links or downloads
- Don't execute arbitrary JavaScript that could be harmful
- Ask for permission before making purchases or financial transactions

Remember: You're helping the user browse and automate their web interactions. Work WITH the current page context, not against it. Be helpful, safe, and explain your actions clearly.`;
  }

  // Create contextual system prompt with current page state
  private createContextualSystemPrompt(context: BrowserContext): string {
    const basePrompt = this.createSystemPrompt();
    
    // Analyze current page for search capabilities
    const searchAnalysis = this.analyzeSearchCapabilities(context);
    
    const contextInfo = `

CURRENT PAGE CONTEXT:
URL: ${context.currentUrl}
Title: ${context.pageTitle}
Domain: ${context.domain}

IMPORTANT: You are currently on ${context.domain}. The user expects you to work within THIS page unless they explicitly ask to go somewhere else.

Available Elements:
- Buttons: ${context.buttons?.length || 0} (${context.buttons?.map(b => `text:"${b.text || b.selector}"${b.type ? ` type:"${b.type}"` : ''}${b.placeholder ? ` placeholder:"${b.placeholder}"` : ''}${b.id ? ` id:"${b.id}"` : ''}${b.className ? ` class:"${b.className}"` : ''}`).join(', ') || 'none'})
- Links: ${context.links?.length || 0} (${context.links?.map(l => `text:"${l.text}", href:"${l.href}"${l.title ? ` title:"${l.title}"` : ''}${l.id ? ` id:"${l.id}"` : ''}${l.className ? ` class:"${l.className}"` : ''}`).join(', ') || 'none'})
- Form Fields: ${context.formFields?.length || 0} (${context.formFields?.map(f => `${f.type}${f.placeholder ? ` placeholder:"${f.placeholder}"` : ''}${f.id ? ` id:"${f.id}"` : ''}${f.className ? ` class:"${f.className}"` : ''}`).join(', ') || 'none'})

${searchAnalysis}

Navigation: ${context.canGoBack ? 'Can go back' : 'Cannot go back'}, ${context.canGoForward ? 'Can go forward' : 'Cannot go forward'}

CONTEXT-AWARE INSTRUCTIONS:
- If the user asks to search for something, look for search functionality on THIS page first (see search analysis above)
- Use the available elements listed above to understand what actions are possible on this page
- Only navigate away if the user explicitly requests it or if no suitable functionality exists on the current page
- Remember: The user is currently browsing ${context.pageTitle} on ${context.currentUrl} - work within this context`;

    return basePrompt + contextInfo;
  }
  
  // Analyze current page for search capabilities
  private analyzeSearchCapabilities(context: BrowserContext): string {
    const searchInputs = context.formFields?.filter(field => 
      field.type === 'search' || 
      field.placeholder?.toLowerCase().includes('search') ||
      field.name?.toLowerCase().includes('search') ||
      field.selector?.toLowerCase().includes('search') ||
      (field as any).id?.toLowerCase().includes('search') ||
      (field as any).className?.toLowerCase().includes('search') ||
      (field as any).title?.toLowerCase().includes('search') ||
      field.label?.toLowerCase().includes('search')
    ) || [];
    
    const searchButtons = context.buttons?.filter(button =>
      button.text?.toLowerCase().includes('search') ||
      button.selector?.toLowerCase().includes('search')
    ) || [];
    
    if (searchInputs.length > 0 || searchButtons.length > 0) {
      let searchInfo = '\nSEARCH CAPABILITIES DETECTED:\n';
      
      if (searchInputs.length > 0) {
        searchInfo += `- Search Inputs: ${searchInputs.map(input => 
          `${input.type} field${input.placeholder ? ` (placeholder: "${input.placeholder}")` : ''}${input.selector ? ` [${input.selector}]` : ''}`
        ).join(', ')}\n`;
      }
      
      if (searchButtons.length > 0) {
        searchInfo += `- Search Buttons: ${searchButtons.map(btn => 
          `"${btn.text}"${btn.selector ? ` [${btn.selector}]` : ''}`
        ).join(', ')}\n`;
      }
      
      searchInfo += '→ USE THESE ELEMENTS when the user asks to search for something on this page!\n';
      return searchInfo;
    }
    
    return '\nNO OBVIOUS SEARCH FUNCTIONALITY detected on this page. If user asks to search, you may need to navigate to a search engine.\n';
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