// Shared types between main and renderer processes

export interface AIService {
  name: string;
  displayName: string;
  apiKey?: string;
  isConfigured: boolean;
}

export interface BrawzaSettings {
  headlessMode: boolean;
  memoryLimit: number;
  aiServices: {
    openai: AIService;
    gemini: AIService;
    claude: AIService;
  };
  windowBounds?: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  sidebarWidth: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: number;
  service?: string;
}

export interface AutomationResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  quality?: number;
  format?: 'png' | 'jpeg';
}

export interface HTMLParseResult {
  title: string;
  url: string;
  content: string;
  links: Array<{
    text: string;
    href: string;
  }>;
  forms: Array<{
    action: string;
    method: string;
    inputs: Array<{
      name: string;
      type: string;
      value?: string;
    }>;
  }>;
}

export interface NavigationState {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}

// IPC Channel names for type safety
export const IPC_CHANNELS = {
  // Browser controls
  BROWSER_NAVIGATE: 'browser:navigate',
  BROWSER_BACK: 'browser:back',
  BROWSER_FORWARD: 'browser:forward',
  BROWSER_REFRESH: 'browser:refresh',
  NAVIGATION_CHANGED: 'navigation:changed',

  // AI services
  AI_SEND_MESSAGE: 'ai:send-message',
  AI_RESPONSE: 'ai:response',

  // Settings
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_LOAD: 'settings:load',

  // Automation
  AUTOMATION_SCREENSHOT: 'automation:screenshot',
  AUTOMATION_PARSE_HTML: 'automation:parse-html',
  AUTOMATION_CLICK: 'automation:click',

  // Security
  SECURITY_STORE_TOKEN: 'security:store-token',
  SECURITY_GET_TOKEN: 'security:get-token',
} as const;

export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];