import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { KeychainManager } from './security/keychain';
import { SettingsManager } from './security/settings';
import { HTTPSManager } from './security/https';
import { AIManager } from './ai/ai-manager';
import { PuppeteerManager } from './automation/puppeteer-manager';
import { PerformanceMonitor, RateLimiter } from './monitoring';

class BrawzaApp {
  private mainWindow: BrowserWindow | null = null;
  private keychainManager: KeychainManager;
  private settingsManager: SettingsManager;
  private httpsManager!: HTTPSManager;
  private aiManager: AIManager;
  private puppeteerManager: PuppeteerManager;
  private performanceMonitor: PerformanceMonitor;
  private rateLimiter: RateLimiter;

  constructor() {
    this.keychainManager = new KeychainManager();
    this.settingsManager = new SettingsManager();
    this.aiManager = new AIManager(this.keychainManager);
    this.puppeteerManager = new PuppeteerManager();
    this.performanceMonitor = new PerformanceMonitor();
    this.rateLimiter = new RateLimiter();
    this.initializeApp();
  }

  private initializeApp(): void {
    // Handle app ready
    app.whenReady().then(async () => {
      this.httpsManager = new HTTPSManager();
      await this.initializePuppeteer();
      this.initializeMonitoring();
      this.createMainWindow();
      this.setupIPC();
      this.initializeAIServices();
      
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    // Handle app window closed
    app.on('window-all-closed', async () => {
      await this.cleanup();
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Handle app quit
    app.on('before-quit', async () => {
      await this.cleanup();
    });

    // Handle WebView permissions and security
    app.on('web-contents-created', (event, contents) => {
      // Handle new window requests
      contents.setWindowOpenHandler(({ url }) => {
        console.log('Blocked new window:', url);
        return { action: 'deny' };
      });
      
      // Handle permission requests for WebViews
      contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        // Allow permissions that are safe for browsing
        const allowedPermissions = [
          'notifications',
          'geolocation',
          'camera',
          'microphone',
          'clipboard-read',
          'clipboard-sanitized-write'
        ];
        
        if (allowedPermissions.includes(permission)) {
          console.log(`Allowing permission: ${permission}`);
          callback(true);
        } else {
          console.log(`Denying permission: ${permission}`);
          callback(false);
        }
      });
    });
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../renderer/preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false,
        webviewTag: true,
        experimentalFeatures: true,
        enableBlinkFeatures: 'CSSGridLayout,CSSContainment'
      },
      show: false
    });

