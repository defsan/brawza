// Browser automation tools schema for AI function calling

export interface BrowserTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface BrowserToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface BrowserToolResult {
  success: boolean;
  data?: any;
  error?: string;
  screenshot?: Buffer;
  message?: string;
}

// Browser action tools available to AI agents
export const BROWSER_TOOLS: BrowserTool[] = [
  {
    name: 'navigate',
    description: 'Navigate to a specific URL',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to navigate to (must include protocol like https://)'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'click',
    description: 'Click on an element on the page',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the element to click (e.g., "#button-id", ".class-name", "button[text=\'Submit\']")'
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what element you\'re clicking'
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'type',
    description: 'Type text into an input field',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the input field'
        },
        text: {
          type: 'string',
          description: 'Text to type into the field'
        },
        clear: {
          type: 'boolean',
          description: 'Whether to clear the field before typing (default: true)'
        }
      },
      required: ['selector', 'text']
    }
  },
  {
    name: 'scroll',
    description: 'Scroll the page in a specific direction',
    parameters: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['up', 'down', 'left', 'right'],
          description: 'Direction to scroll'
        },
        amount: {
          type: 'number',
          description: 'Amount to scroll in pixels (default: 500)'
        }
      },
      required: ['direction']
    }
  },
  {
    name: 'screenshot',
    description: 'Take a screenshot of the current page',
    parameters: {
      type: 'object',
      properties: {
        fullPage: {
          type: 'boolean',
          description: 'Whether to capture the full page or just the visible area (default: false)'
        }
      },
      required: []
    }
  },
  {
    name: 'extract_text',
    description: 'Extract text content from specific elements or the entire page',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for specific elements (optional - if not provided, extracts all text)'
        }
      },
      required: []
    }
  },
  {
    name: 'extract_links',
    description: 'Extract all links from the current page',
    parameters: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'Optional filter to match link text or href (case-insensitive)'
        }
      },
      required: []
    }
  },
  {
    name: 'wait_for_element',
    description: 'Wait for an element to appear on the page',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the element to wait for'
        },
        timeout: {
          type: 'number',
          description: 'Maximum time to wait in milliseconds (default: 5000)'
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_page_info',
    description: 'Get basic information about the current page',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'fill_form',
    description: 'Fill multiple form fields at once',
    parameters: {
      type: 'object',
      properties: {
        fields: {
          type: 'object',
          description: 'Object mapping CSS selectors to values to fill',
          additionalProperties: {
            type: 'string'
          }
        }
      },
      required: ['fields']
    }
  },
  {
    name: 'evaluate_script',
    description: 'Execute custom JavaScript code on the page',
    parameters: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: 'JavaScript code to execute'
        }
      },
      required: ['script']
    }
  }
];

// Get tool definition for specific AI service formats
export function getToolsForOpenAI(): any[] {
  return BROWSER_TOOLS.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

export function getToolsForClaude(): any[] {
  return BROWSER_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
  }));
}

export function getToolsForGemini(): any[] {
  return BROWSER_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
}

// Tool execution safety levels
export enum ToolSafetyLevel {
  SAFE = 'safe',         // Auto-execute (navigate, screenshot, extract_text, etc.)
  MODERATE = 'moderate', // Ask confirmation (click, type, scroll)
  DANGEROUS = 'dangerous' // Require explicit approval (evaluate_script, form submissions)
}

export const TOOL_SAFETY_LEVELS: Record<string, ToolSafetyLevel> = {
  navigate: ToolSafetyLevel.SAFE,
  screenshot: ToolSafetyLevel.SAFE,
  extract_text: ToolSafetyLevel.SAFE,
  extract_links: ToolSafetyLevel.SAFE,
  get_page_info: ToolSafetyLevel.SAFE,
  wait_for_element: ToolSafetyLevel.SAFE,
  
  click: ToolSafetyLevel.MODERATE,
  type: ToolSafetyLevel.MODERATE,
  scroll: ToolSafetyLevel.MODERATE,
  
  fill_form: ToolSafetyLevel.DANGEROUS,
  evaluate_script: ToolSafetyLevel.DANGEROUS
};