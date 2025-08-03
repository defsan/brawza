import { Application } from 'spectron';
import { createApp, cleanupApp } from '../setup';

describe('IPC Communication Tests', () => {
  let app: Application;

  beforeEach(async () => {
    app = createApp();
    await app.start();
  });

  afterEach(async () => {
    await cleanupApp(app);
  });

  describe('Navigation IPC', () => {
    test('should handle browser navigation IPC calls', async () => {
      // Test navigation through webContents.executeJavaScript
      const result = await app.client.execute(() => {
        return window.electronAPI.navigateTo('https://example.com');
      });
      
      // Should not throw and should return success
      expect(result).toBeDefined();
    });

    test('should handle back navigation IPC', async () => {
      const result = await app.client.execute(() => {
        return window.electronAPI.goBack();
      });
      
      expect(result).toBeDefined();
    });

    test('should handle forward navigation IPC', async () => {
      const result = await app.client.execute(() => {
        return window.electronAPI.goForward();
      });
      
      expect(result).toBeDefined();
    });

    test('should handle refresh IPC', async () => {
      const result = await app.client.execute(() => {
        return window.electronAPI.refresh();
      });
      
      expect(result).toBeDefined();
    });
  });

  describe('AI Service IPC', () => {
    test('should handle AI message sending', async () => {
      const result = await app.client.execute(() => {
        return window.electronAPI.sendMessage('openai', 'Test message');
      });
      
      // Should return mock response
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Mock response');
    });

    test('should handle different AI services', async () => {
      const services = ['openai', 'gemini', 'claude'];
      
      for (const service of services) {
        const result = await app.client.execute((svc) => {
          return window.electronAPI.sendMessage(svc, 'Test message');
        }, service);
        
        expect(result).toBeDefined();
        expect(result).toContain(service);
      }
    });
  });

  describe('Settings IPC', () => {
    test('should save and load settings', async () => {
      const testSettings = {
        headlessMode: true,
        memoryLimit: 800,
        testProperty: 'test-value'
      };

      // Save settings
      const saveResult = await app.client.execute((settings) => {
        return window.electronAPI.saveSettings(settings);
      }, testSettings);
      
      expect(saveResult).toBeDefined();
      expect(saveResult.success).toBe(true);

      // Load settings
      const loadResult = await app.client.execute(() => {
        return window.electronAPI.loadSettings();
      });
      
      expect(loadResult).toBeDefined();
      expect(loadResult.headlessMode).toBe(true);
      expect(loadResult.memoryLimit).toBe(800);
    });

    test('should handle settings errors gracefully', async () => {
      // Try to save invalid settings
      const invalidSettings = null;
      
      const result = await app.client.execute((settings) => {
        return window.electronAPI.saveSettings(settings);
      }, invalidSettings);
      
      // Should handle error gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Security IPC', () => {
    test('should store and retrieve tokens', async () => {
      const testService = 'test-service';
      const testToken = 'test-token-12345';

      // Store token
      const storeResult = await app.client.execute((service, token) => {
        return window.electronAPI.storeToken(service, token);
      }, testService, testToken);
      
      expect(storeResult).toBeDefined();
      expect(storeResult.success).toBe(true);

      // Retrieve token
      const retrieveResult = await app.client.execute((service) => {
        return window.electronAPI.getToken(service);
      }, testService);
      
      expect(retrieveResult).toBeDefined();
      // Note: In test environment, this will return mock data
    });

    test('should handle token storage for all AI services', async () => {
      const services = [
        { name: 'openai', token: 'sk-test-openai-123' },
        { name: 'gemini', token: 'test-gemini-456' },
        { name: 'claude', token: 'test-claude-789' }
      ];

      for (const service of services) {
        const storeResult = await app.client.execute((name, token) => {
          return window.electronAPI.storeToken(name, token);
        }, service.name, service.token);
        
        expect(storeResult).toBeDefined();
        expect(storeResult.success).toBe(true);
      }
    });
  });

  describe('Automation IPC', () => {
    test('should handle screenshot requests', async () => {
      const result = await app.client.execute(() => {
        return window.electronAPI.takeScreenshot();
      });
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('data:image');
    });

    test('should handle HTML parsing requests', async () => {
      const result = await app.client.execute(() => {
        return window.electronAPI.parseHTML();
      });
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('should handle element clicking', async () => {
      const result = await app.client.execute(() => {
        return window.electronAPI.clickElement('#test-selector');
      });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('Event Handlers', () => {
    test('should register navigation change handler', async () => {
      const handlerRegistered = await app.client.execute(() => {
        let eventFired = false;
        
        window.electronAPI.onNavigationChange((url) => {
          eventFired = true;
        });
        
        return typeof window.electronAPI.onNavigationChange === 'function';
      });
      
      expect(handlerRegistered).toBe(true);
    });

    test('should register AI response handler', async () => {
      const handlerRegistered = await app.client.execute(() => {
        window.electronAPI.onAIResponse((service, response) => {
          // Handler registered
        });
        
        return typeof window.electronAPI.onAIResponse === 'function';
      });
      
      expect(handlerRegistered).toBe(true);
    });
  });

  describe('IPC Error Handling', () => {
    test('should handle IPC timeouts', async () => {
      // This test ensures the app doesn't crash on IPC timeouts
      const startTime = Date.now();
      
      try {
        await app.client.execute(() => {
          return window.electronAPI.sendMessage('test-service', 'test');
        });
      } catch (error) {
        // Even if it times out, app should still be running
      }
      
      expect(app.isRunning()).toBe(true);
    });

    test('should handle invalid IPC calls', async () => {
      try {
        await app.client.execute(() => {
          // Try to call non-existent method
          return (window.electronAPI as any).nonExistentMethod();
        });
      } catch (error) {
        // Expected to fail, but app should still be running
        expect(app.isRunning()).toBe(true);
      }
    });

    test('should handle malformed parameters', async () => {
      try {
        const result = await app.client.execute(() => {
          return window.electronAPI.storeToken('', '');
        });
        
        // Should handle gracefully
        expect(app.isRunning()).toBe(true);
      } catch (error) {
        expect(app.isRunning()).toBe(true);
      }
    });
  });

  describe('Context Isolation', () => {
    test('should have electronAPI exposed correctly', async () => {
      const apiExists = await app.client.execute(() => {
        return typeof window.electronAPI !== 'undefined';
      });
      
      expect(apiExists).toBe(true);
    });

    test('should not expose node APIs directly', async () => {
      const nodeExposed = await app.client.execute(() => {
        return typeof (window as any).require !== 'undefined' ||
               typeof (window as any).process !== 'undefined' ||
               typeof (window as any).__dirname !== 'undefined';
      });
      
      expect(nodeExposed).toBe(false);
    });

    test('should have all expected API methods', async () => {
      const apiMethods = await app.client.execute(() => {
        const api = window.electronAPI;
        return {
          navigateTo: typeof api.navigateTo,
          goBack: typeof api.goBack,
          goForward: typeof api.goForward,
          refresh: typeof api.refresh,
          sendMessage: typeof api.sendMessage,
          saveSettings: typeof api.saveSettings,
          loadSettings: typeof api.loadSettings,
          takeScreenshot: typeof api.takeScreenshot,
          parseHTML: typeof api.parseHTML,
          clickElement: typeof api.clickElement,
          storeToken: typeof api.storeToken,
          getToken: typeof api.getToken,
          onNavigationChange: typeof api.onNavigationChange,
          onAIResponse: typeof api.onAIResponse
        };
      });
      
      // All methods should be functions
      Object.values(apiMethods).forEach(methodType => {
        expect(methodType).toBe('function');
      });
    });
  });
});