// Browser context system for providing rich state information to AI agents

export interface ElementInfo {
  selector: string;
  tag: string;
  type?: string;
  text?: string;
  placeholder?: string;
  value?: string;
  href?: string;
  title?: string;
  ariaLabel?: string;
  id?: string;
  className?: string;
  isClickable: boolean;
  isVisible: boolean;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FormFieldInfo {
  id?: string;
  className?: string;
  selector: string;
  name?: string;
  type: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  label?: string;
}

export interface LinkInfo {
  text: string;
  href: string;
  title?: string;
  isExternal: boolean;
  id?: string;
  className?: string;
}

export interface BrowserContext {
  // Basic page information
  currentUrl: string;
  pageTitle: string;
  domain: string;
  protocol: string;
  
  // Page content
  pageContent: string;
  contentSummary?: string;
  
  // Interactive elements
  clickableElements: ElementInfo[];
  formFields: FormFieldInfo[];
  links: LinkInfo[];
  buttons: ElementInfo[];
  inputs: ElementInfo[];
  
  // Visual context
  screenshot?: Buffer;
  viewportSize: {
    width: number;
    height: number;
  };
  scrollPosition: {
    x: number;
    y: number;
  };
  
  // Navigation context
  canGoBack: boolean;
  canGoForward: boolean;
  navigationHistory: string[];
  
  // Error context
  error?: string;
  lastActionError?: string;
  
  // Metadata
  timestamp: number;
  loadTime?: number;
  performance?: {
    domContentLoaded: number;
    loadComplete: number;
  };
}

export interface BrowserContextOptions {
  includeScreenshot?: boolean;
  includeFullContent?: boolean;
  includeInvisibleElements?: boolean;
  maxContentLength?: number;
  maxElementsPerType?: number;
}

export class BrowserContextManager {
  private currentContext: BrowserContext | null = null;
  private contextHistory: BrowserContext[] = [];
  private maxHistorySize: number = 10;

  constructor() {}

  // Get the current browser context
  getCurrentContext(): BrowserContext | null {
    return this.currentContext;
  }

  // Update the current context
  updateContext(context: BrowserContext): void {
    // Store previous context in history
    if (this.currentContext) {
      this.contextHistory.push(this.currentContext);
      
      // Limit history size
      if (this.contextHistory.length > this.maxHistorySize) {
        this.contextHistory.shift();
      }
    }
    
    this.currentContext = context;
  }

  // Get context history
  getContextHistory(): BrowserContext[] {
    return [...this.contextHistory];
  }

  // Create a summary of the current context for AI
  createContextSummary(options: BrowserContextOptions = {}): string {
    if (!this.currentContext) {
      return 'No browser context available.';
    }

    const ctx = this.currentContext;
    const parts: string[] = [];

    // Basic page info
    parts.push(`Current Page: ${ctx.pageTitle || 'Untitled'}`);
    parts.push(`URL: ${ctx.currentUrl}`);
    parts.push(`Domain: ${ctx.domain}`);

    // Navigation state
    if (ctx.canGoBack || ctx.canGoForward) {
      const navState = [];
      if (ctx.canGoBack) navState.push('can go back');
      if (ctx.canGoForward) navState.push('can go forward');
      parts.push(`Navigation: ${navState.join(', ')}`);
    }

    // Content summary
    if (ctx.contentSummary) {
      parts.push(`Content: ${ctx.contentSummary}`);
    } else if (ctx.pageContent && options.includeFullContent !== false) {
      const maxLength = options.maxContentLength || 500;
      const content = ctx.pageContent.length > maxLength 
        ? ctx.pageContent.substring(0, maxLength) + '...'
        : ctx.pageContent;
      parts.push(`Content: ${content}`);
    }

    // Interactive elements
    if (ctx.buttons && ctx.buttons.length > 0) {
      const maxButtons = options.maxElementsPerType || 5;
      const buttonList = ctx.buttons
        .slice(0, maxButtons)
        .map(btn => `"${btn.text || btn.selector}"`)
        .join(', ');
      parts.push(`Buttons: ${buttonList}${ctx.buttons.length > maxButtons ? '...' : ''}`);
    }

    if (ctx.links && ctx.links.length > 0) {
      const maxLinks = options.maxElementsPerType || 5;
      const linkList = ctx.links
        .slice(0, maxLinks)
        .map(link => `"${link.text}" (${link.href})`)
        .join(', ');
      parts.push(`Links: ${linkList}${ctx.links.length > maxLinks ? '...' : ''}`);
    }

    if (ctx.formFields && ctx.formFields.length > 0) {
      const maxFields = options.maxElementsPerType || 5;
      const fieldList = ctx.formFields
        .slice(0, maxFields)
        .map(field => `${field.type}${field.label ? ` "${field.label}"` : ''}${field.placeholder ? ` (${field.placeholder})` : ''}`)
        .join(', ');
      parts.push(`Form Fields: ${fieldList}${ctx.formFields.length > maxFields ? '...' : ''}`);
    }

    // Error context
    if (ctx.lastActionError) {
      parts.push(`Last Error: ${ctx.lastActionError}`);
    }

    return parts.join('\n');
  }

  // Create AI-friendly context for tool use
  createToolContext(): any {
    if (!this.currentContext) {
      return null;
    }

    const ctx = this.currentContext;
    
    return {
      page: {
        url: ctx.currentUrl,
        title: ctx.pageTitle,
        domain: ctx.domain,
        canGoBack: ctx.canGoBack,
        canGoForward: ctx.canGoForward
      },
      elements: {
        buttons: (ctx.buttons || []).map(btn => ({
          selector: btn.selector,
          text: btn.text,
          visible: btn.isVisible
        })),
        links: (ctx.links || []).map(link => ({
          text: link.text,
          href: link.href,
          external: link.isExternal
        })),
        formFields: (ctx.formFields || []).map(field => ({
          selector: field.selector,
          name: field.name,
          type: field.type,
          label: field.label,
          placeholder: field.placeholder,
          required: field.required,
          id: field.id,
          className: field.className
        }))
      },
      viewport: ctx.viewportSize,
      scroll: ctx.scrollPosition,
      timestamp: ctx.timestamp
    };
  }

  // Clear context (e.g., when navigating to a new domain)
  clearContext(): void {
    this.currentContext = null;
    this.contextHistory = [];
  }

  // Get page change summary (useful for AI to understand what changed)
  getPageChangeSummary(): string | null {
    if (!this.currentContext || this.contextHistory.length === 0) {
      return null;
    }

    const current = this.currentContext;
    const previous = this.contextHistory[this.contextHistory.length - 1];

    const changes: string[] = [];

    // URL change
    if (current.currentUrl !== previous.currentUrl) {
      changes.push(`Navigated from ${previous.currentUrl} to ${current.currentUrl}`);
    }

    // Title change
    if (current.pageTitle !== previous.pageTitle) {
      changes.push(`Page title changed from "${previous.pageTitle}" to "${current.pageTitle}"`);
    }

    // New elements
    const newButtons = current.buttons.filter(btn => 
      !previous.buttons.some(prevBtn => prevBtn.selector === btn.selector)
    );
    if (newButtons.length > 0) {
      changes.push(`${newButtons.length} new buttons appeared`);
    }

    // Error context
    if (current.lastActionError) {
      changes.push(`Error occurred: ${current.lastActionError}`);
    }

    return changes.length > 0 ? changes.join('; ') : null;
  }
}