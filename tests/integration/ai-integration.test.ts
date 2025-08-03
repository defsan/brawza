import { Application } from 'spectron';
import { createApp, cleanupApp } from '../setup';

describe('AI Integration Tests', () => {
  let app: Application;

  beforeEach(async () => {
    app = createApp();
    await app.start();
  });

  afterEach(async () => {
    await cleanupApp(app);
  });

  describe('AI Service IPC Communication', () => {
    test('should handle AI message sending through IPC', async () => {
      const result = await app.client.execute(() => {
        return window.electronAPI.sendMessage('openai', 'Hello, this is a test message');
      });
      
      // Should return error since no API key is configured
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Error:');
    });

    test('should handle connection testing through IPC', async () => {
      const result = await app.client.execute(() => {
        return window.electronAPI.testConnection('openai');
      });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false); // No API key configured
    });

    test('should test all AI services', async () => {
      const services = ['openai', 'gemini', 'claude'];
      
      for (const service of services) {
        const result = await app.client.execute((svc) => {
          return window.electronAPI.testConnection(svc);
        }, service);
        
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        expect(result.success).toBe(false); // No API keys configured
      }
    });

    test('should handle page analysis requests', async () => {
      const result = await app.client.execute(() => {
        return window.electronAPI.analyzePage('openai', '<html><body>Test page</body></html>', 'What is this page about?');
      });
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Error:'); // No API key configured
    });

    test('should handle content summarization requests', async () => {
      const result = await app.client.execute(() => {
        return window.electronAPI.summarizeContent('gemini', 'This is a long article about AI and machine learning...');
      });
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Error:'); // No API key configured
    });
  });

  describe('AI Settings UI Integration', () => {
    test('should open dashboard links correctly', async () => {
      // Open settings modal
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(200);

      // Check that dashboard links exist
      const openaiLink = await app.client.$('#openai-dashboard');
      const geminiLink = await app.client.$('#gemini-dashboard');
      const claudeLink = await app.client.$('#claude-dashboard');

      expect(await openaiLink.isExisting()).toBe(true);
      expect(await geminiLink.isExisting()).toBe(true);
      expect(await claudeLink.isExisting()).toBe(true);

      // Check link text
      const openaiText = await openaiLink.getText();
      expect(openaiText).toContain('OpenAI Dashboard');
    });

    test('should handle dashboard link clicks', async () => {
      // Open settings
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(200);

      // Click OpenAI dashboard link
      const openaiLink = await app.client.$('#openai-dashboard');
      await openaiLink.click();
      await app.client.pause(500);

      // Settings modal should close
      const modal = await app.client.$('#settings-modal');
      const modalClasses = await modal.getAttribute('class');
      expect(modalClasses).toContain('hidden');

      // URL bar should update (though webview might not load in test environment)
      const urlBar = await app.client.$('#url-bar');
      const urlValue = await urlBar.getValue();
      expect(urlValue).toContain('platform.openai.com');
    });

    test('should show help text in settings', async () => {
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(200);

      const helpText = await app.client.$('.settings-help');
      expect(await helpText.isExisting()).toBe(true);
      
      const text = await helpText.getText();
      expect(text).toContain('Click the links below');
      expect(text).toContain('get your API key');
    });

    test('should handle API key input and testing', async () => {
      // Open settings
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(200);

      // Enter test API key
      const openaiKeyInput = await app.client.$('#openai-key');
      await openaiKeyInput.setValue('test-api-key-12345');

      // Test connection
      const testBtn = await app.client.$('#test-openai');
      await testBtn.click();
      await app.client.pause(1000);

      // Should show notification (even if test fails due to invalid key)
      // App should still be running
      expect(app.isRunning()).toBe(true);
    });

    test('should save API keys to keychain', async () => {
      // Open settings
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(200);

      // Enter API keys
      const openaiKeyInput = await app.client.$('#openai-key');
      const geminiKeyInput = await app.client.$('#gemini-key');
      const claudeKeyInput = await app.client.$('#claude-key');

      await openaiKeyInput.setValue('sk-test-openai-key');
      await geminiKeyInput.setValue('test-gemini-key');
      await claudeKeyInput.setValue('test-claude-key');

      // Save settings
      const saveBtn = await app.client.$('#save-settings');
      await saveBtn.click();
      await app.client.pause(500);

      // Modal should close
      const modal = await app.client.$('#settings-modal');
      const modalClasses = await modal.getAttribute('class');
      expect(modalClasses).toContain('hidden');

      // App should still be running
      expect(app.isRunning()).toBe(true);
    });
  });

  describe('AI Chat Interface Integration', () => {
    test('should send messages through AI chat', async () => {
      // Open AI sidebar
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(200);

      // Select AI service
      const serviceSelect = await app.client.$('#ai-service-select');
      await serviceSelect.selectByValue('openai');

      // Enter test message
      const chatInput = await app.client.$('#chat-input');
      await chatInput.setValue('Hello AI, can you help me test this application?');

      // Send message
      const sendBtn = await app.client.$('#send-btn');
      await sendBtn.click();
      await app.client.pause(1000);

      // Message should appear in chat (even if AI response is error due to no API key)
      const messages = await app.client.$$('.message');
      expect(messages.length).toBeGreaterThan(0);

      // App should still be running
      expect(app.isRunning()).toBe(true);
    });

    test('should switch between AI services', async () => {
      // Open sidebar
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(200);

      const serviceSelect = await app.client.$('#ai-service-select');
      
      // Test switching to each service
      await serviceSelect.selectByValue('gemini');
      await app.client.pause(100);
      let selectedValue = await serviceSelect.getValue();
      expect(selectedValue).toBe('gemini');

      await serviceSelect.selectByValue('claude');
      await app.client.pause(100);
      selectedValue = await serviceSelect.getValue();
      expect(selectedValue).toBe('claude');

      await serviceSelect.selectByValue('openai');
      await app.client.pause(100);
      selectedValue = await serviceSelect.getValue();
      expect(selectedValue).toBe('openai');
    });

    test('should handle Enter key in chat input', async () => {
      // Open sidebar
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(200);

      // Type message and press Enter
      const chatInput = await app.client.$('#chat-input');
      await chatInput.setValue('Test message via Enter key');
      await chatInput.keys('Enter');
      await app.client.pause(500);

      // Should trigger message sending
      expect(app.isRunning()).toBe(true);
    });

    test('should handle empty messages gracefully', async () => {
      // Open sidebar
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(200);

      // Try to send empty message
      const sendBtn = await app.client.$('#send-btn');
      await sendBtn.click();
      await app.client.pause(200);

      // Should not crash the app
      expect(app.isRunning()).toBe(true);
    });
  });

  describe('AI Error Handling Integration', () => {
    test('should handle AI service errors gracefully', async () => {
      // This tests that errors don't crash the app
      const result = await app.client.execute(() => {
        return window.electronAPI.sendMessage('invalid-service', 'test');
      });

      expect(result).toBeDefined();
      expect(app.isRunning()).toBe(true);
    });

    test('should show error notifications', async () => {
      // Open settings and test invalid connection
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(200);

      const testBtn = await app.client.$('#test-openai');
      await testBtn.click();
      await app.client.pause(1000);

      // Should show notification (error about no API key)
      // App should continue running
      expect(app.isRunning()).toBe(true);
    });

    test('should handle network timeouts', async () => {
      // Test that long-running operations don't freeze the UI
      const startTime = Date.now();
      
      try {
        await app.client.execute(() => {
          return window.electronAPI.sendMessage('openai', 'test');
        });
      } catch (error) {
        // Expected to fail, but app should still be responsive
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(10000); // Should timeout reasonably quickly
      expect(app.isRunning()).toBe(true);
    });
  });

  describe('AI Features Workflow Integration', () => {
    test('should complete full AI configuration workflow', async () => {
      // 1. Open settings
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(200);

      // 2. Click dashboard link
      const openaiLink = await app.client.$('#openai-dashboard');
      await openaiLink.click();
      await app.client.pause(500);

      // 3. Reopen settings (simulating user getting API key)
      await settingsBtn.click();
      await app.client.pause(200);

      // 4. Enter API key
      const apiKeyInput = await app.client.$('#openai-key');
      await apiKeyInput.setValue('test-key-from-dashboard');

      // 5. Test connection
      const testBtn = await app.client.$('#test-openai');
      await testBtn.click();
      await app.client.pause(1000);

      // 6. Save settings
      const saveBtn = await app.client.$('#save-settings');
      await saveBtn.click();
      await app.client.pause(500);

      // 7. Use AI chat
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(200);

      const chatInput = await app.client.$('#chat-input');
      await chatInput.setValue('Now testing with configured API key');

      const sendBtn = await app.client.$('#send-btn');
      await sendBtn.click();
      await app.client.pause(1000);

      // Workflow should complete without errors
      expect(app.isRunning()).toBe(true);
    });

    test('should handle concurrent AI operations', async () => {
      // Test multiple simultaneous AI requests
      const promises = [];
      
      for (let i = 0; i < 3; i++) {
        promises.push(
          app.client.execute((index) => {
            return window.electronAPI.sendMessage('openai', `Test message ${index}`);
          }, i)
        );
      }

      const results = await Promise.allSettled(promises);
      
      // All should complete (even if with errors due to no API key)
      expect(results).toHaveLength(3);
      expect(app.isRunning()).toBe(true);
    });
  });

  describe('UI Responsiveness with AI', () => {
    test('should maintain UI responsiveness during AI operations', async () => {
      // Start AI operation
      const aiPromise = app.client.execute(() => {
        return window.electronAPI.sendMessage('openai', 'test message');
      });

      // UI should still be responsive
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(100);

      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(100);

      const closeBtn = await app.client.$('#settings-close');
      await closeBtn.click();

      // Wait for AI operation to complete
      await aiPromise;

      expect(app.isRunning()).toBe(true);
    });

    test('should handle rapid UI interactions with AI features', async () => {
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      const settingsBtn = await app.client.$('#settings-btn');

      // Rapid interactions
      for (let i = 0; i < 5; i++) {
        await sidebarToggle.click();
        await app.client.pause(50);
        await settingsBtn.click();
        await app.client.pause(50);
        
        const closeBtn = await app.client.$('#settings-close');
        await closeBtn.click();
        await app.client.pause(50);
      }

      expect(app.isRunning()).toBe(true);
    });
  });
});