import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { BrawzaSettings } from '../../shared/types';
import { EncryptionManager } from './encryption';

export class SettingsManager {
  private readonly settingsPath: string;
  private readonly encryptionManager: EncryptionManager;
  private settings: BrawzaSettings | null = null;

  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'brawza-settings.json');
    this.encryptionManager = new EncryptionManager();
    this.loadSettings();
  }

  /**
   * Load settings from disk
   */
  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const encryptedData = fs.readFileSync(this.settingsPath, 'utf8');
        const decryptedData = this.encryptionManager.decrypt(encryptedData);
        this.settings = JSON.parse(decryptedData);
        console.log('Settings loaded successfully');
      } else {
        // Create default settings
        this.settings = this.getDefaultSettings();
        this.saveSettings();
        console.log('Default settings created');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = this.getDefaultSettings();
    }
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(): BrawzaSettings {
    return {
      headlessMode: false,
      memoryLimit: 500,
      aiServices: {
        openai: {
          name: 'openai',
          displayName: 'OpenAI ChatGPT',
          isConfigured: false
        },
        gemini: {
          name: 'gemini',
          displayName: 'Google Gemini',
          isConfigured: false
        },
        claude: {
          name: 'claude',
          displayName: 'Anthropic Claude',
          isConfigured: false
        }
      },
      windowBounds: {
        width: 1400,
        height: 900
      },
      sidebarWidth: 400
    };
  }

  /**
   * Save settings to disk (encrypted)
   */
  async saveSettings(): Promise<void> {
    try {
      if (!this.settings) {
        throw new Error('No settings to save');
      }

      const jsonData = JSON.stringify(this.settings, null, 2);
      const encryptedData = this.encryptionManager.encrypt(jsonData);
      
      // Write atomically using temp file
      const tempPath = this.settingsPath + '.tmp';
      fs.writeFileSync(tempPath, encryptedData, 'utf8');
      fs.renameSync(tempPath, this.settingsPath);
      
      console.log('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  /**
   * Get all settings
   */
  getSettings(): BrawzaSettings {
    return this.settings ? { ...this.settings } : this.getDefaultSettings();
  }

  /**
   * Update settings
   */
  async updateSettings(newSettings: Partial<BrawzaSettings>): Promise<void> {
    try {
      if (!this.settings) {
        this.settings = this.getDefaultSettings();
      }

      // Merge with existing settings
      this.settings = {
        ...this.settings,
        ...newSettings
      };

      await this.saveSettings();
      console.log('Settings updated successfully');
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw new Error('Failed to update settings');
    }
  }

  /**
   * Update AI service configuration
   */
  async updateAIServiceConfig(serviceName: string, isConfigured: boolean): Promise<void> {
    try {
      if (!this.settings) {
        this.settings = this.getDefaultSettings();
      }

      if (this.settings.aiServices[serviceName as keyof typeof this.settings.aiServices]) {
        this.settings.aiServices[serviceName as keyof typeof this.settings.aiServices].isConfigured = isConfigured;
        await this.saveSettings();
        console.log(`AI service ${serviceName} configuration updated`);
      }
    } catch (error) {
      console.error(`Failed to update AI service ${serviceName}:`, error);
      throw new Error(`Failed to update AI service ${serviceName}`);
    }
  }

  /**
   * Get window bounds for restoring window position
   */
  getWindowBounds(): { width: number; height: number; x?: number; y?: number } {
    return this.settings?.windowBounds || { width: 1400, height: 900 };
  }

  /**
   * Save window bounds
   */
  async saveWindowBounds(bounds: { width: number; height: number; x?: number; y?: number }): Promise<void> {
    try {
      await this.updateSettings({ windowBounds: bounds });
    } catch (error) {
      console.error('Failed to save window bounds:', error);
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    try {
      this.settings = this.getDefaultSettings();
      await this.saveSettings();
      console.log('Settings reset to defaults');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      throw new Error('Failed to reset settings');
    }
  }
}