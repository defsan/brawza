import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export class EncryptionManager {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16;  // 128 bits
  private readonly tagLength = 16; // 128 bits
  private encryptionKey: Buffer | null = null;

  constructor() {
    this.initializeEncryptionKey();
  }

  /**
   * Initialize or load the encryption key
   */
  private async initializeEncryptionKey(): Promise<void> {
    const keyPath = path.join(app.getPath('userData'), '.brawza-key');
    
    try {
      if (fs.existsSync(keyPath)) {
        // Load existing key
        this.encryptionKey = fs.readFileSync(keyPath);
        console.log('Encryption key loaded');
      } else {
        // Generate new key
        this.encryptionKey = crypto.randomBytes(this.keyLength);
        
        // Save key securely (readable only by user)
        fs.writeFileSync(keyPath, this.encryptionKey, { mode: 0o600 });
        console.log('New encryption key generated and saved');
      }
    } catch (error) {
      console.error('Failed to initialize encryption key:', error);
      throw new Error('Failed to initialize encryption');
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();
      
      // Combine iv + tag + encrypted data
      const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
      return combined.toString('base64');
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const iv = combined.subarray(0, this.ivLength);
      const tag = combined.subarray(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.subarray(this.ivLength + this.tagLength);

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate a secure hash for data integrity verification
   */
  generateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify data integrity using hash
   */
  verifyHash(data: string, hash: string): boolean {
    const computedHash = this.generateHash(data);
    return computedHash === hash;
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}