// Service for extracting rich browser context from pages

import { BrowserContext, ElementInfo, FormFieldInfo, LinkInfo, BrowserContextOptions } from '../../shared/browser-context';
import { PuppeteerManager } from '../automation/puppeteer-manager';

export class BrowserContextService {
  private puppeteerManager: PuppeteerManager;

  constructor(puppeteerManager: PuppeteerManager) {
    this.puppeteerManager = puppeteerManager;
  }

  // Extract complete browser context from a page
  async extractContext(pageId: string, options: BrowserContextOptions = {}): Promise<BrowserContext> {
    try {
      const startTime = Date.now();

      // Get basic page info
      const pageInfo = await this.getBasicPageInfo(pageId);
      
      // Get page content
      const contentResult = await this.puppeteerManager.getPageContent(pageId, false);
      const pageContent = contentResult.success ? contentResult.data?.text || '' : '';
      
      // Extract interactive elements
      const elements = await this.extractInteractiveElements(pageId, options);
      
      // Get navigation state
      const navigationState = await this.getNavigationState(pageId);
      
      // Get viewport and scroll info
      const viewportInfo = await this.getViewportInfo(pageId);
      
      // Get screenshot if requested
      let screenshot: Buffer | undefined;
      if (options.includeScreenshot) {
        const screenshotResult = await this.puppeteerManager.takeScreenshot(pageId, false);
        if (screenshotResult.success) {
          screenshot = screenshotResult.screenshot;
        }
      }

      const context: BrowserContext = {
        currentUrl: pageInfo.url,
        pageTitle: pageInfo.title,
        domain: pageInfo.domain,
        protocol: pageInfo.protocol,
        pageContent: pageContent,
        contentSummary: this.createContentSummary(pageContent, options.maxContentLength),
        clickableElements: elements.clickable,
        formFields: elements.forms,
        links: elements.links,
        buttons: elements.buttons,
        inputs: elements.inputs,
        screenshot,
        viewportSize: viewportInfo.viewport,
        scrollPosition: viewportInfo.scroll,
        canGoBack: navigationState.canGoBack,
        canGoForward: navigationState.canGoForward,
        navigationHistory: navigationState.history,
        timestamp: Date.now(),
        loadTime: Date.now() - startTime
      };

      return context;

    } catch (error) {
      console.error('Failed to extract browser context:', error);
      
      // Return minimal context on error
      return {
        currentUrl: 'unknown',
        pageTitle: 'Error',
        domain: 'unknown',
        protocol: 'unknown',
        pageContent: '',
        clickableElements: [],
        formFields: [],
        links: [],
        buttons: [],
        inputs: [],
        viewportSize: { width: 0, height: 0 },
        scrollPosition: { x: 0, y: 0 },
        canGoBack: false,
        canGoForward: false,
        navigationHistory: [],
        error: (error as Error).message,
        timestamp: Date.now()
      };
    }
  }

  // Get basic page information
  private async getBasicPageInfo(pageId: string): Promise<{
    url: string;
    title: string;
    domain: string;
    protocol: string;
  }> {
    const result = await this.puppeteerManager.evaluateScript(pageId, `
      ({
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname,
        protocol: window.location.protocol
      })
    `);

    if (result.success) {
      return result.data;
    }

    return {
      url: 'unknown',
      title: 'Unknown',
      domain: 'unknown',
      protocol: 'unknown'
    };
  }