    // Load the main renderer
    this.mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));
    
    // Open dev tools in development
    if (process.env.NODE_ENV !== 'production') {
      this.mainWindow.webContents.openDevTools();
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupIPC(): void {
    // WebView browser controls - these are handled by the renderer process
    // The main process just logs for debugging purposes
    ipcMain.handle('browser:navigate', async (event, url: string) => {
      console.log('WebView Navigate to:', url);
      return { success: true };
    });

    ipcMain.handle('browser:back', async () => {
      console.log('WebView Go back');
      // WebView back/forward is handled in renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        try {
          this.mainWindow.webContents.send('webview:go-back');
        } catch (error) {
          console.error('Error sending webview:go-back:', error);
        }
      }
      return { success: true };
    });

    ipcMain.handle('browser:forward', async () => {
      console.log('WebView Go forward');
      // WebView back/forward is handled in renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        try {
          this.mainWindow.webContents.send('webview:go-forward');
        } catch (error) {
          console.error('Error sending webview:go-forward:', error);
        }
      }
      return { success: true };
    });

    ipcMain.handle('browser:refresh', async () => {
      console.log('WebView Refresh');
      // WebView refresh is handled in renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        try {
          this.mainWindow.webContents.send('webview:refresh');
        } catch (error) {
          console.error('Error sending webview:refresh:', error);
        }
      }
      return { success: true };
    });

    ipcMain.handle('ai:send-message', async (event, service: string, message: string) => {
      try {
        // Check rate limit before sending
        await this.rateLimiter.recordRequest(service);
        
        console.log(`AI Message to ${service}:`, message);
        const response = await this.aiManager.sendMessage(service as any, message);
        return response;
      } catch (error) {
        console.error(`AI service error for ${service}:`, error);
        return `Error: ${(error as Error).message}`;
      }
    });

    ipcMain.handle('settings:save', async (event, settings: any) => {
      try {
        await this.settingsManager.updateSettings(settings);
        return { success: true };
      } catch (error) {
        console.error('Failed to save settings:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('settings:load', async () => {
      try {
        const settings = this.settingsManager.getSettings();
        return settings;
      } catch (error) {
        console.error('Failed to load settings:', error);
        return { headlessMode: false, memoryLimit: 500 };
      }
    });

    // Puppeteer automation handlers
    ipcMain.handle('automation:create-page', async (event, pageId: string) => {
      try {
        const id = await this.puppeteerManager.createPage(pageId);
        return { success: true, pageId: id };
      } catch (error) {
        console.error('Failed to create page:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('automation:navigate', async (event, pageId: string, url: string) => {
      try {
        const result = await this.puppeteerManager.navigateToUrl(pageId, url);
        return result;
      } catch (error) {
        console.error('Navigation failed:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('automation:get-content', async (event, pageId: string, includeHTML: boolean = false) => {
      try {
        const result = await this.puppeteerManager.getPageContent(pageId, includeHTML);
        return result;
      } catch (error) {
        console.error('Failed to get page content:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('automation:screenshot', async (event, pageId: string, fullPage: boolean = false) => {
      try {
        const result = await this.puppeteerManager.takeScreenshot(pageId, fullPage);
        return result;
      } catch (error) {
        console.error('Screenshot failed:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('automation:click', async (event, pageId: string, selector: string) => {
      try {
        const result = await this.puppeteerManager.clickElement(pageId, selector);
        return result;
      } catch (error) {
        console.error('Click failed:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('automation:fill-form', async (event, pageId: string, formData: Record<string, string>) => {
      try {
        const result = await this.puppeteerManager.fillForm(pageId, formData);
        return result;
      } catch (error) {
        console.error('Form fill failed:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('automation:evaluate', async (event, pageId: string, script: string) => {
      try {
        const result = await this.puppeteerManager.evaluateScript(pageId, script);
        return result;
      } catch (error) {
        console.error('Script evaluation failed:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('automation:close-page', async (event, pageId: string) => {
      try {
        const success = await this.puppeteerManager.closePage(pageId);
        return { success };
      } catch (error) {
        console.error('Failed to close page:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('automation:get-pages', async () => {
      try {
        const pages = await this.puppeteerManager.getAllPages();
        return { success: true, pages };
      } catch (error) {
        console.error('Failed to get pages:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Performance monitoring handlers
    ipcMain.handle('monitoring:get-metrics', async () => {
      try {
        const metrics = this.performanceMonitor.getLatestMetrics();
        return { success: true, metrics };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('monitoring:get-history', async () => {
      try {
        const history = this.performanceMonitor.getMetricsHistory();
        return { success: true, history };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('monitoring:get-report', async () => {
      try {
        const report = this.performanceMonitor.getMemoryReport();
        return { success: true, report };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('monitoring:optimize', async () => {
      try {
        await this.performanceMonitor.optimizeMemory();
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('monitoring:rate-limits', async () => {
      try {
        const stats = this.rateLimiter.getAllStats();
        return { success: true, stats };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('security:store-token', async (event, service: string, token: string) => {
      try {
        await this.keychainManager.storeToken(service, token);
        await this.settingsManager.updateAIServiceConfig(service, true);
        return { success: true };
      } catch (error) {
        console.error(`Failed to store token for ${service}:`, error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('security:get-token', async (event, service: string) => {
      try {
        const token = await this.keychainManager.getToken(service);
        return token;
      } catch (error) {
        console.error(`Failed to get token for ${service}:`, error);
        return null;
      }
    });

    // AI-specific IPC handlers
    ipcMain.handle('ai:test-connection', async (event, service: string) => {
      try {
        const result = await this.aiManager.testConnection(service as any);
        return { success: result };
      } catch (error) {
        console.error(`Connection test failed for ${service}:`, error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('ai:analyze-page', async (event, service: string, pageContent: string, query: string) => {
      try {
        const response = await this.aiManager.analyzeWebPage(service as any, pageContent, query);
        return response;
      } catch (error) {
        console.error(`Page analysis failed for ${service}:`, error);
        return `Error: ${(error as Error).message}`;
      }
    });

    ipcMain.handle('ai:summarize-content', async (event, service: string, content: string) => {
      try {
        const response = await this.aiManager.summarizeContent(service as any, content);
        return response;
      } catch (error) {
        console.error(`Content summarization failed for ${service}:`, error);
        return `Error: ${(error as Error).message}`;
      }
    });
  }

  private async initializePuppeteer(): Promise<void> {
    try {
      console.log('Initializing Puppeteer automation...');
      const success = await this.puppeteerManager.initialize();
      if (success) {
        console.log('Puppeteer initialized successfully');
      } else {
        console.error('Failed to initialize Puppeteer');
      }
    } catch (error) {
      console.error('Error during Puppeteer initialization:', error);
    }
  }

  private async initializeAIServices(): Promise<void> {
    try {
      console.log('Initializing AI services...');
      const results = await this.aiManager.initializeAllServices();
      
      const initializedServices = Object.entries(results)
        .filter(([_, success]) => success)
        .map(([service, _]) => service);

      if (initializedServices.length > 0) {
        console.log(`AI services initialized: ${initializedServices.join(', ')}`);
      } else {
        console.log('No AI services initialized. Please configure API keys in settings.');
      }
    } catch (error) {
      console.error('Failed to initialize AI services:', error);
    }
  }

  private initializeMonitoring(): void {
    try {
      console.log('Initializing performance monitoring...');
      
      // Start performance monitoring
      this.performanceMonitor.start(10000); // Every 10 seconds
      
      // Set up event listeners
      this.performanceMonitor.on('performanceWarning', ({ metrics, warnings }) => {
        console.warn('Performance warning:', warnings);
        
        // Send to renderer process if window exists
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          try {
            this.mainWindow.webContents.send('performance:warning', { metrics, warnings });
          } catch (error) {
            console.error('Error sending performance warning:', error);
          }
        }
      });

      this.performanceMonitor.on('metricsUpdated', (metrics) => {
        // Send updated metrics to renderer process if window exists
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          try {
            this.mainWindow.webContents.send('performance:metrics', metrics);
          } catch (error) {
            console.error('Error sending performance metrics:', error);
          }
        }
      });

      console.log('Performance monitoring initialized');
    } catch (error) {
      console.error('Error initializing monitoring:', error);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      console.log('Cleaning up application resources...');
      
      // Stop performance monitoring
      this.performanceMonitor.stop();
      
      // Cleanup Puppeteer
      await this.puppeteerManager.cleanup();
      
      console.log('Application cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Initialize the application
new BrawzaApp();