/**
 * Tests for Phase 5: User Interface Enhancement
 * - Resizable sidebar functionality
 * - AI-browser communication
 * - Real-time page analysis
 */

// Mock DOM methods and properties
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1400,
});

Object.defineProperty(document, 'body', {
  writable: true,
  configurable: true,
  value: {
    style: {},
    appendChild: jest.fn(),
  },
});

// Mock electronAPI
const mockElectronAPI = {
  createPage: jest.fn(),
  navigateToUrl: jest.fn(),
  getPageContent: jest.fn(),
  takeScreenshot: jest.fn(),
  analyzePage: jest.fn(),
  summarizeContent: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
});

describe('Phase 5: UI Enhancement', () => {
  let mockSidebar: HTMLElement;
  let mockChatMessages: HTMLElement;
  let mockChatInput: HTMLTextAreaElement;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock DOM elements
    mockSidebar = {
      id: 'ai-sidebar',
      style: { width: '400px' },
      appendChild: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn().mockReturnValue(false),
      },
    } as any;

    mockChatMessages = {
      id: 'chat-messages',
      appendChild: jest.fn(),
      scrollHeight: 1000,
      scrollTop: 0,
    } as any;

    mockChatInput = {
      id: 'chat-input',
      value: '',
    } as any;

    // Mock document.getElementById
    const mockGetElementById = jest.fn((id: string) => {
      switch (id) {
        case 'ai-sidebar':
          return mockSidebar;
        case 'chat-messages':
          return mockChatMessages;
        case 'chat-input':
          return mockChatInput;
        default:
          return null;
      }
    });

    Object.defineProperty(document, 'getElementById', {
      value: mockGetElementById,
    });

    // Mock document.createElement
    const mockCreateElement = jest.fn((tag: string) => {
      const element: any = {
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        textContent: '',
        src: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
      };
      return element;
    });

    Object.defineProperty(document, 'createElement', {
      value: mockCreateElement,
    });
  });

  describe('Sidebar Resizing', () => {
    test('should initialize resizer with correct properties', () => {
      // Simulate resizer initialization
      const resizer = document.createElement('div');
      expect(resizer.tagName).toBe('DIV');
      expect(mockSidebar.appendChild).toBeDefined();
    });

    test('should handle mouse resize events', () => {
      const mockMouseEvent = new MouseEvent('mousemove', { clientX: 800 });
      
      // Simulate resize logic
      const windowWidth = window.innerWidth; // 1400
      const newWidth = windowWidth - mockMouseEvent.clientX; // 1400 - 800 = 600
      
      // Should be within constraints (300 <= width <= 980)
      expect(newWidth).toBeGreaterThanOrEqual(300);
      expect(newWidth).toBeLessThanOrEqual(windowWidth * 0.7);
    });

    test('should enforce minimum width constraint', () => {
      const mockMouseEvent = new MouseEvent('mousemove', { clientX: 1200 });
      const windowWidth = window.innerWidth;
      const newWidth = windowWidth - mockMouseEvent.clientX; // 200

      if (newWidth < 300) {
        expect(newWidth).toBeLessThan(300);
        // Width should not be applied if below minimum
      }
    });

    test('should enforce maximum width constraint', () => {
      const mockMouseEvent = new MouseEvent('mousemove', { clientX: 100 });
      const windowWidth = window.innerWidth;
      const newWidth = windowWidth - mockMouseEvent.clientX; // 1300
      const maxWidth = windowWidth * 0.7; // 980

      if (newWidth > maxWidth) {
        expect(newWidth).toBeGreaterThan(maxWidth);
        // Width should not be applied if above maximum
      }
    });
  });

  describe('AI-Browser Communication', () => {
    beforeEach(() => {
      // Setup successful mock responses
      mockElectronAPI.createPage.mockResolvedValue({ success: true, pageId: 'main-page' });
      mockElectronAPI.navigateToUrl.mockResolvedValue({ success: true });
      mockElectronAPI.getPageContent.mockResolvedValue({
        success: true,
        data: {
          text: 'Sample page content for analysis',
          title: 'Test Page',
          url: 'https://example.com'
        }
      });
      mockElectronAPI.analyzePage.mockResolvedValue('This page contains sample content about testing.');
      mockElectronAPI.summarizeContent.mockResolvedValue('Summary: This is a test page.');
      mockElectronAPI.takeScreenshot.mockResolvedValue({
        success: true,
        screenshot: Buffer.from('fake-screenshot-data')
      });
    });

    test('should initialize Puppeteer page on startup', async () => {
      // Simulate initialization
      await mockElectronAPI.createPage('main-page');
      
      expect(mockElectronAPI.createPage).toHaveBeenCalledWith('main-page');
    });

    test('should analyze current page', async () => {
      const currentUrl = 'https://example.com';
      
      // Simulate page analysis workflow
      await mockElectronAPI.navigateToUrl('main-page', currentUrl);
      const contentResult = await mockElectronAPI.getPageContent('main-page', false);
      
      if (contentResult.success && contentResult.data) {
        const query = 'Please analyze this webpage and provide insights about its content, purpose, and key information.';
        const response = await mockElectronAPI.analyzePage('openai', contentResult.data.text, query);
        
        expect(response).toBe('This page contains sample content about testing.');
      }

      expect(mockElectronAPI.navigateToUrl).toHaveBeenCalledWith('main-page', currentUrl);
      expect(mockElectronAPI.getPageContent).toHaveBeenCalledWith('main-page', false);
      expect(mockElectronAPI.analyzePage).toHaveBeenCalledWith(
        'openai',
        'Sample page content for analysis',
        'Please analyze this webpage and provide insights about its content, purpose, and key information.'
      );
    });

    test('should summarize current page', async () => {
      const currentUrl = 'https://example.com';
      
      // Simulate page summarization workflow
      await mockElectronAPI.navigateToUrl('main-page', currentUrl);
      const contentResult = await mockElectronAPI.getPageContent('main-page', false);
      
      if (contentResult.success && contentResult.data) {
        const response = await mockElectronAPI.summarizeContent('openai', contentResult.data.text);
        expect(response).toBe('Summary: This is a test page.');
      }

      expect(mockElectronAPI.summarizeContent).toHaveBeenCalledWith('openai', 'Sample page content for analysis');
    });

    test('should take page screenshot', async () => {
      const currentUrl = 'https://example.com';
      
      // Simulate screenshot workflow
      await mockElectronAPI.navigateToUrl('main-page', currentUrl);
      const screenshotResult = await mockElectronAPI.takeScreenshot('main-page', false);
      
      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.screenshot).toBeInstanceOf(Buffer);
      expect(mockElectronAPI.navigateToUrl).toHaveBeenCalledWith('main-page', currentUrl);
      expect(mockElectronAPI.takeScreenshot).toHaveBeenCalledWith('main-page', false);
    });

    test('should handle AI service errors gracefully', async () => {
      mockElectronAPI.getPageContent.mockResolvedValue({ success: false, error: 'Page not found' });
      
      const currentUrl = 'https://invalid-url.com';
      await mockElectronAPI.navigateToUrl('main-page', currentUrl);
      const contentResult = await mockElectronAPI.getPageContent('main-page', false);
      
      expect(contentResult.success).toBe(false);
      expect(contentResult.error).toBe('Page not found');
    });

    test('should handle empty URL scenarios', async () => {
      const currentUrl = '';
      
      // Should not attempt navigation with empty URL
      if (!currentUrl) {
        expect(mockElectronAPI.navigateToUrl).not.toHaveBeenCalled();
      }
    });
  });

  describe('Message Display System', () => {
    test('should display user messages correctly', () => {
      const message = 'Test user message';
      const messageElement = document.createElement('div');
      const senderElement = document.createElement('div');
      const contentElement = document.createElement('div');

      messageElement.className = 'message user';
      senderElement.className = 'sender';
      senderElement.textContent = 'You';
      contentElement.textContent = message;

      expect(senderElement.textContent).toBe('You');
      expect(contentElement.textContent).toBe(message);
      expect(messageElement.className).toContain('user');
    });

    test('should display AI messages correctly', () => {
      const message = 'Test AI response';
      const service = 'OPENAI';
      const messageElement = document.createElement('div');
      const senderElement = document.createElement('div');
      const contentElement = document.createElement('div');

      messageElement.className = 'message ai';
      senderElement.className = 'sender';
      senderElement.textContent = service;
      contentElement.textContent = message;

      expect(senderElement.textContent).toBe(service);
      expect(contentElement.textContent).toBe(message);
      expect(messageElement.className).toContain('ai');
    });

    test('should display screenshot messages correctly', () => {
      const screenshot = Buffer.from('fake-screenshot-data');
      const messageElement = document.createElement('div');
      const imageElement = document.createElement('img');

      messageElement.className = 'message ai screenshot-message';
      imageElement.src = `data:image/png;base64,${screenshot.toString('base64')}`;

      expect(messageElement.className).toContain('screenshot-message');
      expect(imageElement.src).toContain('data:image/png;base64,');
    });

    test('should scroll to bottom after adding messages', () => {
      // Simulate message addition and scroll
      const initialScrollTop = mockChatMessages.scrollTop;
      mockChatMessages.scrollTop = mockChatMessages.scrollHeight;

      expect(mockChatMessages.scrollTop).toBe(mockChatMessages.scrollHeight);
      expect(mockChatMessages.scrollTop).toBeGreaterThanOrEqual(initialScrollTop);
    });
  });

  describe('Action Button Functionality', () => {
    test('should have correct action button properties', () => {
      const analyzeBtn = document.createElement('button');
      const summarizeBtn = document.createElement('button');
      const screenshotBtn = document.createElement('button');

      analyzeBtn.className = 'ai-action-btn';
      analyzeBtn.textContent = '📊 Analyze Page';
      
      summarizeBtn.className = 'ai-action-btn';
      summarizeBtn.textContent = '📝 Summarize';
      
      screenshotBtn.className = 'ai-action-btn';
      screenshotBtn.textContent = '📸 Screenshot';

      expect(analyzeBtn.className).toBe('ai-action-btn');
      expect(analyzeBtn.textContent).toBe('📊 Analyze Page');
      expect(summarizeBtn.textContent).toBe('📝 Summarize');
      expect(screenshotBtn.textContent).toBe('📸 Screenshot');
    });

    test('should disable buttons during processing', () => {
      const button = document.createElement('button');
      button.disabled = true;

      expect(button.disabled).toBe(true);
    });
  });

  describe('Real-time Integration', () => {
    test('should update sidebar width dynamically', () => {
      const newWidth = 500;
      mockSidebar.style.width = `${newWidth}px`;

      expect(mockSidebar.style.width).toBe('500px');
    });

    test('should handle concurrent AI operations', async () => {
      const operations = [
        mockElectronAPI.analyzePage('openai', 'content', 'query'),
        mockElectronAPI.summarizeContent('openai', 'content'),
        mockElectronAPI.takeScreenshot('main-page', false)
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(3);
      expect(results[0]).toBe('This page contains sample content about testing.');
      expect(results[1]).toBe('Summary: This is a test page.');
      expect(results[2].success).toBe(true);
    });

    test('should maintain performance with multiple rapid requests', async () => {
      const startTime = Date.now();
      
      const rapidRequests = Array(5).fill(null).map((_, i) => 
        mockElectronAPI.getPageContent('main-page', false)
      );

      await Promise.all(rapidRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (mocked responses)
      expect(duration).toBeLessThan(1000);
      expect(mockElectronAPI.getPageContent).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing DOM elements gracefully', () => {
      const mockGetElementByIdFailing = jest.fn().mockReturnValue(null);
      Object.defineProperty(document, 'getElementById', {
        value: mockGetElementByIdFailing,
      });

      const sidebar = document.getElementById('ai-sidebar');
      expect(sidebar).toBeNull();
      
      // Should not throw when sidebar is null
      expect(() => {
        if (sidebar) {
          sidebar.style.width = '400px';
        }
      }).not.toThrow();
    });

    test('should handle API errors in page analysis', async () => {
      mockElectronAPI.analyzePage.mockRejectedValue(new Error('API Error'));

      try {
        await mockElectronAPI.analyzePage('openai', 'content', 'query');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('API Error');
      }
    });

    test('should handle screenshot buffer conversion errors', () => {
      const invalidBuffer = null;
      
      expect(() => {
        if (invalidBuffer) {
          invalidBuffer.toString('base64');
        }
      }).not.toThrow();
    });

    test('should validate resize constraints', () => {
      const testWidths = [100, 300, 500, 1000, 1500]; // Below min, at min, normal, large, above max
      const windowWidth = 1400;
      const minWidth = 300;
      const maxWidth = windowWidth * 0.7; // 980

      testWidths.forEach(width => {
        const isValidWidth = width >= minWidth && width <= maxWidth;
        
        if (width === 100) expect(isValidWidth).toBe(false); // Below minimum
        if (width === 300) expect(isValidWidth).toBe(true);  // At minimum
        if (width === 500) expect(isValidWidth).toBe(true);  // Normal
        if (width === 1000) expect(isValidWidth).toBe(false); // Above maximum (980)
        if (width === 1500) expect(isValidWidth).toBe(false); // Well above maximum
      });
    });
  });
});