  // Extract interactive elements from the page
  private async extractInteractiveElements(pageId: string, options: BrowserContextOptions): Promise<{
    clickable: ElementInfo[];
    forms: FormFieldInfo[];
    links: LinkInfo[];
    buttons: ElementInfo[];
    inputs: ElementInfo[];
  }> {
    const script = `
      (() => {
        const getElementInfo = (el) => {
          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 && 
                          window.getComputedStyle(el).visibility !== 'hidden' &&
                          window.getComputedStyle(el).display !== 'none';
          
          return {
            selector: generateSelector(el),
            tag: el.tagName.toLowerCase(),
            type: el.type || '',
            text: el.textContent?.trim().substring(0, 100) || '',
            placeholder: el.placeholder || '',
            value: el.value || '',
            href: el.href || '',
            title: el.title || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            id: el.id || '',
            className: (typeof el.className === 'string' ? el.className : el.className?.toString()) || '',
            isClickable: isClickableElement(el),
            isVisible: isVisible,
            bounds: isVisible ? {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            } : undefined
          };
        };

        const generateSelector = (el) => {
          if (el.id) return '#' + el.id;
          if (el.className) {
            // Handle both string and DOMTokenList cases
            const classNameStr = typeof el.className === 'string' ? el.className : el.className.toString();
            const classes = classNameStr.split(' ').filter(c => c.length > 0);
            if (classes.length > 0) return '.' + classes[0];
          }
          return el.tagName.toLowerCase();
        };

        const isClickableElement = (el) => {
          const clickableTags = ['button', 'a', 'input', 'select', 'textarea'];
          const clickableTypes = ['button', 'submit', 'reset'];
          const clickableRoles = ['button', 'link', 'tab', 'menuitem'];
          
          return clickableTags.includes(el.tagName.toLowerCase()) ||
                 clickableTypes.includes(el.type) ||
                 clickableRoles.includes(el.getAttribute('role')) ||
                 el.onclick !== null ||
                 el.getAttribute('onclick') !== null ||
                 window.getComputedStyle(el).cursor === 'pointer';
        };

        // Extract different types of elements
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]'))
          .map(getElementInfo)
          .filter(el => ${options.includeInvisibleElements ? 'true' : 'el.isVisible'})
          .slice(0, ${options.maxElementsPerType || 20});

        const links = Array.from(document.querySelectorAll('a[href]'))
          .map(el => ({
            text: el.textContent?.trim().substring(0, 100) || '',
            href: el.href,
            title: el.title || '',
            isExternal: !el.href.startsWith(window.location.origin),
            id: el.id || '',
            className: (typeof el.className === 'string' ? el.className : el.className?.toString()) || ''
          }))
          .filter(link => link.text.length > 0)
          .slice(0, ${options.maxElementsPerType || 20});

        const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
          .map(getElementInfo)
          .filter(el => ${options.includeInvisibleElements ? 'true' : 'el.isVisible'})
          .slice(0, ${options.maxElementsPerType || 20});

        const formFields = Array.from(document.querySelectorAll('input, textarea, select'))
          .map(el => ({
            selector: generateSelector(el),
            name: el.name || '',
            type: el.type || el.tagName.toLowerCase(),
            placeholder: el.placeholder || '',
            value: el.value || '',
            required: el.required || false,
            label: (el.labels && el.labels[0] ? el.labels[0].textContent?.trim() : '') ||
                   (el.getAttribute('aria-label')) ||
                   (document.querySelector('label[for="' + el.id + '"]')?.textContent?.trim()) || '',
            // Additional attributes for better search detection
            id: el.id || '',
            className: (typeof el.className === 'string' ? el.className : el.className?.toString()) || '',
            title: el.title || '',
            role: el.getAttribute('role') || '',
            autocomplete: el.getAttribute('autocomplete') || ''
          }))
          .filter(field => ${options.includeInvisibleElements ? 'true' : 'field.type !== "hidden"'})
          .slice(0, ${options.maxElementsPerType || 20});

        const clickableElements = Array.from(document.querySelectorAll('*'))
          .filter(isClickableElement)
          .map(getElementInfo)
          .filter(el => ${options.includeInvisibleElements ? 'true' : 'el.isVisible'} && el.text.length > 0)
          .slice(0, ${options.maxElementsPerType || 30});

        return {
          buttons,
          links,
          inputs,
          formFields,
          clickable: clickableElements
        };
      })()
    `;

    const result = await this.puppeteerManager.evaluateScript(pageId, script);
    
    if (result.success) {
      return result.data;
    }

    return {
      clickable: [],
      forms: [],
      links: [],
      buttons: [],
      inputs: []
    };
  }

  // Get navigation state
  private async getNavigationState(pageId: string): Promise<{
    canGoBack: boolean;
    canGoForward: boolean;
    history: string[];
  }> {
    const script = `
      ({
        canGoBack: window.history.length > 1,
        canGoForward: false, // Can't reliably detect this
        history: [] // Browser security prevents accessing history
      })
    `;

    const result = await this.puppeteerManager.evaluateScript(pageId, script);
    
    if (result.success) {
      return result.data;
    }

    return {
      canGoBack: false,
      canGoForward: false,
      history: []
    };
  }

  // Get viewport and scroll information
  private async getViewportInfo(pageId: string): Promise<{
    viewport: { width: number; height: number };
    scroll: { x: number; y: number };
  }> {
    const script = `
      ({
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        scroll: {
          x: window.scrollX || window.pageXOffset,
          y: window.scrollY || window.pageYOffset
        }
      })
    `;

    const result = await this.puppeteerManager.evaluateScript(pageId, script);
    
    if (result.success) {
      return result.data;
    }

    return {
      viewport: { width: 1366, height: 768 },
      scroll: { x: 0, y: 0 }
    };
  }

  // Create a content summary
  private createContentSummary(content: string, maxLength: number = 200): string {
    if (!content || content.length === 0) {
      return 'No content available';
    }

    // Clean up the content
    const cleaned = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    // Find a good break point near the max length
    const truncated = cleaned.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  // Quick context update for action results
  async updateContextAfterAction(pageId: string, action: string, result: any): Promise<void> {
    // This can be used to quickly update context after an action
    // without doing a full context extraction
    
    if (!result.success && result.error) {
      console.warn(`Action ${action} failed:`, result.error);
    }
  }
}