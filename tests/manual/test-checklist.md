# Manual Testing Checklist for Brawza Phases 1-3

## Phase 1: Project Foundation ✅

### Application Launch
- [ ] App launches without errors
- [ ] Main window appears with correct size (1400x900)
- [ ] Window title shows "Brawza - AI-Agent Browser"
- [ ] DevTools open in development mode
- [ ] No console errors on startup

### UI Elements Presence
- [ ] Navigation header with all controls visible
- [ ] Back button (←) present and clickable
- [ ] Forward button (→) present and clickable  
- [ ] Refresh button (↻) present and clickable
- [ ] URL input field present and functional
- [ ] Go button present and clickable
- [ ] Settings button (⚙️) present and clickable
- [ ] AI sidebar toggle (🤖) present and clickable

## Phase 2: Core Browser Engine ✅

### WebView Integration
- [ ] WebView element loads correctly
- [ ] WebView starts with about:blank
- [ ] WebView security settings applied (no popups, websecurity enabled)

### Navigation Functionality
- [ ] URL bar accepts input
- [ ] Entering URL and clicking Go navigates webview
- [ ] URLs without protocol get https:// prefix automatically
- [ ] Search terms get converted to Google search
- [ ] Back button triggers navigation (shows in console)
- [ ] Forward button triggers navigation (shows in console)
- [ ] Refresh button triggers reload (shows in console)
- [ ] Enter key in URL bar triggers navigation
- [ ] URL bar updates on webview navigation events

### WebView Events
- [ ] Console shows "Webview ready" on load
- [ ] Console shows "Started loading" during navigation
- [ ] Console shows "Finished loading" when complete
- [ ] Console shows "Navigated to: [URL]" on successful navigation
- [ ] Failed loads show error messages in console

## Phase 3: Security & Storage ✅

### Keychain Integration
- [ ] API tokens stored in macOS Keychain successfully
- [ ] Token storage shows success confirmation
- [ ] Token retrieval works from Keychain
- [ ] Multiple services (OpenAI, Gemini, Claude) supported
- [ ] Token validation works correctly
- [ ] Token updates replace existing tokens

### Encrypted Settings
- [ ] Settings saved to encrypted file in user data directory
- [ ] Encryption key generated and stored securely
- [ ] Settings load correctly on app restart
- [ ] Default settings created if none exist
- [ ] Settings merge correctly with updates
- [ ] Console shows "Settings loaded successfully"

### HTTPS Security
- [ ] All API calls enforced to use HTTPS
- [ ] Security headers added to requests
- [ ] Certificate verification enabled for trusted hosts
- [ ] Non-HTTPS API calls blocked with warning

## User Interface Testing

### AI Sidebar
- [ ] Sidebar initially hidden with "hidden" class
- [ ] Clicking robot icon opens sidebar (removes hidden class)
- [ ] Sidebar shows AI Assistant header
- [ ] Service selector shows OpenAI, Gemini, Claude options
- [ ] Chat input field accepts text
- [ ] Send button present and clickable
- [ ] Close button (×) closes sidebar
- [ ] Sidebar reopens correctly after closing

### Settings Modal
- [ ] Settings button opens modal (removes hidden class)
- [ ] Modal shows "Settings" header
- [ ] API key inputs present for all three services
- [ ] Input fields accept password text (hidden characters)
- [ ] Test connection buttons present for each service
- [ ] Headless mode checkbox present and toggleable
- [ ] Memory limit slider present and adjustable
- [ ] Memory value updates as slider moves
- [ ] Save Settings button present and clickable
- [ ] Close button (×) closes modal
- [ ] Modal closes after successful save

## Interaction Testing

### Navigation Interactions
- [ ] Multiple URL navigations work in sequence
- [ ] Invalid URLs handled gracefully (no crashes)
- [ ] Empty URL bar handled correctly
- [ ] Very long URLs handled correctly
- [ ] Special characters in URLs handled correctly

