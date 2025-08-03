import { PuppeteerManager, PageInfo, AutomationResult } from '../../src/main/automation/puppeteer-manager';
import puppeteer, { Browser, Page } from 'puppeteer';

// Mock Puppeteer
jest.mock('puppeteer');

describe('PuppeteerManager', () => {
  let puppeteerManager: PuppeteerManager;
  let mockBrowser: jest.Mocked<Browser>;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    puppeteerManager = new PuppeteerManager();
    
    // Create mock objects
    mockPage = {
      setDefaultTimeout: jest.fn(),
      setUserAgent: jest.fn(),
      on: jest.fn(),
      goto: jest.fn(),
      url: jest.fn().mockReturnValue('https://example.com'),
      title: jest.fn().mockReturnValue('Example Page'),
      content: jest.fn().mockReturnValue('<html><body>Test</body></html>'),
      evaluate: jest.fn(),
      screenshot: jest.fn(),
      waitForSelector: jest.fn(),
      click: jest.fn(),
      keyboard: { down: jest.fn(), press: jest.fn(), up: jest.fn() },
      type: jest.fn(),
      close: jest.fn()
    } as any;

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      on: jest.fn(),
      close: jest.fn()
    } as any;

    (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await puppeteerManager.initialize();
      
      expect(result).toBe(true);
      expect(puppeteer.launch).toHaveBeenCalledWith({
        headless: true,
        devtools: false,
        defaultViewport: { width: 1366, height: 768 },
        args: expect.arrayContaining([
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ])
      });
      expect(puppeteerManager.isReady()).toBe(true);
    });

    test('should handle initialization failure', async () => {
      (puppeteer.launch as jest.Mock).mockRejectedValue(new Error('Launch failed'));
      
      const result = await puppeteerManager.initialize();
      
      expect(result).toBe(false);
      expect(puppeteerManager.isReady()).toBe(false);
    });
  });

  describe('Page Management', () => {
    beforeEach(async () => {
      await puppeteerManager.initialize();
    });

    test('should create a new page', async () => {
      const pageId = await puppeteerManager.createPage('test-page');
      
      expect(pageId).toBe('test-page');
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(30000);
      expect(mockPage.setUserAgent).toHaveBeenCalled();
    });

    test('should navigate to URL', async () => {
      await puppeteerManager.createPage('test-page');
      
      const mockResponse = { status: () => 200 };
      mockPage.goto.mockResolvedValue(mockResponse as any);
      
      const result = await puppeteerManager.navigateToUrl('test-page', 'example.com');
      
      expect(result.success).toBe(true);
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      expect(result.data).toEqual({
        url: 'https://example.com',
        title: 'Example Page',
        status: 200,
        pageInfo: {
          url: 'https://example.com',
          title: 'Example Page',
          timestamp: expect.any(Number)
        }
      });
    });

    test('should handle navigation failure', async () => {
      await puppeteerManager.createPage('test-page');
      
      mockPage.goto.mockRejectedValue(new Error('Navigation timeout'));
      
      const result = await puppeteerManager.navigateToUrl('test-page', 'invalid-url');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Navigation failed');
    });

    test('should get page content', async () => {
      await puppeteerManager.createPage('test-page');
      
      mockPage.evaluate
        .mockResolvedValueOnce('Page text content') // innerText
        .mockResolvedValueOnce({ // meta info
          description: 'Test description',
          keywords: 'test, keywords',
          ogTitle: 'OG Title',
          ogDescription: 'OG Description'
        })
        .mockResolvedValueOnce([ // links
          { text: 'Link 1', href: '/link1', title: 'First link' },
          { text: 'Link 2', href: '/link2', title: 'Second link' }
        ]);

      const result = await puppeteerManager.getPageContent('test-page', true);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        html: '<html><body>Test</body></html>',
        text: 'Page text content',
        meta: {
          description: 'Test description',
          keywords: 'test, keywords',
          ogTitle: 'OG Title',
          ogDescription: 'OG Description'
        },
        links: [
          { text: 'Link 1', href: '/link1', title: 'First link' },
          { text: 'Link 2', href: '/link2', title: 'Second link' }
        ]
      });
    });

    test('should take screenshot', async () => {
      await puppeteerManager.createPage('test-page');
      
      const mockScreenshot = Buffer.from('fake-screenshot');
      mockPage.screenshot.mockResolvedValue(mockScreenshot);
      
      const result = await puppeteerManager.takeScreenshot('test-page', true);
      
      expect(result.success).toBe(true);
      expect(result.screenshot).toEqual(mockScreenshot);
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        type: 'png',
        fullPage: true,
        quality: 80
      });
    });

    test('should click element', async () => {
      await puppeteerManager.createPage('test-page');
      
      const result = await puppeteerManager.clickElement('test-page', '#button');
      
      expect(result.success).toBe(true);
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#button', { timeout: 5000 });
      expect(mockPage.click).toHaveBeenCalledWith('#button');
    });

    test('should fill form', async () => {
      await puppeteerManager.createPage('test-page');
      
      const formData = {
        '#name': 'John Doe',
        '#email': 'john@example.com'
      };
      
      const result = await puppeteerManager.fillForm('test-page', formData);
      
      expect(result.success).toBe(true);
      expect(mockPage.waitForSelector).toHaveBeenCalledTimes(2);
      expect(mockPage.click).toHaveBeenCalledTimes(2);
      expect(mockPage.type).toHaveBeenCalledWith('#name', 'John Doe');
      expect(mockPage.type).toHaveBeenCalledWith('#email', 'john@example.com');
    });

    test('should evaluate script', async () => {
      await puppeteerManager.createPage('test-page');
      
      mockPage.evaluate.mockResolvedValue('Script result');
      
      const result = await puppeteerManager.evaluateScript('test-page', 'document.title');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'Script result' });
      expect(mockPage.evaluate).toHaveBeenCalledWith('document.title');
    });

    test('should close page', async () => {
      await puppeteerManager.createPage('test-page');
      
      const result = await puppeteerManager.closePage('test-page');
      
      expect(result).toBe(true);
      expect(mockPage.close).toHaveBeenCalled();
    });

    test('should get all pages', async () => {
      await puppeteerManager.createPage('page1');
      await puppeteerManager.createPage('page2');
      
      const pages = await puppeteerManager.getAllPages();
      
      expect(pages).toEqual(['page1', 'page2']);
    });

    test('should get page count', async () => {
      await puppeteerManager.createPage('page1');
      await puppeteerManager.createPage('page2');
      
      const count = await puppeteerManager.getPageCount();
      
      expect(count).toBe(2);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await puppeteerManager.initialize();
    });

    test('should handle page not found errors', async () => {
      const result = await puppeteerManager.navigateToUrl('nonexistent-page', 'example.com');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Page nonexistent-page not found');
    });

    test('should handle screenshot errors', async () => {
      await puppeteerManager.createPage('test-page');
      
      mockPage.screenshot.mockRejectedValue(new Error('Screenshot failed'));
      
      const result = await puppeteerManager.takeScreenshot('test-page');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Screenshot failed');
    });

    test('should handle click errors', async () => {
      await puppeteerManager.createPage('test-page');
      
      mockPage.waitForSelector.mockRejectedValue(new Error('Element not found'));
      
      const result = await puppeteerManager.clickElement('test-page', '#nonexistent');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Click failed');
    });
  });

  describe('Configuration', () => {
    test('should update configuration', async () => {
      await puppeteerManager.initialize();
      
      await puppeteerManager.updateConfig({
        headless: false,
        timeout: 60000
      });
      
      // Configuration should be updated
      expect(puppeteerManager.isReady()).toBe(true);
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await puppeteerManager.initialize();
      await puppeteerManager.createPage('test-page');
    });

    test('should cleanup resources', async () => {
      await puppeteerManager.cleanup();
      
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(puppeteerManager.isReady()).toBe(false);
    });

    test('should handle cleanup errors gracefully', async () => {
      mockPage.close.mockRejectedValue(new Error('Close failed'));
      mockBrowser.close.mockRejectedValue(new Error('Browser close failed'));
      
      // Should not throw and should still mark as not ready
      await expect(puppeteerManager.cleanup()).resolves.toBeUndefined();
      
      // After cleanup attempt, it should no longer be ready (despite errors)
      expect(puppeteerManager.isReady()).toBe(false);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await puppeteerManager.initialize();
    });

    test('should emit events on page navigation', async () => {
      const navigationHandler = jest.fn();
      puppeteerManager.on('pageNavigated', navigationHandler);
      
      await puppeteerManager.createPage('test-page');
      
      // Simulate response event
      const responseHandler = (mockPage.on as jest.Mock).mock.calls
        .find(call => call[0] === 'response')[1];
      
      const mockResponse = {
        url: () => 'https://example.com',
        status: () => 200
      };
      
      mockPage.url.mockReturnValue('https://example.com');
      responseHandler(mockResponse);
      
      expect(navigationHandler).toHaveBeenCalledWith({
        pageId: 'test-page',
        url: 'https://example.com',
        status: 200
      });
    });

    test('should emit events on page errors', async () => {
      const errorHandler = jest.fn();
      puppeteerManager.on('pageError', errorHandler);
      
      await puppeteerManager.createPage('test-page');
      
      // Simulate error event
      const pageErrorHandler = (mockPage.on as jest.Mock).mock.calls
        .find(call => call[0] === 'error')[1];
      
      const testError = new Error('Page error');
      pageErrorHandler(testError);
      
      expect(errorHandler).toHaveBeenCalledWith({
        pageId: 'test-page',
        error: testError
      });
    });
  });
});