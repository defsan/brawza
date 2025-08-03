import { KeychainManager } from '../../src/main/security/keychain';
import { EncryptionManager } from '../../src/main/security/encryption';
import { SettingsManager } from '../../src/main/security/settings';

// Mock keytar for testing
jest.mock('keytar', () => ({
  setPassword: jest.fn().mockResolvedValue(undefined),
  getPassword: jest.fn().mockResolvedValue('mock-token-123'),
  deletePassword: jest.fn().mockResolvedValue(true),
  findCredentials: jest.fn().mockResolvedValue([
    { account: 'openai-api-token', password: 'mock-token' }
  ])
}));

// Mock electron app for testing
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/brawza-test')
  }
}));

// Mock fs for testing
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('test-key')),
  writeFileSync: jest.fn(),
  renameSync: jest.fn()
}));

describe('Security Components', () => {
  describe('KeychainManager', () => {
    let keychainManager: KeychainManager;

    beforeEach(() => {
      keychainManager = new KeychainManager();
    });

    test('should store token successfully', async () => {
      const result = await keychainManager.storeToken('openai', 'test-token-123');
      expect(result).toBeUndefined(); // void return
    });

    test('should retrieve token successfully', async () => {
      const token = await keychainManager.getToken('openai');
      expect(token).toBe('mock-token-123');
    });

    test('should delete token successfully', async () => {
      const deleted = await keychainManager.deleteToken('openai');
      expect(deleted).toBe(true);
    });

    test('should validate token exists', async () => {
      const isValid = await keychainManager.validateToken('openai');
      expect(isValid).toBe(true);
    });

    test('should list stored services', async () => {
      const services = await keychainManager.listStoredServices();
      expect(Array.isArray(services)).toBe(true);
    });

    test('should update token', async () => {
      await expect(keychainManager.updateToken('openai', 'new-token')).resolves.toBeUndefined();
    });
  });

  describe('EncryptionManager', () => {
    let encryptionManager: EncryptionManager;

    beforeEach(() => {
      encryptionManager = new EncryptionManager();
    });

    test('should encrypt and decrypt data correctly', () => {
      const plaintext = 'sensitive data to encrypt';
      const encrypted = encryptionManager.encrypt(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      
      const decrypted = encryptionManager.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    test('should generate secure hash', () => {
      const data = 'test data';
      const hash = encryptionManager.generateHash(data);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hex length
    });

    test('should verify hash correctly', () => {
      const data = 'test data';
      const hash = encryptionManager.generateHash(data);
      
      expect(encryptionManager.verifyHash(data, hash)).toBe(true);
      expect(encryptionManager.verifyHash('different data', hash)).toBe(false);
    });

    test('should generate secure tokens', () => {
      const token1 = encryptionManager.generateSecureToken();
      const token2 = encryptionManager.generateSecureToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });
  });

  describe('SettingsManager', () => {
    let settingsManager: SettingsManager;

    beforeEach(() => {
      settingsManager = new SettingsManager();
    });

    test('should load default settings', () => {
      const settings = settingsManager.getSettings();
      
      expect(settings).toBeDefined();
      expect(settings.headlessMode).toBe(false);
      expect(settings.memoryLimit).toBe(500);
      expect(settings.aiServices).toBeDefined();
      expect(settings.aiServices.openai).toBeDefined();
      expect(settings.aiServices.gemini).toBeDefined();
      expect(settings.aiServices.claude).toBeDefined();
    });

    test('should update settings', async () => {
      const newSettings = {
        headlessMode: true,
        memoryLimit: 1000
      };

      await settingsManager.updateSettings(newSettings);
      const settings = settingsManager.getSettings();
      
      expect(settings.headlessMode).toBe(true);
      expect(settings.memoryLimit).toBe(1000);
    });

    test('should update AI service configuration', async () => {
      await settingsManager.updateAIServiceConfig('openai', true);
      const settings = settingsManager.getSettings();
      
      expect(settings.aiServices.openai.isConfigured).toBe(true);
    });

    test('should get window bounds', () => {
      const bounds = settingsManager.getWindowBounds();
      
      expect(bounds).toBeDefined();
      expect(bounds.width).toBeDefined();
      expect(bounds.height).toBeDefined();
    });

    test('should save window bounds', async () => {
      const bounds = { width: 1200, height: 800, x: 100, y: 100 };
      
      await expect(settingsManager.saveWindowBounds(bounds)).resolves.toBeUndefined();
    });

    test('should reset to defaults', async () => {
      // First modify settings
      await settingsManager.updateSettings({ headlessMode: true });
      
      // Then reset
      await settingsManager.resetToDefaults();
      const settings = settingsManager.getSettings();
      
      expect(settings.headlessMode).toBe(false);
    });
  });
});