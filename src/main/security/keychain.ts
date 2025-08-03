import * as keytar from 'keytar';

export class KeychainManager {
  private readonly serviceName = 'com.brawza.browser';

  /**
   * Store an API token securely in macOS Keychain
   */
  async storeToken(service: string, token: string): Promise<void> {
    try {
      const account = `${service}-api-token`;
      await keytar.setPassword(this.serviceName, account, token);
      console.log(`Token stored for ${service}`);
    } catch (error) {
      console.error(`Failed to store token for ${service}:`, error);
      throw new Error(`Failed to store token for ${service}`);
    }
  }

  /**
   * Retrieve an API token from macOS Keychain
   */
  async getToken(service: string): Promise<string | null> {
    try {
      const account = `${service}-api-token`;
      const token = await keytar.getPassword(this.serviceName, account);
      
      if (token) {
        console.log(`Token retrieved for ${service}`);
        return token;
      } else {
        console.log(`No token found for ${service}`);
        return null;
      }
    } catch (error) {
      console.error(`Failed to retrieve token for ${service}:`, error);
      throw new Error(`Failed to retrieve token for ${service}`);
    }
  }

  /**
   * Delete an API token from macOS Keychain
   */
  async deleteToken(service: string): Promise<boolean> {
    try {
      const account = `${service}-api-token`;
      const deleted = await keytar.deletePassword(this.serviceName, account);
      
      if (deleted) {
        console.log(`Token deleted for ${service}`);
      } else {
        console.log(`No token found to delete for ${service}`);
      }
      
      return deleted;
    } catch (error) {
      console.error(`Failed to delete token for ${service}:`, error);
      throw new Error(`Failed to delete token for ${service}`);
    }
  }

  /**
   * List all stored services
   */
  async listStoredServices(): Promise<string[]> {
    try {
      const credentials = await keytar.findCredentials(this.serviceName);
      const services = credentials
        .map(cred => cred.account.replace('-api-token', ''))
        .filter(service => service.endsWith('-api-token') === false);
      
      console.log('Stored services:', services);
      return services;
    } catch (error) {
      console.error('Failed to list stored services:', error);
      return [];
    }
  }

  /**
   * Validate that a token exists and is not empty
   */
  async validateToken(service: string): Promise<boolean> {
    try {
      const token = await this.getToken(service);
      return token !== null && token.trim().length > 0;
    } catch (error) {
      console.error(`Failed to validate token for ${service}:`, error);
      return false;
    }
  }

  /**
   * Update an existing token (delete old, store new)
   */
  async updateToken(service: string, newToken: string): Promise<void> {
    try {
      // Delete existing token if it exists
      await this.deleteToken(service);
      
      // Store the new token
      await this.storeToken(service, newToken);
      
      console.log(`Token updated for ${service}`);
    } catch (error) {
      console.error(`Failed to update token for ${service}:`, error);
      throw new Error(`Failed to update token for ${service}`);
    }
  }
}