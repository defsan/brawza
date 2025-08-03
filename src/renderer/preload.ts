import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Development flag
  isDevelopment: process.env.NODE_ENV !== 'production',
  
  // App info
  appVersion: '1.0.0',
  platform: process.platform,
  
  // Browser automation
  navigateTo: (url: string) => ipcRenderer.invoke('browser:navigate', url),
  goBack: () => ipcRenderer.invoke('browser:back'),
  goForward: () => ipcRenderer.invoke('browser:forward'),
  refresh: () => ipcRenderer.invoke('browser:refresh'),
  
  // AI services
  sendMessage: (service: string, message: string) => 
    ipcRenderer.invoke('ai:send-message', service, message),
  testConnection: (service: string) => ipcRenderer.invoke('ai:test-connection', service),
  analyzePage: (service: string, pageContent: string, query: string) => 
    ipcRenderer.invoke('ai:analyze-page', service, pageContent, query),
  summarizeContent: (service: string, content: string) => 
    ipcRenderer.invoke('ai:summarize-content', service, content),
  
  // Settings
  saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  
  // Puppeteer Automation
  createPage: (pageId: string) => ipcRenderer.invoke('automation:create-page', pageId),
  navigateToUrl: (pageId: string, url: string) => ipcRenderer.invoke('automation:navigate', pageId, url),
  getPageContent: (pageId: string, includeHTML?: boolean) => ipcRenderer.invoke('automation:get-content', pageId, includeHTML),
  takeScreenshot: (pageId: string, fullPage?: boolean) => ipcRenderer.invoke('automation:screenshot', pageId, fullPage),
  clickElement: (pageId: string, selector: string) => ipcRenderer.invoke('automation:click', pageId, selector),
  fillForm: (pageId: string, formData: Record<string, string>) => ipcRenderer.invoke('automation:fill-form', pageId, formData),
  evaluateScript: (pageId: string, script: string) => ipcRenderer.invoke('automation:evaluate', pageId, script),
  closePage: (pageId: string) => ipcRenderer.invoke('automation:close-page', pageId),
  getAllPages: () => ipcRenderer.invoke('automation:get-pages'),
  
  // Performance Monitoring
  getMetrics: () => ipcRenderer.invoke('monitoring:get-metrics'),
  getHistory: () => ipcRenderer.invoke('monitoring:get-history'),
  getReport: () => ipcRenderer.invoke('monitoring:get-report'),
  optimizeMemory: () => ipcRenderer.invoke('monitoring:optimize'),
  getRateLimits: () => ipcRenderer.invoke('monitoring:rate-limits'),
  
  // Security
  storeToken: (service: string, token: string) => 
    ipcRenderer.invoke('security:store-token', service, token),
  getToken: (service: string) => ipcRenderer.invoke('security:get-token', service),
  
  // Event listeners
  onNavigationChange: (callback: (url: string) => void) => {
    ipcRenderer.on('navigation:changed', (event, url) => callback(url));
  },
  
  onAIResponse: (callback: (service: string, response: string) => void) => {
    ipcRenderer.on('ai:response', (event, service, response) => callback(service, response));
  },
  
  onPerformanceMetrics: (callback: (metrics: any) => void) => {
    ipcRenderer.on('performance:metrics', (event, metrics) => callback(metrics));
  },
  
  onPerformanceWarning: (callback: (data: { metrics: any; warnings: string[] }) => void) => {
    ipcRenderer.on('performance:warning', (event, data) => callback(data));
  },

  // WebView control events
  onWebViewBack: (callback: () => void) => {
    ipcRenderer.on('webview:go-back', () => callback());
  },
  
  onWebViewForward: (callback: () => void) => {
    ipcRenderer.on('webview:go-forward', () => callback());
  },
  
  onWebViewRefresh: (callback: () => void) => {
    ipcRenderer.on('webview:refresh', () => callback());
  }
});

// Types for the exposed API
declare global {
  interface Window {
    electronAPI: {
      isDevelopment: boolean;
      appVersion: string;
      platform: string;
      navigateTo: (url: string) => Promise<void>;
      goBack: () => Promise<void>;
      goForward: () => Promise<void>;
      refresh: () => Promise<void>;
      sendMessage: (service: string, message: string) => Promise<string>;
      testConnection: (service: string) => Promise<{ success: boolean; error?: string }>;
      analyzePage: (service: string, pageContent: string, query: string) => Promise<string>;
      summarizeContent: (service: string, content: string) => Promise<string>;
      saveSettings: (settings: any) => Promise<void>;
      loadSettings: () => Promise<any>;
      createPage: (pageId: string) => Promise<{ success: boolean; pageId?: string; error?: string }>;
      navigateToUrl: (pageId: string, url: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      getPageContent: (pageId: string, includeHTML?: boolean) => Promise<{ success: boolean; data?: any; error?: string }>;
      takeScreenshot: (pageId: string, fullPage?: boolean) => Promise<{ success: boolean; screenshot?: Buffer; error?: string }>;
      clickElement: (pageId: string, selector: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      fillForm: (pageId: string, formData: Record<string, string>) => Promise<{ success: boolean; data?: any; error?: string }>;
      evaluateScript: (pageId: string, script: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      closePage: (pageId: string) => Promise<{ success: boolean; error?: string }>;
      getAllPages: () => Promise<{ success: boolean; pages?: string[]; error?: string }>;
      getMetrics: () => Promise<{ success: boolean; metrics?: any; error?: string }>;
      getHistory: () => Promise<{ success: boolean; history?: any[]; error?: string }>;
      getReport: () => Promise<{ success: boolean; report?: string; error?: string }>;
      optimizeMemory: () => Promise<{ success: boolean; error?: string }>;
      getRateLimits: () => Promise<{ success: boolean; stats?: any; error?: string }>;
      storeToken: (service: string, token: string) => Promise<void>;
      getToken: (service: string) => Promise<string>;
      onNavigationChange: (callback: (url: string) => void) => void;
      onAIResponse: (callback: (service: string, response: string) => void) => void;
      onPerformanceMetrics: (callback: (metrics: any) => void) => void;
      onPerformanceWarning: (callback: (data: { metrics: any; warnings: string[] }) => void) => void;
      onWebViewBack: (callback: () => void) => void;
      onWebViewForward: (callback: () => void) => void;
      onWebViewRefresh: (callback: () => void) => void;
    };
  }
}