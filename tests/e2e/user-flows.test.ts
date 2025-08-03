import { Application } from 'spectron';
import { createApp, cleanupApp } from '../setup';

describe('End-to-End User Flows', () => {
  let app: Application;

  beforeEach(async () => {
    app = createApp();
    await app.start();
  });

  afterEach(async () => {
    await cleanupApp(app);
  });

  describe('Complete Navigation Flow', () => {
    test('should complete full navigation workflow', async () => {
      // 1. Enter URL
      const urlBar = await app.client.$('#url-bar');
      await urlBar.setValue('google.com');
      
      // 2. Navigate
      const goBtn = await app.client.$('#go-btn');
      await goBtn.click();
      
      // 3. Use navigation controls
      const backBtn = await app.client.$('#back-btn');
      const forwardBtn = await app.client.$('#forward-btn');
      const refreshBtn = await app.client.$('#refresh-btn');
      
      await app.client.pause(500);
      await backBtn.click();
      await app.client.pause(200);
      await forwardBtn.click();
      await app.client.pause(200);
      await refreshBtn.click();
      
      // App should still be running
      expect(app.isRunning()).toBe(true);
    });

    test('should handle multiple URL changes', async () => {
      const urlBar = await app.client.$('#url-bar');
      const goBtn = await app.client.$('#go-btn');
      
      const urls = ['google.com', 'github.com', 'stackoverflow.com'];
      
      for (const url of urls) {
        await urlBar.clearValue();
        await urlBar.setValue(url);
        await goBtn.click();
        await app.client.pause(300);
      }
      
      expect(app.isRunning()).toBe(true);
    });
  });

  describe('AI Sidebar Workflow', () => {
    test('should complete AI interaction workflow', async () => {
      // 1. Open sidebar
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(200);
      
      // 2. Select AI service
      const serviceSelect = await app.client.$('#ai-service-select');
      await serviceSelect.selectByValue('openai');
      
      // 3. Enter message
      const chatInput = await app.client.$('#chat-input');
      await chatInput.setValue('Hello, can you help me test this application?');
      
      // 4. Send message
      const sendBtn = await app.client.$('#send-btn');
      await sendBtn.click();
      await app.client.pause(500);
      
      // 5. Change AI service and send another message
      await serviceSelect.selectByValue('claude');
      await chatInput.setValue('Test message for Claude');
      await sendBtn.click();
      await app.client.pause(500);
      
      // 6. Close sidebar
      const closeBtn = await app.client.$('#sidebar-close');
      await closeBtn.click();
      
      expect(app.isRunning()).toBe(true);
    });

    test('should handle rapid sidebar toggling', async () => {
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      
      // Rapidly toggle sidebar multiple times
      for (let i = 0; i < 5; i++) {
        await sidebarToggle.click();
        await app.client.pause(100);
      }
      
      expect(app.isRunning()).toBe(true);
    });
  });

  describe('Settings Configuration Workflow', () => {
    test('should complete settings configuration flow', async () => {
      // 1. Open settings
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(200);
      
      // 2. Configure API keys
      const openaiKey = await app.client.$('#openai-key');
      const geminiKey = await app.client.$('#gemini-key');
      const claudeKey = await app.client.$('#claude-key');
      
      await openaiKey.setValue('sk-test-openai-key-123');
      await geminiKey.setValue('test-gemini-key-456');
      await claudeKey.setValue('test-claude-key-789');
      
      // 3. Configure performance settings
      const headlessMode = await app.client.$('#headless-mode');
      const memoryLimit = await app.client.$('#memory-limit');
      
      await headlessMode.click(); // Toggle headless mode
      await memoryLimit.setValue('750');
      
      // 4. Test connections (should not fail even with fake keys)
      const testOpenai = await app.client.$('#test-openai');
      const testGemini = await app.client.$('#test-gemini');
      const testClaude = await app.client.$('#test-claude');
      
      await testOpenai.click();
      await app.client.pause(500);
      await testGemini.click();
      await app.client.pause(500);
      await testClaude.click();
      await app.client.pause(500);
      
      // 5. Save settings
      const saveBtn = await app.client.$('#save-settings');
      await saveBtn.click();
      await app.client.pause(500);
      
      // Settings modal should close automatically
      const modal = await app.client.$('#settings-modal');
      const modalClasses = await modal.getAttribute('class');
      expect(modalClasses).toContain('hidden');
      
      expect(app.isRunning()).toBe(true);
    });

    test('should persist settings across modal sessions', async () => {
      const settingsBtn = await app.client.$('#settings-btn');
      const headlessMode = await app.client.$('#headless-mode');
      const memoryLimit = await app.client.$('#memory-limit');
      const saveBtn = await app.client.$('#save-settings');
      const closeBtn = await app.client.$('#settings-close');
      
      // First session: Set values
      await settingsBtn.click();
      await app.client.pause(200);
      
      await headlessMode.click();
      await memoryLimit.setValue('600');
      await saveBtn.click();
      await app.client.pause(300);
      
      // Second session: Check values persist
      await settingsBtn.click();
      await app.client.pause(200);
      
      const headlessChecked = await headlessMode.isSelected();
      const memoryValue = await memoryLimit.getValue();
      
      expect(headlessChecked).toBe(true);
      expect(memoryValue).toBe('600');
      
      await closeBtn.click();
      expect(app.isRunning()).toBe(true);
    });
  });

  describe('Combined Workflows', () => {
    test('should handle navigation + sidebar + settings workflow', async () => {
      // Navigate to a page
      const urlBar = await app.client.$('#url-bar');
      const goBtn = await app.client.$('#go-btn');
      
      await urlBar.setValue('example.com');
      await goBtn.click();
      await app.client.pause(500);
      
      // Open AI sidebar and send message
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(200);
      
      const chatInput = await app.client.$('#chat-input');
      const sendBtn = await app.client.$('#send-btn');
      
      await chatInput.setValue('Summarize this page');
      await sendBtn.click();
      await app.client.pause(500);
      
      // Open settings while sidebar is open
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(200);
      
      // Configure something in settings
      const openaiKey = await app.client.$('#openai-key');
      await openaiKey.setValue('test-key-combined-workflow');
      
      const saveSettingsBtn = await app.client.$('#save-settings');
      await saveSettingsBtn.click();
      await app.client.pause(300);
      
      // Navigate to another page
      await urlBar.clearValue();
      await urlBar.setValue('github.com');
      await goBtn.click();
      await app.client.pause(500);
      
      // Close sidebar
      const sidebarClose = await app.client.$('#sidebar-close');
      await sidebarClose.click();
      
      expect(app.isRunning()).toBe(true);
    });

    test('should handle stress test with rapid interactions', async () => {
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      const settingsBtn = await app.client.$('#settings-btn');
      const urlBar = await app.client.$('#url-bar');
      const goBtn = await app.client.$('#go-btn');
      
      // Rapid interactions to test stability
      for (let i = 0; i < 3; i++) {
        // Toggle sidebar
        await sidebarToggle.click();
        await app.client.pause(50);
        
        // Change URL
        await urlBar.clearValue();
        await urlBar.setValue(`test${i}.com`);
        await goBtn.click();
        await app.client.pause(50);
        
        // Open/close settings
        await settingsBtn.click();
        await app.client.pause(50);
        
        const settingsClose = await app.client.$('#settings-close');
        await settingsClose.click();
        await app.client.pause(50);
      }
      
      expect(app.isRunning()).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    test('should recover from navigation errors', async () => {
      const urlBar = await app.client.$('#url-bar');
      const goBtn = await app.client.$('#go-btn');
      
      // Try various invalid URLs
      const invalidUrls = ['', 'not-a-url', '://invalid', 'ftp://old-protocol'];
      
      for (const url of invalidUrls) {
        await urlBar.clearValue();
        await urlBar.setValue(url);
        await goBtn.click();
        await app.client.pause(200);
        
        // App should still be responsive
        expect(app.isRunning()).toBe(true);
      }
      
      // Should still be able to navigate to valid URL
      await urlBar.clearValue();
      await urlBar.setValue('google.com');
      await goBtn.click();
      await app.client.pause(500);
      
      expect(app.isRunning()).toBe(true);
    });

    test('should handle missing UI elements gracefully', async () => {
      // Try to interact with elements that might not exist
      try {
        const nonExistent = await app.client.$('#non-existent-element');
        await nonExistent.click();
      } catch (error) {
        // Expected to fail, but app should still be running
        expect(app.isRunning()).toBe(true);
      }
    });
  });
});