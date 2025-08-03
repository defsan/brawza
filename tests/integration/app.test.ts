import { Application } from 'spectron';
import { createApp, cleanupApp } from '../setup';

describe('Brawza Application Integration Tests', () => {
  let app: Application;

  beforeEach(async () => {
    app = createApp();
    await app.start();
  });

  afterEach(async () => {
    await cleanupApp(app);
  });

  describe('Application Launch', () => {
    test('should launch application successfully', async () => {
      expect(app.isRunning()).toBe(true);
    });

    test('should have correct window title', async () => {
      const title = await app.client.getTitle();
      expect(title).toBe('Brawza - AI-Agent Browser');
    });

    test('should have main window visible', async () => {
      const windowCount = await app.client.getWindowCount();
      expect(windowCount).toBe(1);
      
      const isVisible = await app.browserWindow.isVisible();
      expect(isVisible).toBe(true);
    });

    test('should have correct window dimensions', async () => {
      const bounds = await app.browserWindow.getBounds();
      expect(bounds.width).toBe(1400);
      expect(bounds.height).toBe(900);
    });
  });

  describe('UI Elements Presence', () => {
    test('should have navigation header', async () => {
      const header = await app.client.$('#header');
      expect(await header.isExisting()).toBe(true);
    });

    test('should have navigation controls', async () => {
      const backBtn = await app.client.$('#back-btn');
      const forwardBtn = await app.client.$('#forward-btn');
      const refreshBtn = await app.client.$('#refresh-btn');
      const urlBar = await app.client.$('#url-bar');
      const goBtn = await app.client.$('#go-btn');

      expect(await backBtn.isExisting()).toBe(true);
      expect(await forwardBtn.isExisting()).toBe(true);
      expect(await refreshBtn.isExisting()).toBe(true);
      expect(await urlBar.isExisting()).toBe(true);
      expect(await goBtn.isExisting()).toBe(true);
    });

    test('should have window controls', async () => {
      const settingsBtn = await app.client.$('#settings-btn');
      const sidebarToggle = await app.client.$('#sidebar-toggle');

      expect(await settingsBtn.isExisting()).toBe(true);
      expect(await sidebarToggle.isExisting()).toBe(true);
    });

    test('should have browser container', async () => {
      const browserContainer = await app.client.$('#browser-container');
      const browserView = await app.client.$('#browser-view');

      expect(await browserContainer.isExisting()).toBe(true);
      expect(await browserView.isExisting()).toBe(true);
    });

    test('should have AI sidebar (initially hidden)', async () => {
      const sidebar = await app.client.$('#ai-sidebar');
      expect(await sidebar.isExisting()).toBe(true);
      
      const sidebarClasses = await sidebar.getAttribute('class');
      expect(sidebarClasses).toContain('hidden');
    });

    test('should have settings modal (initially hidden)', async () => {
      const modal = await app.client.$('#settings-modal');
      expect(await modal.isExisting()).toBe(true);
      
      const modalClasses = await modal.getAttribute('class');
      expect(modalClasses).toContain('hidden');
    });
  });

  describe('Navigation Functionality', () => {
    test('should enable URL input', async () => {
      const urlBar = await app.client.$('#url-bar');
      
      await urlBar.setValue('google.com');
      const value = await urlBar.getValue();
      expect(value).toBe('google.com');
    });

    test('should handle back button click', async () => {
      const backBtn = await app.client.$('#back-btn');
      
      await backBtn.click();
      // Should not throw error
    });

    test('should handle forward button click', async () => {
      const forwardBtn = await app.client.$('#forward-btn');
      
      await forwardBtn.click();
      // Should not throw error
    });

    test('should handle refresh button click', async () => {
      const refreshBtn = await app.client.$('#refresh-btn');
      
      await refreshBtn.click();
      // Should not throw error
    });

    test('should handle go button click', async () => {
      const urlBar = await app.client.$('#url-bar');
      const goBtn = await app.client.$('#go-btn');
      
      await urlBar.setValue('example.com');
      await goBtn.click();
      // Should not throw error
    });
  });

  describe('Sidebar Functionality', () => {
    test('should toggle sidebar visibility', async () => {
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      const sidebar = await app.client.$('#ai-sidebar');
      
      // Initially hidden
      let sidebarClasses = await sidebar.getAttribute('class');
      expect(sidebarClasses).toContain('hidden');
      
      // Click to show
      await sidebarToggle.click();
      await app.client.pause(100); // Wait for animation
      
      sidebarClasses = await sidebar.getAttribute('class');
      expect(sidebarClasses).not.toContain('hidden');
    });

    test('should close sidebar with close button', async () => {
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      const sidebar = await app.client.$('#ai-sidebar');
      const closeBtn = await app.client.$('#sidebar-close');
      
      // Open sidebar first
      await sidebarToggle.click();
      await app.client.pause(100);
      
      // Close it
      await closeBtn.click();
      await app.client.pause(100);
      
      const sidebarClasses = await sidebar.getAttribute('class');
      expect(sidebarClasses).toContain('hidden');
    });

    test('should have AI service selector', async () => {
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      const serviceSelect = await app.client.$('#ai-service-select');
      
      // Open sidebar first
      await sidebarToggle.click();
      await app.client.pause(100);
      
      expect(await serviceSelect.isExisting()).toBe(true);
      
      const options = await serviceSelect.$$('option');
      expect(options.length).toBe(3); // OpenAI, Gemini, Claude
    });

    test('should have chat input and send button', async () => {
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      const chatInput = await app.client.$('#chat-input');
      const sendBtn = await app.client.$('#send-btn');
      
      // Open sidebar first
      await sidebarToggle.click();
      await app.client.pause(100);
      
      expect(await chatInput.isExisting()).toBe(true);
      expect(await sendBtn.isExisting()).toBe(true);
    });
  });

  describe('Settings Modal Functionality', () => {
    test('should open settings modal', async () => {
      const settingsBtn = await app.client.$('#settings-btn');
      const modal = await app.client.$('#settings-modal');
      
      await settingsBtn.click();
      await app.client.pause(100);
      
      const modalClasses = await modal.getAttribute('class');
      expect(modalClasses).not.toContain('hidden');
    });

    test('should close settings modal', async () => {
      const settingsBtn = await app.client.$('#settings-btn');
      const modal = await app.client.$('#settings-modal');
      const closeBtn = await app.client.$('#settings-close');
      
      // Open modal first
      await settingsBtn.click();
      await app.client.pause(100);
      
      // Close it
      await closeBtn.click();
      await app.client.pause(100);
      
      const modalClasses = await modal.getAttribute('class');
      expect(modalClasses).toContain('hidden');
    });

    test('should have API key inputs', async () => {
      const settingsBtn = await app.client.$('#settings-btn');
      const openaiKey = await app.client.$('#openai-key');
      const geminiKey = await app.client.$('#gemini-key');
      const claudeKey = await app.client.$('#claude-key');
      
      await settingsBtn.click();
      await app.client.pause(100);
      
      expect(await openaiKey.isExisting()).toBe(true);
      expect(await geminiKey.isExisting()).toBe(true);
      expect(await claudeKey.isExisting()).toBe(true);
    });

    test('should have performance settings', async () => {
      const settingsBtn = await app.client.$('#settings-btn');
      const headlessMode = await app.client.$('#headless-mode');
      const memoryLimit = await app.client.$('#memory-limit');
      
      await settingsBtn.click();
      await app.client.pause(100);
      
      expect(await headlessMode.isExisting()).toBe(true);
      expect(await memoryLimit.isExisting()).toBe(true);
    });

    test('should have test connection buttons', async () => {
      const settingsBtn = await app.client.$('#settings-btn');
      const testOpenai = await app.client.$('#test-openai');
      const testGemini = await app.client.$('#test-gemini');
      const testClaude = await app.client.$('#test-claude');
      
      await settingsBtn.click();
      await app.client.pause(100);
      
      expect(await testOpenai.isExisting()).toBe(true);
      expect(await testGemini.isExisting()).toBe(true);
      expect(await testClaude.isExisting()).toBe(true);
    });

    test('should handle save settings button', async () => {
      const settingsBtn = await app.client.$('#settings-btn');
      const saveBtn = await app.client.$('#save-settings');
      
      await settingsBtn.click();
      await app.client.pause(100);
      
      await saveBtn.click();
      // Should not throw error
    });
  });

  describe('Keyboard Shortcuts', () => {
    test('should handle Enter key in URL bar', async () => {
      const urlBar = await app.client.$('#url-bar');
      
      await urlBar.setValue('test.com');
      await urlBar.keys('Enter');
      // Should not throw error
    });

    test('should handle Enter key in chat input', async () => {
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      const chatInput = await app.client.$('#chat-input');
      
      // Open sidebar first
      await sidebarToggle.click();
      await app.client.pause(100);
      
      await chatInput.setValue('test message');
      await chatInput.keys('Enter');
      // Should not throw error
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid URL gracefully', async () => {
      const urlBar = await app.client.$('#url-bar');
      const goBtn = await app.client.$('#go-btn');
      
      await urlBar.setValue('invalid-url');
      await goBtn.click();
      
      // App should still be running
      expect(app.isRunning()).toBe(true);
    });

    test('should handle empty chat message', async () => {
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      const sendBtn = await app.client.$('#send-btn');
      
      // Open sidebar first
      await sidebarToggle.click();
      await app.client.pause(100);
      
      // Try to send empty message
      await sendBtn.click();
      
      // App should still be running
      expect(app.isRunning()).toBe(true);
    });
  });
});