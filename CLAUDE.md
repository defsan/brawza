# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Brawza is an Electron-based AI-agent browser that integrates multiple AI services (OpenAI, Google Gemini, Anthropic Claude) with browser automation capabilities using Puppeteer. The application features a resizable AI chat sidebar within a Chromium browser for intelligent web interactions.

## Development Commands

### Build & Development
```bash
# Build TypeScript source
npm run build

# Development with auto-reload (uses concurrently with TypeScript watch mode)
npm run dev

# Build and start production version
npm start

# Watch build during development
npm run build:watch
```

### Testing
```bash
# Run all tests (unit + integration)
npm test

# Run unit tests with coverage
npm run test:unit

# Run integration tests (30s timeout)
npm run test:integration

# Run e2e tests (60s timeout)
npm run test:e2e

# Run all tests with coverage
npm run test:all

# Watch mode for development
npm run test:watch

# Build then test
npm run test:build
```

### Packaging
```bash
# Create development package
npm run pack

# Create distribution installer
npm run dist
```

## Architecture

### Main Process (`src/main/`)
- **AI Manager**: Central service coordinator for OpenAI, Gemini, and Claude APIs
- **Automation**: Puppeteer-based browser automation engine
- **Security**: macOS Keychain integration for secure API key storage
- **Monitoring**: Performance monitoring and rate limiting

### Renderer Process (`src/renderer/`)
- Browser UI components and AI chat interface
- Preload scripts with context isolation
- Service workers for background tasks

### Shared (`src/shared/`)
- Type definitions shared between main and renderer processes
- Common interfaces for AI services, settings, and automation results

## Key Technical Details

### AI Service Integration
- All AI services extend `BaseAIService` interface in `src/main/ai/`
- API keys stored securely via `KeychainManager` (macOS Keychain)
- Service validation and initialization handled by `AIManager`
- Rate limiting and performance monitoring built-in

### Browser Architecture
- **WebView Navigation**: Primary browser UI uses Electron's WebView with disabled web security for full compatibility
- **Puppeteer Automation**: Reserved for AI automation tasks (content extraction, screenshots, form filling)
- **Dual System**: WebView handles user navigation, Puppeteer handles AI interactions
- **Security Configuration**: 
  - WebView: Disabled web security and CSP for maximum website compatibility
  - Main App: Secure CSP without unsafe-eval
  - Context isolation disabled in WebView for modern website support
- Event-driven architecture with EventEmitter
- Persistent WebView session for cookies and localStorage

### TypeScript Configuration
- Path aliases: `@main/*`, `@renderer/*`, `@shared/*` map to respective source directories
- ES2020 target with CommonJS modules
- Strict mode enabled with comprehensive type checking

### Testing Setup
- Jest with ts-jest preset
- Coverage collection from `src/**/*.ts` (excludes type files)
- Separate test suites: unit (30s), integration (30s), e2e (60s)
- Setup file at `tests/setup.ts`

## Security Considerations
- Renderer process isolation with context isolation enabled
- HTTPS-only network requests
- No remote module access
- API keys never exposed to renderer process