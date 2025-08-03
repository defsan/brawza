import { Application } from 'spectron';
import { createApp, cleanupApp } from '../setup';

describe('AI End-to-End Workflows', () => {
  let app: Application;

  beforeEach(async () => {
    app = createApp();
    await app.start();
  });

  afterEach(async () => {
    await cleanupApp(app);
  });

  describe('Complete AI Setup Workflow', () => {
    test('should complete the full AI service setup process', async () => {
      // Step 1: Navigate to a webpage
      const urlBar = await app.client.$('#url-bar');
      const goBtn = await app.client.$('#go-btn');
      
      await urlBar.setValue('example.com');
      await goBtn.click();
      await app.client.pause(1000);

      // Step 2: Open settings
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(300);

      // Step 3: Read help instructions
      const helpText = await app.client.$('.settings-help');
      const helpContent = await helpText.getText();
      expect(helpContent).toContain('Click the links below');

      // Step 4: Click dashboard link (simulates opening API key page)
      const openaiLink = await app.client.$('#openai-dashboard');
      await openaiLink.click();
      await app.client.pause(500);

      // Step 5: Settings should close and browser should navigate
      const modal = await app.client.$('#settings-modal');
      let modalClasses = await modal.getAttribute('class');
      expect(modalClasses).toContain('hidden');

      // Step 6: Reopen settings (user returns with API key)
      await settingsBtn.click();
      await app.client.pause(300);

      // Step 7: Enter API key
      const apiKeyInput = await app.client.$('#openai-key');
      await apiKeyInput.setValue('sk-test1234567890abcdef');

      // Step 8: Test connection
      const testBtn = await app.client.$('#test-openai');
      await testBtn.click();
      await app.client.pause(1500); // Allow time for test

      // Step 9: Save settings
      const saveBtn = await app.client.$('#save-settings');
      await saveBtn.click();
      await app.client.pause(500);

      // Step 10: Settings should close
      modalClasses = await modal.getAttribute('class');
      expect(modalClasses).toContain('hidden');

      // Step 11: Open AI chat
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(300);

      // Step 12: Verify AI service selector
      const serviceSelect = await app.client.$('#ai-service-select');
      const selectedService = await serviceSelect.getValue();
      expect(selectedService).toBe('openai');

      // Step 13: Send AI message
      const chatInput = await app.client.$('#chat-input');
      const sendBtn = await app.client.$('#send-btn');
      
      await chatInput.setValue('Hello! Can you help me understand this webpage?');
      await sendBtn.click();
      await app.client.pause(1000);

      // Step 14: Verify message appears in chat
      const messages = await app.client.$$('.message');
      expect(messages.length).toBeGreaterThan(0);

      expect(app.isRunning()).toBe(true);
    });

    test('should handle multi-service AI configuration', async () => {
      // Configure all three AI services
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(300);

      // Configure OpenAI
      const openaiKey = await app.client.$('#openai-key');
      await openaiKey.setValue('sk-openai-test-key');
      
      const testOpenai = await app.client.$('#test-openai');
      await testOpenai.click();
      await app.client.pause(1000);

      // Configure Gemini
      const geminiKey = await app.client.$('#gemini-key');
      await geminiKey.setValue('gemini-test-key-12345');
      
      const testGemini = await app.client.$('#test-gemini');
      await testGemini.click();
      await app.client.pause(1000);

      // Configure Claude
      const claudeKey = await app.client.$('#claude-key');
      await claudeKey.setValue('claude-test-key-67890');
      
      const testClaude = await app.client.$('#test-claude');
      await testClaude.click();
      await app.client.pause(1000);

      // Save all settings
      const saveBtn = await app.client.$('#save-settings');
      await saveBtn.click();
      await app.client.pause(500);

      // Test switching between services
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(300);

      const serviceSelect = await app.client.$('#ai-service-select');
      const chatInput = await app.client.$('#chat-input');
      const sendBtn = await app.client.$('#send-btn');

      // Test OpenAI
      await serviceSelect.selectByValue('openai');
      await chatInput.setValue('Test message for OpenAI');
      await sendBtn.click();
      await app.client.pause(800);

      // Test Gemini
      await serviceSelect.selectByValue('gemini');
      await chatInput.clearValue();
      await chatInput.setValue('Test message for Gemini');
      await sendBtn.click();
      await app.client.pause(800);

      // Test Claude
      await serviceSelect.selectByValue('claude');
      await chatInput.clearValue();
      await chatInput.setValue('Test message for Claude');
      await sendBtn.click();
      await app.client.pause(800);

      expect(app.isRunning()).toBe(true);
    });
  });

  describe('AI-Assisted Web Browsing Workflows', () => {
    test('should use AI to analyze web pages', async () => {
      // Navigate to a content-rich page
      const urlBar = await app.client.$('#url-bar');
      const goBtn = await app.client.$('#go-btn');
      
      await urlBar.setValue('https://en.wikipedia.org/wiki/Artificial_intelligence');
      await goBtn.click();
      await app.client.pause(2000);

      // Open AI chat
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(300);

      // Ask AI to analyze the page
      const chatInput = await app.client.$('#chat-input');
      const sendBtn = await app.client.$('#send-btn');
      
      await chatInput.setValue('Can you summarize what this page is about?');
      await sendBtn.click();
      await app.client.pause(1500);

      // Ask follow-up questions
      await chatInput.clearValue();
      await chatInput.setValue('What are the main topics covered on this page?');
      await sendBtn.click();
      await app.client.pause(1500);

      await chatInput.clearValue();
      await chatInput.setValue('Find me information about machine learning on this page');
      await sendBtn.click();
      await app.client.pause(1500);

      const messages = await app.client.$$('.message');
      expect(messages.length).toBeGreaterThan(0);
      expect(app.isRunning()).toBe(true);
    });

    test('should use AI for web automation guidance', async () => {
      // Navigate to a form-heavy page
      const urlBar = await app.client.$('#url-bar');
      const goBtn = await app.client.$('#go-btn');
      
      await urlBar.setValue('https://www.google.com');
      await goBtn.click();
      await app.client.pause(2000);

      // Open AI chat
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(300);

      // Ask for automation help
      const chatInput = await app.client.$('#chat-input');
      const sendBtn = await app.client.$('#send-btn');
      
      await chatInput.setValue('How can I search for "machine learning" on this page?');
      await sendBtn.click();
      await app.client.pause(1500);

      await chatInput.clearValue();
      await chatInput.setValue('What elements can I interact with on this page?');
      await sendBtn.click();
      await app.client.pause(1500);

      await chatInput.clearValue();
      await chatInput.setValue('Help me navigate to the images section');
      await sendBtn.click();
      await app.client.pause(1500);

      expect(app.isRunning()).toBe(true);
    });

    test('should handle page navigation with AI context', async () => {
      const urlBar = await app.client.$('#url-bar');
      const goBtn = await app.client.$('#go-btn');
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      const chatInput = await app.client.$('#chat-input');
      const sendBtn = await app.client.$('#send-btn');

      // Navigate to first page
      await urlBar.setValue('github.com');
      await goBtn.click();
      await app.client.pause(1500);

      // Open AI and ask about the page
      await sidebarToggle.click();
      await app.client.pause(300);
      
      await chatInput.setValue('What is this website about?');
      await sendBtn.click();
      await app.client.pause(1000);

      // Navigate to different page
      await urlBar.clearValue();
      await urlBar.setValue('stackoverflow.com');
      await goBtn.click();
      await app.client.pause(1500);

      // Ask AI about the new page
      await chatInput.clearValue();
      await chatInput.setValue('How is this different from the previous page?');
      await sendBtn.click();
      await app.client.pause(1000);

      // Navigate to third page
      await urlBar.clearValue();
      await urlBar.setValue('reddit.com');
      await goBtn.click();
      await app.client.pause(1500);

      // Ask for comparison
      await chatInput.clearValue();
      await chatInput.setValue('Compare these three websites I just visited');
      await sendBtn.click();
      await app.client.pause(1000);

      expect(app.isRunning()).toBe(true);
    });
  });

  describe('AI Error Recovery Workflows', () => {
    test('should handle AI service failures gracefully', async () => {
      // Configure AI with invalid key
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(300);

      const apiKeyInput = await app.client.$('#openai-key');
      await apiKeyInput.setValue('invalid-key-12345');
      
      const saveBtn = await app.client.$('#save-settings');
      await saveBtn.click();
      await app.client.pause(500);

      // Try to use AI
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(300);

      const chatInput = await app.client.$('#chat-input');
      const sendBtn = await app.client.$('#send-btn');
      
      await chatInput.setValue('This should fail with invalid API key');
      await sendBtn.click();
      await app.client.pause(1000);

      // Should show error message but not crash
      const messages = await app.client.$$('.message');
      expect(messages.length).toBeGreaterThan(0);

      // Try different service
      const serviceSelect = await app.client.$('#ai-service-select');
      await serviceSelect.selectByValue('gemini');
      
      await chatInput.clearValue();
      await chatInput.setValue('Try with different service');
      await sendBtn.click();
      await app.client.pause(1000);

      expect(app.isRunning()).toBe(true);
    });

    test('should recover from network issues', async () => {
      // Simulate network issues by rapid requests
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(300);

      const chatInput = await app.client.$('#chat-input');
      const sendBtn = await app.client.$('#send-btn');

      // Send multiple rapid requests
      for (let i = 0; i < 5; i++) {
        await chatInput.clearValue();
        await chatInput.setValue(`Rapid request ${i + 1}`);
        await sendBtn.click();
        await app.client.pause(100); // Very short pause
      }

      await app.client.pause(2000); // Let requests process

      // App should still be responsive
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(300);

      const closeBtn = await app.client.$('#settings-close');
      await closeBtn.click();

      expect(app.isRunning()).toBe(true);
    });
  });

  describe('AI Performance Workflows', () => {
    test('should handle large content analysis', async () => {
      // Navigate to content-heavy page
      const urlBar = await app.client.$('#url-bar');
      const goBtn = await app.client.$('#go-btn');
      
      await urlBar.setValue('https://en.wikipedia.org/wiki/Computer_science');
      await goBtn.click();
      await app.client.pause(2000);

      // Open AI chat
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(300);

      // Ask for comprehensive analysis
      const chatInput = await app.client.$('#chat-input');
      const sendBtn = await app.client.$('#send-btn');
      
      const longQuery = `Please provide a detailed analysis of this page including:
      1. Main topics and subtopics
      2. Key concepts mentioned
      3. Historical information
      4. Related fields
      5. Important figures mentioned
      6. Summary of each major section`;

      await chatInput.setValue(longQuery);
      await sendBtn.click();
      await app.client.pause(3000); // Allow more time for processing

      // UI should remain responsive
      const serviceSelect = await app.client.$('#ai-service-select');
      await serviceSelect.selectByValue('claude');
      
      expect(app.isRunning()).toBe(true);
    });

    test('should handle concurrent AI operations', async () => {
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(300);

      const chatInput = await app.client.$('#chat-input');
      const sendBtn = await app.client.$('#send-btn');

      // Start multiple operations in sequence
      const queries = [
        'What is artificial intelligence?',
        'Explain machine learning basics',
        'Describe neural networks',
        'What is deep learning?',
        'Compare AI and ML'
      ];

      for (const query of queries) {
        await chatInput.clearValue();
        await chatInput.setValue(query);
        await sendBtn.click();
        await app.client.pause(300); // Short pause between requests
      }

      // Let all requests process
      await app.client.pause(3000);

      // App should still be responsive
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(200);

      const closeBtn = await app.client.$('#settings-close');
      await closeBtn.click();

      expect(app.isRunning()).toBe(true);
    });
  });

  describe('Complete User Journey', () => {
    test('should complete full Brawza user journey with AI', async () => {
      // 1. User opens Brawza
      expect(app.isRunning()).toBe(true);

      // 2. User navigates to a website
      const urlBar = await app.client.$('#url-bar');
      const goBtn = await app.client.$('#go-btn');
      
      await urlBar.setValue('news.ycombinator.com');
      await goBtn.click();
      await app.client.pause(2000);

      // 3. User opens settings to configure AI
      const settingsBtn = await app.client.$('#settings-btn');
      await settingsBtn.click();
      await app.client.pause(300);

      // 4. User clicks dashboard link to get API key
      const openaiLink = await app.client.$('#openai-dashboard');
      await openaiLink.click();
      await app.client.pause(500);

      // 5. User returns and enters API key
      await settingsBtn.click();
      await app.client.pause(300);

      const apiKeyInput = await app.client.$('#openai-key');
      await apiKeyInput.setValue('sk-user-api-key-from-dashboard');

      // 6. User tests connection
      const testBtn = await app.client.$('#test-openai');
      await testBtn.click();
      await app.client.pause(1000);

      // 7. User saves settings
      const saveBtn = await app.client.$('#save-settings');
      await saveBtn.click();
      await app.client.pause(500);

      // 8. User opens AI chat
      const sidebarToggle = await app.client.$('#sidebar-toggle');
      await sidebarToggle.click();
      await app.client.pause(300);

      // 9. User asks AI about the page
      const chatInput = await app.client.$('#chat-input');
      const sendBtn = await app.client.$('#send-btn');
      
      await chatInput.setValue('What are the top stories on this page right now?');
      await sendBtn.click();
      await app.client.pause(1500);

      // 10. User asks follow-up questions
      await chatInput.clearValue();
      await chatInput.setValue('Find me stories about technology');
      await sendBtn.click();
      await app.client.pause(1500);

      // 11. User navigates to different page
      await urlBar.clearValue();
      await urlBar.setValue('github.com/trending');
      await goBtn.click();
      await app.client.pause(2000);

      // 12. User asks AI about new page
      await chatInput.clearValue();
      await chatInput.setValue('What are the trending repositories today?');
      await sendBtn.click();
      await app.client.pause(1500);

      // 13. User switches AI service
      const serviceSelect = await app.client.$('#ai-service-select');
      await serviceSelect.selectByValue('gemini');

      await chatInput.clearValue();
      await chatInput.setValue('Compare this with the previous page I visited');
      await sendBtn.click();
      await app.client.pause(1500);

      // 14. User closes AI sidebar
      const sidebarClose = await app.client.$('#sidebar-close');
      await sidebarClose.click();
      await app.client.pause(300);

      // 15. User continues browsing
      await urlBar.clearValue();
      await urlBar.setValue('stackoverflow.com');
      await goBtn.click();
      await app.client.pause(1500);

      // Complete journey should work without crashes
      expect(app.isRunning()).toBe(true);
    });
  });
});