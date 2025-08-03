// Renderer process main file
class BrawzaRenderer {
  private currentUrl: string = '';
  private sidebarOpen: boolean = false;
  private currentAIService: string = 'openai';
  private sidebarWidth: number = 400;
  private isResizing: boolean = false;
  private currentPageId: string = 'main-page';
  private webViewReady: boolean = false;
  private isLoading: boolean = false;

  constructor() {
    this.initializeEventListeners();
    this.initializeWebview();
    this.initializeResizer();
    this.loadSettings();
    // Puppeteer page is now created only when needed for AI automation
  }

  private initializeEventListeners(): void {
    // Navigation controls - handle WebView directly
    document.getElementById('back-btn')?.addEventListener('click', () => {
      this.goBack();
    });

    document.getElementById('forward-btn')?.addEventListener('click', () => {
      this.goForward();
    });

    document.getElementById('refresh-btn')?.addEventListener('click', () => {
      this.refresh();
    });

    document.getElementById('go-btn')?.addEventListener('click', () => {
      this.navigateToUrl();
    });

    document.getElementById('url-bar')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.navigateToUrl();
      }
    });

    // Select all text when URL bar is focused for easy editing
    document.getElementById('url-bar')?.addEventListener('focus', (e) => {
      const urlBar = e.target as HTMLInputElement;
      urlBar.select();
    });

    // Also select all on click for better UX
    document.getElementById('url-bar')?.addEventListener('click', (e) => {
      const urlBar = e.target as HTMLInputElement;
      urlBar.select();
    });

    // Sidebar controls
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      this.toggleSidebar();
    });

    document.getElementById('sidebar-close')?.addEventListener('click', () => {
      this.closeSidebar();
    });

    // AI service selection
    document.getElementById('ai-service-select')?.addEventListener('change', (e) => {
      this.currentAIService = (e.target as HTMLSelectElement).value;
    });

    // Chat functionality
    document.getElementById('send-btn')?.addEventListener('click', () => {
      this.sendMessage();
    });

    document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Settings modal
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      this.openSettings();
    });

    document.getElementById('settings-close')?.addEventListener('click', () => {
      this.closeSettings();
    });

    document.getElementById('save-settings')?.addEventListener('click', () => {
      this.saveSettings();
    });

    // Test connection buttons
    document.getElementById('test-openai')?.addEventListener('click', () => {
      this.testConnection('openai');
    });

    document.getElementById('test-gemini')?.addEventListener('click', () => {
      this.testConnection('gemini');
    });

    document.getElementById('test-claude')?.addEventListener('click', () => {
      this.testConnection('claude');
    });

    // Dashboard link handlers
    document.getElementById('openai-dashboard')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openDashboard('openai');
    });

    document.getElementById('gemini-dashboard')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openDashboard('gemini');
    });

    document.getElementById('claude-dashboard')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openDashboard('claude');
    });

    // Electron API event listeners
    window.electronAPI.onNavigationChange((url: string) => {
      this.updateUrlBar(url);
    });

    window.electronAPI.onAIResponse((service: string, response: string) => {
      this.displayAIResponse(service, response);
    });

    // Listen for WebView control events from main process
    window.electronAPI.onWebViewBack(() => {
      this.goBack();
    });

    window.electronAPI.onWebViewForward(() => {
      this.goForward();
    });

    window.electronAPI.onWebViewRefresh(() => {
      this.refresh();
    });

    // Add new AI features buttons
    document.getElementById('analyze-page-btn')?.addEventListener('click', () => {
      this.analyzeCurrentPage();
    });

    document.getElementById('summarize-page-btn')?.addEventListener('click', () => {
      this.summarizeCurrentPage();
    });

    document.getElementById('take-screenshot-btn')?.addEventListener('click', () => {
      this.takePageScreenshot();
    });
  }

  private initializeWebview(): void {
    const webview = document.getElementById('browser-view') as any;
    if (!webview) {
      console.error('WebView element not found');
      return;
    }

    // Set initial WebView properties for better web compatibility
    webview.setAttribute('allowpopups', 'false');
    webview.setAttribute('nodeintegration', 'false');
    webview.setAttribute('nodeintegrationinsubframes', 'false');
    webview.setAttribute('webpreferences', 'contextIsolation=false,enableRemoteModule=false,sandbox=false,javascript=true,webSecurity=false,allowRunningInsecureContent=true,experimentalFeatures=true');
    webview.setAttribute('useragent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Enable modern web features and disable CSP for WebView content
    webview.setAttribute('partition', 'persist:webview');
    webview.setAttribute('disablewebsecurity', 'true');

    // Wait for webview to be ready
    webview.addEventListener('dom-ready', () => {
      console.log('WebView DOM ready');
      this.onWebViewReady();
    });

    // Handle navigation changes
    webview.addEventListener('did-navigate', (event: any) => {
      if (event && event.url) {
        this.updateUrlBar(event.url);
        console.log('WebView navigated to:', event.url);
      }
    });

    // Handle console messages from webview for debugging
    webview.addEventListener('console-message', (event: any) => {
      // Filter out common non-critical warnings
      const message = event.message;
      const isPreloadWarning = message.includes('was preloaded using link preload but not used');
      const isGenerateWarning = message.includes('generate_204') || message.includes('generate_');
      
      // Only log important messages, filter noise
      if (!isPreloadWarning && !isGenerateWarning && event.level !== 1) {
        console.log('WebView Console:', event.level, message);
      }
    });

    // Handle permission requests
    webview.addEventListener('permission-request', (event: any) => {
      if (event.permission === 'geolocation' || event.permission === 'notifications') {
        // Allow basic permissions that might be needed for modern websites
        event.request.allow();
      } else {
        event.request.deny();
      }
    });

    // Handle navigation in same page
    webview.addEventListener('did-navigate-in-page', (event: any) => {
      if (event && event.url) {
        this.updateUrlBar(event.url);
      }
    });

    // Handle loading states
    webview.addEventListener('did-start-loading', () => {
      console.log('WebView started loading');
      this.setLoadingState(true);
    });

    webview.addEventListener('did-finish-load', () => {
      console.log('WebView finished loading');
      this.setLoadingState(false);
    });

    // Handle errors
    webview.addEventListener('did-fail-load', (event: any) => {
      console.error('WebView failed to load:', event);
      this.setLoadingState(false);
      this.showErrorPage(event.errorDescription || 'Failed to load page');
    });

    // Handle crashed webview
    webview.addEventListener('crashed', () => {
      console.error('WebView crashed');
      this.showErrorPage('The page has crashed. Please refresh.');
    });

    // Handle webview unresponsive
    webview.addEventListener('unresponsive', () => {
      console.warn('WebView became unresponsive');
    });

    // Handle webview responsive again
    webview.addEventListener('responsive', () => {
      console.log('WebView became responsive again');
    });
  }

  private navigateToUrl(): void {
    const urlBar = document.getElementById('url-bar') as HTMLInputElement;
    let url = urlBar.value.trim();

    if (!url) return;

    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Check if it looks like a URL or treat as search
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      }
    }

    // Navigate the webview safely
    const webview = document.getElementById('browser-view') as any;
    if (webview) {
      try {
        // Use src attribute for immediate navigation, loadURL for programmatic
        webview.src = url;
        this.currentUrl = url;
        console.log('WebView navigating to:', url);
        
        // Also try loadURL as backup
        if (webview.loadURL) {
          webview.loadURL(url).catch((error: any) => {
            console.warn('loadURL failed, using src attribute:', error);
          });
        }
      } catch (error) {
        console.error('Error navigating WebView:', error);
        this.showErrorPage('Failed to navigate to URL');
      }
    } else {
      console.warn('WebView element not found');
    }

    // Also notify main process for logging
    window.electronAPI.navigateTo(url).catch(console.error);
  }

  private onWebViewReady(): void {
    this.webViewReady = true;
    console.log('WebView is ready for navigation');
    
    // Set additional WebView properties after DOM ready
    const webview = document.getElementById('browser-view') as any;
    if (webview) {
      // Enable debugging in development mode
      if (window.electronAPI.isDevelopment && webview.openDevTools) {
        console.log('Development mode detected, opening WebView dev tools');
        webview.openDevTools();
      }
      
      // Test navigation to verify WebView is working
      if (webview.getUserAgent) {
        console.log('WebView session ready, user agent:', webview.getUserAgent());
      } else {
        console.log('WebView session ready');
      }
    }
  }

  private isWebViewReady(): boolean {
    return this.webViewReady;
  }

  private setLoadingState(loading: boolean): void {
    this.isLoading = loading;
    // Update UI to show loading state
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.textContent = loading ? '⏳' : '↻';
    }
  }

  private showErrorPage(message: string): void {
    const webview = document.getElementById('browser-view') as any;
    if (webview) {
      const errorHtml = `
        <html>
          <head><title>Error</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; text-align: center; background: #f5f5f5;">
            <h1 style="color: #d32f2f;">⚠️ Navigation Error</h1>
            <p style="color: #666; font-size: 16px;">${message}</p>
            <button onclick="history.back()" style="padding: 10px 20px; background: #007aff; color: white; border: none; border-radius: 6px; cursor: pointer;">Go Back</button>
          </body>
        </html>
      `;
      webview.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
    }
  }

  private goBack(): void {
    const webview = document.getElementById('browser-view') as any;
    if (webview && this.isWebViewReady()) {
      try {
        if (webview.canGoBack && webview.canGoBack()) {
          webview.goBack();
        }
      } catch (error) {
        console.error('Error going back:', error);
      }
    }
  }

  private goForward(): void {
    const webview = document.getElementById('browser-view') as any;
    if (webview && this.isWebViewReady()) {
      try {
        if (webview.canGoForward && webview.canGoForward()) {
          webview.goForward();
        }
      } catch (error) {
        console.error('Error going forward:', error);
      }
    }
  }

  private refresh(): void {
    const webview = document.getElementById('browser-view') as any;
    if (webview && this.isWebViewReady()) {
      try {
        webview.reload();
      } catch (error) {
        console.error('Error refreshing:', error);
      }
    }
  }

  private updateUrlBar(url: string): void {
    this.currentUrl = url;
    const urlBar = document.getElementById('url-bar') as HTMLInputElement;
    if (urlBar) {
      urlBar.value = url;
    }
  }

  private toggleSidebar(): void {
    const sidebar = document.getElementById('ai-sidebar');
    if (sidebar) {
      this.sidebarOpen = !this.sidebarOpen;
      if (this.sidebarOpen) {
        sidebar.classList.remove('hidden');
      } else {
        sidebar.classList.add('hidden');
      }
    }
  }

  private closeSidebar(): void {
    const sidebar = document.getElementById('ai-sidebar');
    if (sidebar) {
      sidebar.classList.add('hidden');
      this.sidebarOpen = false;
    }
  }

  private async sendMessage(): Promise<void> {
    const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
    const message = chatInput.value.trim();

    if (!message) return;

    // Display user message
    this.displayMessage('user', message);
    chatInput.value = '';

    try {
      // Send message to AI service
      const response = await window.electronAPI.sendMessage(this.currentAIService, message);
      this.displayMessage('ai', response);
    } catch (error) {
      this.displayMessage('ai', 'Sorry, there was an error processing your request.');
      console.error('AI service error:', error);
    }
  }

  private displayMessage(sender: 'user' | 'ai', content: string): void {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}`;
    
    const senderElement = document.createElement('div');
    senderElement.className = 'sender';
    senderElement.textContent = sender === 'user' ? 'You' : this.currentAIService.toUpperCase();
    
    const contentElement = document.createElement('div');
    contentElement.textContent = content;
    
    messageElement.appendChild(senderElement);
    messageElement.appendChild(contentElement);
    messagesContainer.appendChild(messageElement);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  private displayAIResponse(service: string, response: string): void {
    this.displayMessage('ai', response);
  }

  private openSettings(): void {
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  private closeSettings(): void {
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  private async saveSettings(): Promise<void> {
    const settings = {
      openaiKey: (document.getElementById('openai-key') as HTMLInputElement).value,
      geminiKey: (document.getElementById('gemini-key') as HTMLInputElement).value,
      claudeKey: (document.getElementById('claude-key') as HTMLInputElement).value,
      headlessMode: (document.getElementById('headless-mode') as HTMLInputElement).checked,
      memoryLimit: (document.getElementById('memory-limit') as HTMLInputElement).value
    };

    try {
      // Store API keys securely
      if (settings.openaiKey) {
        await window.electronAPI.storeToken('openai', settings.openaiKey);
      }
      if (settings.geminiKey) {
        await window.electronAPI.storeToken('gemini', settings.geminiKey);
      }
      if (settings.claudeKey) {
        await window.electronAPI.storeToken('claude', settings.claudeKey);
      }

      // Save other settings
      await window.electronAPI.saveSettings({
        headlessMode: settings.headlessMode,
        memoryLimit: settings.memoryLimit
      });

      this.closeSettings();
      this.showNotification('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showNotification('Error saving settings');
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const settings = await window.electronAPI.loadSettings();
      
      if (settings) {
        const headlessCheckbox = document.getElementById('headless-mode') as HTMLInputElement;
        const memorySlider = document.getElementById('memory-limit') as HTMLInputElement;
        const memoryValue = document.getElementById('memory-value');

        if (headlessCheckbox) headlessCheckbox.checked = settings.headlessMode || false;
        if (memorySlider) memorySlider.value = settings.memoryLimit || '500';
        if (memoryValue) memoryValue.textContent = `${settings.memoryLimit || 500}MB`;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  private async testConnection(service: string): Promise<void> {
    try {
      this.showNotification(`Testing ${service.toUpperCase()} connection...`);
      const result = await window.electronAPI.testConnection(service);
      
      if (result.success) {
        this.showNotification(`✅ ${service.toUpperCase()} connection successful!`);
      } else {
        this.showNotification(`❌ ${service.toUpperCase()} connection failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      this.showNotification(`❌ ${service.toUpperCase()} connection failed. Check your API key.`);
      console.error(`${service} test failed:`, error);
    }
  }

  private openDashboard(service: string): void {
    const dashboardUrls = {
      openai: 'https://platform.openai.com/api-keys',
      gemini: 'https://makersuite.google.com/app/apikey',
      claude: 'https://console.anthropic.com/dashboard'
    };

    const url = dashboardUrls[service as keyof typeof dashboardUrls];
    if (url) {
      // Use the webview to navigate to the dashboard
      const webview = document.getElementById('browser-view') as any;
      if (webview) {
        webview.src = url;
        this.updateUrlBar(url);
        
        // Close settings modal so user can see the dashboard
        this.closeSettings();
        
        // Show helpful notification
        this.showNotification(`Opening ${service.toUpperCase()} dashboard. Copy your API key and return to settings.`);
      }
    }
  }

  private showNotification(message: string): void {
    // Simple notification - could be enhanced with a proper notification system
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #007aff;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 1001;
      animation: slideIn 0.3s ease;
      max-width: 300px;
      word-wrap: break-word;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  private initializeResizer(): void {
    const resizer = document.createElement('div');
    resizer.className = 'sidebar-resizer';
    resizer.style.cssText = `
      position: absolute;
      left: -3px;
      top: 0;
      width: 6px;
      height: 100%;
      cursor: ew-resize;
      background: transparent;
      z-index: 10;
    `;

    const sidebar = document.getElementById('ai-sidebar');
    if (sidebar) {
      sidebar.appendChild(resizer);

      resizer.addEventListener('mousedown', (e) => {
        this.isResizing = true;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!this.isResizing) return;

        const windowWidth = window.innerWidth;
        const newWidth = windowWidth - e.clientX;
        
        // Set min and max width constraints
        if (newWidth >= 300 && newWidth <= windowWidth * 0.7) {
          this.sidebarWidth = newWidth;
          this.updateSidebarWidth();
        }
      });

      document.addEventListener('mouseup', () => {
        if (this.isResizing) {
          this.isResizing = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    }
  }

  private updateSidebarWidth(): void {
    const sidebar = document.getElementById('ai-sidebar');
    if (sidebar) {
      sidebar.style.width = `${this.sidebarWidth}px`;
    }
  }

  private async ensurePuppeteerPage(): Promise<boolean> {
    try {
      // Only create Puppeteer page when needed for AI automation
      const pagesResult = await window.electronAPI.getAllPages();
      if (pagesResult.success && pagesResult.pages && pagesResult.pages.includes(this.currentPageId)) {
        return true; // Page already exists
      }
      
      const result = await window.electronAPI.createPage(this.currentPageId);
      if (result.success) {
        console.log('Puppeteer page created for AI automation:', this.currentPageId);
        return true;
      } else {
        console.error('Failed to create Puppeteer page:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error creating Puppeteer page:', error);
      return false;
    }
  }

  private async analyzeCurrentPage(): Promise<void> {
    if (!this.currentUrl) {
      this.displayMessage('ai', 'Please navigate to a page first.');
      return;
    }

    this.displayMessage('user', 'Analyze this page');
    
    try {
      // Ensure Puppeteer page exists for AI automation
      const puppeteerReady = await this.ensurePuppeteerPage();
      if (!puppeteerReady) {
        this.displayMessage('ai', 'Sorry, I could not initialize the automation engine for page analysis.');
        return;
      }
      
      // Navigate Puppeteer to current URL for content extraction
      await window.electronAPI.navigateToUrl(this.currentPageId, this.currentUrl);
      
      // Get page content
      const contentResult = await window.electronAPI.getPageContent(this.currentPageId, false);
      
      if (contentResult.success && contentResult.data) {
        const query = 'Please analyze this webpage and provide insights about its content, purpose, and key information.';
        const response = await window.electronAPI.analyzePage(this.currentAIService, contentResult.data.text, query);
        this.displayMessage('ai', response);
      } else {
        this.displayMessage('ai', 'Sorry, I could not access the page content for analysis.');
      }
    } catch (error) {
      console.error('Page analysis error:', error);
      this.displayMessage('ai', 'Sorry, there was an error analyzing the page.');
    }
  }

  private async summarizeCurrentPage(): Promise<void> {
    if (!this.currentUrl) {
      this.displayMessage('ai', 'Please navigate to a page first.');
      return;
    }

    this.displayMessage('user', 'Summarize this page');
    
    try {
      // Ensure Puppeteer page exists for AI automation
      const puppeteerReady = await this.ensurePuppeteerPage();
      if (!puppeteerReady) {
        this.displayMessage('ai', 'Sorry, I could not initialize the automation engine for page summarization.');
        return;
      }
      
      // Navigate Puppeteer to current URL for content extraction
      await window.electronAPI.navigateToUrl(this.currentPageId, this.currentUrl);
      
      // Get page content
      const contentResult = await window.electronAPI.getPageContent(this.currentPageId, false);
      
      if (contentResult.success && contentResult.data) {
        const response = await window.electronAPI.summarizeContent(this.currentAIService, contentResult.data.text);
        this.displayMessage('ai', response);
      } else {
        this.displayMessage('ai', 'Sorry, I could not access the page content for summarization.');
      }
    } catch (error) {
      console.error('Page summarization error:', error);
      this.displayMessage('ai', 'Sorry, there was an error summarizing the page.');
    }
  }

  private async takePageScreenshot(): Promise<void> {
    if (!this.currentUrl) {
      this.displayMessage('ai', 'Please navigate to a page first.');
      return;
    }

    this.displayMessage('user', 'Take a screenshot of this page');
    
    try {
      // Ensure Puppeteer page exists for AI automation
      const puppeteerReady = await this.ensurePuppeteerPage();
      if (!puppeteerReady) {
        this.displayMessage('ai', 'Sorry, I could not initialize the automation engine for screenshot capture.');
        return;
      }
      
      // Navigate Puppeteer to current URL for screenshot
      await window.electronAPI.navigateToUrl(this.currentPageId, this.currentUrl);
      
      // Take screenshot
      const screenshotResult = await window.electronAPI.takeScreenshot(this.currentPageId, false);
      
      if (screenshotResult.success && screenshotResult.screenshot) {
        // Display screenshot in chat
        this.displayScreenshot(screenshotResult.screenshot);
        this.displayMessage('ai', 'Screenshot captured successfully! You can now ask me questions about what you see.');
      } else {
        this.displayMessage('ai', 'Sorry, I could not take a screenshot of the page.');
      }
    } catch (error) {
      console.error('Screenshot error:', error);
      this.displayMessage('ai', 'Sorry, there was an error taking the screenshot.');
    }
  }

  private displayScreenshot(screenshot: Buffer): void {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = 'message ai screenshot-message';
    
    const senderElement = document.createElement('div');
    senderElement.className = 'sender';
    senderElement.textContent = 'SCREENSHOT';
    
    const imageElement = document.createElement('img');
    imageElement.src = `data:image/png;base64,${screenshot.toString('base64')}`;
    imageElement.style.cssText = `
      max-width: 100%;
      max-height: 300px;
      border-radius: 8px;
      margin-top: 8px;
      cursor: pointer;
    `;
    
    // Click to view full size
    imageElement.addEventListener('click', () => {
      const fullSizeWindow = window.open();
      if (fullSizeWindow) {
        fullSizeWindow.document.write(`
          <html>
            <head><title>Screenshot</title></head>
            <body style="margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000;">
              <img src="data:image/png;base64,${screenshot.toString('base64')}" style="max-width: 100%; max-height: 100vh;">
            </body>
          </html>
        `);
      }
    });
    
    messageElement.appendChild(senderElement);
    messageElement.appendChild(imageElement);
    messagesContainer.appendChild(messageElement);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// Initialize the renderer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new BrawzaRenderer();
});

// Add slide-in animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);