### Sidebar Interactions
- [ ] Rapid sidebar open/close doesn't break functionality
- [ ] Switching AI services works correctly
- [ ] Chat input accepts various message lengths
- [ ] Empty messages handled gracefully
- [ ] Multiline messages work correctly
- [ ] Send button and Enter key both work for sending

### Settings Interactions
- [ ] API key inputs accept various key formats
- [ ] Test connection buttons work with/without valid keys
- [ ] Settings persist after modal close/reopen
- [ ] Performance settings save correctly
- [ ] Reset functionality works if implemented
- [ ] Rapid open/close of settings doesn't cause issues

## Error Handling

### Navigation Errors
- [ ] Invalid URLs don't crash the app
- [ ] Network timeouts handled gracefully
- [ ] WebView errors don't crash main process
- [ ] Navigation to blocked sites handled correctly

### Security Errors
- [ ] Invalid API keys handled gracefully
- [ ] Keychain access errors handled correctly
- [ ] Settings file corruption handled correctly
- [ ] Encryption/decryption errors handled correctly

### UI Errors
- [ ] Missing DOM elements don't cause crashes
- [ ] Rapid clicking doesn't cause issues
- [ ] Keyboard shortcuts work correctly
- [ ] Window resize doesn't break layout

## Performance Testing

### Memory Usage
- [ ] App starts with reasonable memory usage (<200MB)
- [ ] Memory doesn't leak with repeated navigation
- [ ] Multiple webview loads don't accumulate memory
- [ ] Settings operations don't cause memory spikes

### Responsiveness
- [ ] UI remains responsive during navigation
- [ ] Settings modal opens/closes smoothly
- [ ] Sidebar animations are smooth
- [ ] No UI freezing during operations

### Startup Time
- [ ] App launches in reasonable time (<3 seconds)
- [ ] First navigation loads promptly
- [ ] Settings load quickly from encrypted storage

## Security Validation

### Token Storage
- [ ] API tokens not visible in plain text logs
- [ ] Keychain entries created with correct service name
- [ ] Tokens accessible only to Brawza app
- [ ] Token deletion works correctly

### Settings Encryption
- [ ] Settings file is encrypted (not readable as plain text)
- [ ] Encryption key stored securely
- [ ] Settings file permissions correct (user only)
- [ ] No sensitive data in logs

### Network Security
- [ ] Only HTTPS requests allowed for APIs
- [ ] Certificate errors properly handled
- [ ] No sensitive data in network logs
- [ ] User-Agent headers set correctly

## Integration Testing

### Combined Workflows
- [ ] Navigate → Open Sidebar → Send Message → Close Sidebar
- [ ] Open Settings → Configure API Key → Test Connection → Save
- [ ] Navigate → Configure Settings → Navigate Again → Verify Settings Persist
- [ ] Multiple rapid interactions don't cause conflicts

### State Persistence
- [ ] Window size/position saved and restored
- [ ] AI service selection remembered
- [ ] Settings persist across app restarts
- [ ] Navigation state handled correctly

## Console Output Validation

### Expected Log Messages
- [ ] "New encryption key generated and saved" OR "Encryption key loaded"
- [ ] "Settings loaded successfully" OR "Default settings created"
- [ ] "Navigate to: [URL]" for navigation attempts
- [ ] "Webview ready" when webview initializes
- [ ] "Token stored for [service]" when saving API keys
- [ ] No error messages in normal operation

### Error Scenarios
- [ ] Clear error messages for invalid operations
- [ ] No stack traces for expected errors
- [ ] Helpful debugging information in console
- [ ] No sensitive information logged

---

## Testing Notes

**Environment**: macOS (primary target)
**Test Data**: Use test API keys, not real ones
**Duration**: Allow adequate time for each test
**Documentation**: Note any issues or unexpected behavior

**Pass Criteria**: All checkboxes checked with no blocking issues found.