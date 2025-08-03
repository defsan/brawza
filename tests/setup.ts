// Test setup file
import { Application } from 'spectron';
import * as path from 'path';

// Global test configuration
jest.setTimeout(30000);

// Helper to create Electron app instance for testing
export const createApp = (): Application => {
  return new Application({
    path: path.join(__dirname, '../node_modules/.bin/electron'),
    args: [path.join(__dirname, '../dist/main/index.js')],
    startTimeout: 20000,
    waitTimeout: 20000,
    env: {
      NODE_ENV: 'test'
    }
  });
};

// Clean up function
export const cleanupApp = async (app: Application): Promise<void> => {
  if (app && app.isRunning()) {
    await app.stop();
  }
};