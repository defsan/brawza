// Browser tool executor for handling AI-requested browser actions

import { BrowserToolCall, BrowserToolResult, ToolSafetyLevel, TOOL_SAFETY_LEVELS } from '../../shared/browser-tools';
import { BrowserContext, BrowserContextManager, BrowserContextOptions } from '../../shared/browser-context';
import { PuppeteerManager } from '../automation/puppeteer-manager';
import { BrowserContextService } from './browser-context-service';

export interface ToolExecutionOptions {
  pageId: string;
  autoConfirm?: boolean;
  safetyLevel?: ToolSafetyLevel;
  updateContext?: boolean;
}

export class BrowserToolExecutor {
  private puppeteerManager: PuppeteerManager;
  private contextService: BrowserContextService;
  private contextManager: BrowserContextManager;

  constructor(puppeteerManager: PuppeteerManager) {
    this.puppeteerManager = puppeteerManager;
    this.contextService = new BrowserContextService(puppeteerManager);
    this.contextManager = new BrowserContextManager();
  }

  // Execute a browser tool call
  async executeTool(toolCall: BrowserToolCall, options: ToolExecutionOptions): Promise<BrowserToolResult> {
    try {
      console.log(`Executing tool: ${toolCall.name}`, toolCall.arguments);

      // Check if tool execution is allowed based on safety level
      const safetyLevel = TOOL_SAFETY_LEVELS[toolCall.name] || ToolSafetyLevel.MODERATE;
      if (!this.canExecuteTool(toolCall.name, safetyLevel, options)) {
        return {
          success: false,
          error: `Tool ${toolCall.name} requires ${safetyLevel} permission level`,
          message: `Please confirm execution of ${toolCall.name}`
        };
      }

      // Ensure Puppeteer page exists
      if (!this.puppeteerManager.isReady()) {
        const initialized = await this.puppeteerManager.initialize();
        if (!initialized) {
          return {
            success: false,
            error: 'Failed to initialize browser automation'
          };
        }
      }

      let result: BrowserToolResult;

      // Execute the specific tool
      switch (toolCall.name) {
        case 'navigate':
          result = await this.executeNavigate(toolCall.arguments, options);
          break;
        case 'click':
          result = await this.executeClick(toolCall.arguments, options);
          break;
        case 'type':
          result = await this.executeType(toolCall.arguments, options);
          break;
        case 'scroll':
          result = await this.executeScroll(toolCall.arguments, options);
          break;
        case 'screenshot':
          result = await this.executeScreenshot(toolCall.arguments, options);
          break;
        case 'extract_text':
          result = await this.executeExtractText(toolCall.arguments, options);
          break;
        case 'extract_links':
          result = await this.executeExtractLinks(toolCall.arguments, options);
          break;
        case 'wait_for_element':
          result = await this.executeWaitForElement(toolCall.arguments, options);
          break;
        case 'get_page_info':
          result = await this.executeGetPageInfo(toolCall.arguments, options);
          break;
        case 'fill_form':
          result = await this.executeFillForm(toolCall.arguments, options);
          break;
        case 'evaluate_script':
          result = await this.executeEvaluateScript(toolCall.arguments, options);
          break;
        default:
          result = {
            success: false,
            error: `Unknown tool: ${toolCall.name}`
          };
      }

      // Update context after action if requested
      if (options.updateContext && result.success) {
        try {
          const newContext = await this.contextService.extractContext(options.pageId, {
            includeScreenshot: false,
            maxContentLength: 1000
          });
          this.contextManager.updateContext(newContext);
        } catch (error) {
          console.warn('Failed to update context after action:', error);
        }
      }

      return result;

    } catch (error) {
      console.error(`Tool execution failed for ${toolCall.name}:`, error);
      return {
        success: false,
        error: `Tool execution failed: ${(error as Error).message}`
      };
    }
  }

  // Check if a tool can be executed based on safety level
  private canExecuteTool(toolName: string, safetyLevel: ToolSafetyLevel, options: ToolExecutionOptions): boolean {
    if (options.autoConfirm) {
      return true;
    }

    // For now, allow all safe actions and require confirmation for others
    return safetyLevel === ToolSafetyLevel.SAFE || 
           (options.safetyLevel !== undefined && safetyLevel <= options.safetyLevel);
  }

  // Tool implementations
  private async executeNavigate(args: any, options: ToolExecutionOptions): Promise<BrowserToolResult> {
    const { url } = args;
    if (!url) {
      return { success: false, error: 'URL is required for navigation' };
    }

    const result = await this.puppeteerManager.navigateToUrl(options.pageId, url);
    return {
      success: result.success,
      error: result.error,
      message: result.success ? `Navigated to ${url}` : undefined
    };
  }

  private async executeClick(args: any, options: ToolExecutionOptions): Promise<BrowserToolResult> {
    const { selector, description } = args;
    if (!selector) {
      return { success: false, error: 'Selector is required for click action' };
    }

    const result = await this.puppeteerManager.clickElement(options.pageId, selector);
    return {
      success: result.success,
      error: result.error,
      message: result.success ? `Clicked ${description || selector}` : undefined
    };
  }

  private async executeType(args: any, options: ToolExecutionOptions): Promise<BrowserToolResult> {
    const { selector, text, clear = true } = args;
    if (!selector || !text) {
      return { success: false, error: 'Selector and text are required for type action' };
    }

    // For now, use fill form with single field
    const formData: Record<string, string> = {};
    formData[selector] = text;

    const result = await this.puppeteerManager.fillForm(options.pageId, formData);
    return {
      success: result.success,
      error: result.error,
      message: result.success ? `Typed "${text}" into ${selector}` : undefined
    };
  }

