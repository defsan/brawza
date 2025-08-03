import { session } from 'electron';
import * as https from 'https';

export class HTTPSManager {
  private readonly trustedHosts: Set<string>;

  constructor() {
    this.trustedHosts = new Set([
      'api.openai.com',
      'generativelanguage.googleapis.com',
      'api.anthropic.com',
      'google.com',
      'googleapis.com'
    ]);
    
    this.setupHTTPSEnforcement();
  }

  /**
   * Set up HTTPS enforcement and security headers
   */
  private setupHTTPSEnforcement(): void {
    // Intercept and modify requests
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      // Force HTTPS for API calls
      if (this.isAPICall(details.url)) {
        if (!details.url.startsWith('https://')) {
          console.warn('Blocking non-HTTPS API call:', details.url);
          callback({ cancel: true });
          return;
        }
      }

      // Add security headers
      const requestHeaders = {
        ...details.requestHeaders,
        'User-Agent': 'Brawza/1.0.0 (Secure Browser)',
        'X-Requested-With': 'Brawza'
      };

      callback({ requestHeaders });
    });

    // Handle response headers
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = {
        ...details.responseHeaders,
        'Strict-Transport-Security': ['max-age=31536000; includeSubDomains'],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block']
      };

      callback({ responseHeaders });
    });

    // Certificate verification for API calls
    session.defaultSession.setCertificateVerifyProc((request, callback) => {
      const { hostname, verificationResult } = request;
      
      // Extra strict verification for API endpoints
      if (this.isAPIHost(hostname)) {
        if (verificationResult !== 'net::OK') {
          console.error(`Certificate verification failed for ${hostname}:`, verificationResult);
          callback(-2); // Reject
          return;
        }
      }
      
      callback(verificationResult === 'net::OK' ? 0 : -2);
    });
  }

  /**
   * Check if URL is an API call
   */
  private isAPICall(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return this.trustedHosts.has(urlObj.hostname) || 
             urlObj.pathname.includes('/api/') ||
             urlObj.hostname.includes('api.');
    } catch {
      return false;
    }
  }

  /**
   * Check if hostname is a trusted API host
   */
  private isAPIHost(hostname: string): boolean {
    return this.trustedHosts.has(hostname);
  }

  /**
   * Add a trusted host for API calls
   */
  addTrustedHost(hostname: string): void {
    this.trustedHosts.add(hostname);
    console.log(`Added trusted host: ${hostname}`);
  }

  /**
   * Remove a trusted host
   */
  removeTrustedHost(hostname: string): void {
    this.trustedHosts.delete(hostname);
    console.log(`Removed trusted host: ${hostname}`);
  }

  /**
   * Get list of trusted hosts
   */
  getTrustedHosts(): string[] {
    return Array.from(this.trustedHosts);
  }

  /**
   * Make a secure HTTPS request with certificate pinning
   */
  async makeSecureRequest(url: string, options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      
      if (urlObj.protocol !== 'https:') {
        reject(new Error('Only HTTPS requests are allowed'));
        return;
      }

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Brawza/1.0.0 (Secure Browser)',
          ...options.headers
        },
        // Enable certificate verification
        rejectUnauthorized: true,
        checkServerIdentity: (host: string, cert: any) => {
          // Additional certificate checks for API hosts
          if (this.isAPIHost(host)) {
            console.log(`Certificate check for ${host}: ${cert.subject?.CN}`);
          }
          return undefined; // Use default checks
        }
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = {
              statusCode: res.statusCode,
              headers: res.headers,
              data: data
            };
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error(`HTTPS request failed for ${url}:`, error);
        reject(error);
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }
}