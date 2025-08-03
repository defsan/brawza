import puppeteer, { Browser, Page, HTTPResponse } from 'puppeteer';
import { EventEmitter } from 'events';

export interface PageInfo {
  url: string;
  title: string;
  content?: string;
  screenshot?: Buffer;
  timestamp: number;
}

export interface AutomationResult {
  success: boolean;
  data?: any;
  error?: string;
  screenshot?: Buffer;
}

export class PuppeteerManager extends EventEmitter {
  private browser: Browser | null = null;
  private pages: Map<string, Page> = new Map();
  private isInitialized = false;
  private config = {
    headless: true,
    devtools: false,
    defaultViewport: { width: 1366, height: 768 },
    timeout: 30000
  };

  constructor() {
    super();
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing Puppeteer browser...');
      
      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        devtools: this.config.devtools,
        defaultViewport: this.config.defaultViewport,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      this.browser.on('disconnected', () => {
        console.log('Puppeteer browser disconnected');
        this.isInitialized = false;
        this.emit('browserDisconnected');
      });

      this.isInitialized = true;
      console.log('Puppeteer browser initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Puppeteer:', error);
      return false;
    }
  }

  async createPage(pageId: string): Promise<string> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    try {
      const page = await this.browser.newPage();
      
      // Set timeout
      page.setDefaultTimeout(this.config.timeout);
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Brawza/1.0');
      
      // Enable console logging
      page.on('console', (msg) => {
        console.log(`[Page ${pageId}] ${msg.type()}: ${msg.text()}`);
      });

      // Handle page errors
      page.on('error', (error) => {
        console.error(`[Page ${pageId}] Error:`, error);
        this.emit('pageError', { pageId, error });
      });

      // Handle navigation
      page.on('response', (response: HTTPResponse) => {
        if (response.url() === page.url()) {
          this.emit('pageNavigated', { pageId, url: response.url(), status: response.status() });
        }
      });

      this.pages.set(pageId, page);
      console.log(`Page ${pageId} created successfully`);
      return pageId;
    } catch (error) {
      console.error(`Failed to create page ${pageId}:`, error);
      throw error;
    }
  }

  async navigateToUrl(pageId: string, url: string): Promise<AutomationResult> {
    const page = this.pages.get(pageId);
    if (!page) {
      return { success: false, error: `Page ${pageId} not found` };
    }

    try {
      // Ensure URL has protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }

      console.log(`Navigating page ${pageId} to: ${url}`);
      const response = await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: this.config.timeout 
      });

      const pageInfo = await this.getPageInfo(pageId);
      
      return {
        success: true,
        data: {
          url: page.url(),
          title: await page.title(),
          status: response?.status(),
          pageInfo
        }
      };
    } catch (error) {
      console.error(`Navigation failed for page ${pageId}:`, error);
      return { 
        success: false, 
        error: `Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async getPageInfo(pageId: string): Promise<PageInfo | null> {
    const page = this.pages.get(pageId);
    if (!page) {
      return null;
    }

    try {
      const [url, title] = await Promise.all([
        page.url(),
        page.title()
      ]);

      return {
        url,
        title,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Failed to get page info for ${pageId}:`, error);
      return null;
    }
  }

  async getPageContent(pageId: string, includeHTML: boolean = false): Promise<AutomationResult> {
    const page = this.pages.get(pageId);
    if (!page) {
      return { success: false, error: `Page ${pageId} not found` };
    }

    try {
      let content: any = {};

      if (includeHTML) {
        content.html = await page.content();
      }

      // Extract text content
      content.text = await page.evaluate(() => document.body.innerText);
      
      // Extract meta information
      content.meta = await page.evaluate(() => {
        const description = document.querySelector('meta[name="description"]');
        const keywords = document.querySelector('meta[name="keywords"]');
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDescription = document.querySelector('meta[property="og:description"]');
        
        return {
          description: description?.getAttribute('content') || '',
          keywords: keywords?.getAttribute('content') || '',
          ogTitle: ogTitle?.getAttribute('content') || '',
          ogDescription: ogDescription?.getAttribute('content') || ''
        };
      });

      // Extract links
      content.links = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        return links.map(link => ({
          text: link.textContent?.trim() || '',
          href: link.getAttribute('href') || '',
          title: link.getAttribute('title') || ''
        })).filter(link => link.text && link.href);
      });

      return { success: true, data: content };
    } catch (error) {
      console.error(`Failed to get page content for ${pageId}:`, error);
      return { 
        success: false, 
        error: `Failed to get content: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async takeScreenshot(pageId: string, fullPage: boolean = false): Promise<AutomationResult> {
    const page = this.pages.get(pageId);
    if (!page) {
      return { success: false, error: `Page ${pageId} not found` };
    }

    try {
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage,
        quality: 80
      });

      return { 
        success: true, 
        data: { screenshot },
        screenshot: screenshot as Buffer
      };
    } catch (error) {
      console.error(`Failed to take screenshot for ${pageId}:`, error);
      return { 
        success: false, 
        error: `Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async clickElement(pageId: string, selector: string): Promise<AutomationResult> {
    const page = this.pages.get(pageId);
    if (!page) {
      return { success: false, error: `Page ${pageId} not found` };
    }

    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.click(selector);
      
      // Wait for potential navigation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { 
        success: true, 
        data: { 
          clicked: selector,
          currentUrl: page.url()
        }
      };
    } catch (error) {
      console.error(`Failed to click element ${selector} on page ${pageId}:`, error);
      return { 
        success: false, 
        error: `Click failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async fillForm(pageId: string, formData: Record<string, string>): Promise<AutomationResult> {
    const page = this.pages.get(pageId);
    if (!page) {
      return { success: false, error: `Page ${pageId} not found` };
    }

    try {
      const results: Record<string, boolean> = {};

      for (const [selector, value] of Object.entries(formData)) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          await page.keyboard.down('Control');
          await page.keyboard.press('KeyA');
          await page.keyboard.up('Control');
          await page.type(selector, value);
          results[selector] = true;
        } catch (error) {
          console.error(`Failed to fill ${selector}:`, error);
          results[selector] = false;
        }
      }

      return { 
        success: true, 
        data: { 
          formData: results,
          currentUrl: page.url()
        }
      };
    } catch (error) {
      console.error(`Failed to fill form on page ${pageId}:`, error);
      return { 
        success: false, 
        error: `Form fill failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async evaluateScript(pageId: string, script: string): Promise<AutomationResult> {
    const page = this.pages.get(pageId);
    if (!page) {
      return { success: false, error: `Page ${pageId} not found` };
    }

    try {
      const result = await page.evaluate(script);
      return { 
        success: true, 
        data: { result }
      };
    } catch (error) {
      console.error(`Failed to evaluate script on page ${pageId}:`, error);
      return { 
        success: false, 
        error: `Script evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async closePage(pageId: string): Promise<boolean> {
    const page = this.pages.get(pageId);
    if (!page) {
      return false;
    }

    try {
      await page.close();
      this.pages.delete(pageId);
      console.log(`Page ${pageId} closed successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to close page ${pageId}:`, error);
      return false;
    }
  }

  async getAllPages(): Promise<string[]> {
    return Array.from(this.pages.keys());
  }

  async getPageCount(): Promise<number> {
    return this.pages.size;
  }

  async updateConfig(newConfig: Partial<typeof this.config>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    console.log('Puppeteer configuration updated:', this.config);
  }

  isReady(): boolean {
    return this.isInitialized && this.browser !== null;
  }

  async cleanup(): Promise<void> {
    try {
      console.log('Cleaning up Puppeteer resources...');
      
      // Close all pages
      for (const [pageId, page] of this.pages) {
        try {
          await page.close();
        } catch (error) {
          console.error(`Failed to close page ${pageId}:`, error);
        }
      }
      this.pages.clear();

      // Close browser
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (error) {
          console.error('Failed to close browser:', error);
        }
        this.browser = null;
      }

      console.log('Puppeteer cleanup completed');
    } catch (error) {
      console.error('Error during Puppeteer cleanup:', error);
    } finally {
      // Always mark as not initialized, even if cleanup fails
      this.isInitialized = false;
    }
  }
}