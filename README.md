# Brawza - AI-Agent Browser

An intelligent browser built on Electron with integrated AI agents for automated web interactions.

## Features

- **Multi-AI Integration**: Support for OpenAI ChatGPT, Google Gemini, and Anthropic Claude
- **Browser Automation**: Puppeteer-powered automation for seamless web interactions
- **Secure Credentials**: macOS Keychain integration for secure API token storage
- **Resizable Sidebar**: Real-time AI chat interface within the browser
- **Performance Optimized**: Stripped-down Chromium build for minimal resource usage

## Development

### Prerequisites

- Node.js 18+ 
- macOS (for initial development)
- Valid API keys for AI services

### Installation

```bash
git clone https://github.com/defsan/brawza.git
cd brawza
npm install
```

### Development Commands

```bash
# Build the application
npm run build

# Start in development mode with auto-reload
npm run dev

# Build and start production version
npm start

# Package for distribution
npm run pack

# Create installer
npm run dist
```

### Project Structure

```
brawza/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # Browser UI and logic
│   └── shared/         # Shared types and constants
├── assets/             # Static resources
├── build/              # Build configuration
└── dist/               # Compiled output
```

## Configuration

1. Launch the application
2. Click the settings button (⚙️)
3. Enter your API keys for the AI services you want to use
4. Configure performance settings as needed

## Usage

1. Navigate to any website using the address bar
2. Click the AI sidebar toggle (🤖) to open the chat interface
3. Select your preferred AI service from the dropdown
4. Ask questions about the current page or request automated actions
5. The AI can analyze content, click elements, fill forms, and navigate

## Security

- API keys are stored securely in macOS Keychain
- All network requests use HTTPS
- Renderer process runs in isolation with context isolation enabled
- No remote module access for enhanced security

## License

ISC