  private async executeScroll(args: any, options: ToolExecutionOptions): Promise<BrowserToolResult> {
    const { direction, amount = 500 } = args;
    if (!direction) {
      return { success: false, error: 'Direction is required for scroll action' };
    }

    let script = '';
    switch (direction) {
      case 'up':
        script = `window.scrollBy(0, -${amount})`;
        break;
      case 'down':
        script = `window.scrollBy(0, ${amount})`;
        break;
      case 'left':
        script = `window.scrollBy(-${amount}, 0)`;
        break;
      case 'right':
        script = `window.scrollBy(${amount}, 0)`;
        break;
      default:
        return { success: false, error: `Invalid scroll direction: ${direction}` };
    }

    const result = await this.puppeteerManager.evaluateScript(options.pageId, script);
    return {
      success: result.success,
      error: result.error,
      message: result.success ? `Scrolled ${direction} by ${amount}px` : undefined
    };
  }

  private async executeScreenshot(args: any, options: ToolExecutionOptions): Promise<BrowserToolResult> {
    const { fullPage = false } = args;

    const result = await this.puppeteerManager.takeScreenshot(options.pageId, fullPage);
    return {
      success: result.success,
      error: result.error,
      screenshot: result.screenshot,
      message: result.success ? 'Screenshot captured' : undefined
    };
  }

  private async executeExtractText(args: any, options: ToolExecutionOptions): Promise<BrowserToolResult> {
    const { selector } = args;

    let script = '';
    if (selector) {
      script = `
        Array.from(document.querySelectorAll('${selector}'))
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length > 0)
          .join('\\n')
      `;
    } else {
      script = 'document.body.textContent?.trim() || ""';
    }

    const result = await this.puppeteerManager.evaluateScript(options.pageId, script);
    return {
      success: result.success,
      error: result.error,
      data: result.success ? result.data : undefined,
      message: result.success ? `Extracted text${selector ? ` from ${selector}` : ''}` : undefined
    };
  }

  private async executeExtractLinks(args: any, options: ToolExecutionOptions): Promise<BrowserToolResult> {
    const { filter } = args;

    const script = `
      Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({
          text: a.textContent?.trim() || '',
          href: a.href,
          title: a.title || ''
        }))
        .filter(link => link.text.length > 0 ${filter ? `&& (link.text.toLowerCase().includes('${filter.toLowerCase()}') || link.href.toLowerCase().includes('${filter.toLowerCase()}'))` : ''})
    `;

    const result = await this.puppeteerManager.evaluateScript(options.pageId, script);
    return {
      success: result.success,
      error: result.error,
      data: result.success ? result.data : undefined,
      message: result.success ? `Extracted ${result.data?.length || 0} links` : undefined
    };
  }

  private async executeWaitForElement(args: any, options: ToolExecutionOptions): Promise<BrowserToolResult> {
    const { selector, timeout = 5000 } = args;
    if (!selector) {
      return { success: false, error: 'Selector is required for wait action' };
    }

    const script = `
      new Promise((resolve, reject) => {
        const element = document.querySelector('${selector}');
        if (element) {
          resolve(true);
          return;
        }
        
        const observer = new MutationObserver(() => {
          if (document.querySelector('${selector}')) {
            observer.disconnect();
            resolve(true);
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        setTimeout(() => {
          observer.disconnect();
          reject(new Error('Element not found within timeout'));
        }, ${timeout});
      })
    `;

    const result = await this.puppeteerManager.evaluateScript(options.pageId, script);
    return {
      success: result.success,
      error: result.error,
      message: result.success ? `Element ${selector} found` : `Element ${selector} not found within ${timeout}ms`
    };
  }

  private async executeGetPageInfo(args: any, options: ToolExecutionOptions): Promise<BrowserToolResult> {
    try {
      const context = await this.contextService.extractContext(options.pageId, {
        includeScreenshot: false,
        maxContentLength: 500
      });

      const pageInfo = {
        url: context.currentUrl,
        title: context.pageTitle,
        domain: context.domain,
        buttons: context.buttons.length,
        links: context.links.length,
        formFields: context.formFields.length,
        canGoBack: context.canGoBack,
        canGoForward: context.canGoForward
      };

      return {
        success: true,
        data: pageInfo,
        message: 'Page information extracted'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get page info: ${(error as Error).message}`
      };
    }
  }

  private async executeFillForm(args: any, options: ToolExecutionOptions): Promise<BrowserToolResult> {
    const { fields } = args;
    if (!fields || typeof fields !== 'object') {
      return { success: false, error: 'Fields object is required for form filling' };
    }

    const result = await this.puppeteerManager.fillForm(options.pageId, fields);
    return {
      success: result.success,
      error: result.error,
      message: result.success ? `Filled ${Object.keys(fields).length} form fields` : undefined
    };
  }

  private async executeEvaluateScript(args: any, options: ToolExecutionOptions): Promise<BrowserToolResult> {
    const { script } = args;
    if (!script) {
      return { success: false, error: 'Script is required for evaluation' };
    }

    const result = await this.puppeteerManager.evaluateScript(options.pageId, script);
    return {
      success: result.success,
      error: result.error,
      data: result.success ? result.data : undefined,
      message: result.success ? 'Script executed successfully' : undefined
    };
  }

  // Get current context
  getCurrentContext(): BrowserContext | null {
    return this.contextManager.getCurrentContext();
  }

  // Update context manually
  async updateContext(pageId: string, options: BrowserContextOptions = {}): Promise<BrowserContext> {
    const context = await this.contextService.extractContext(pageId, options);
    this.contextManager.updateContext(context);
    return context;
  }

  // Get context summary for AI
  getContextSummary(options: BrowserContextOptions = {}): string {
    return this.contextManager.createContextSummary(options);
  }
}