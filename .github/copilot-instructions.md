# ECHO CORP Plug-N-Dump - AI Coding Agent Instructions

## Project Overview
This is a specialized Electron-based tool for extracting flight data from Betaflight flight controllers via serial communication. The app operates in multiple modes: standalone, embedded within parent applications, and silent/headless.

## Architecture & Key Components

### Core Data Flow
1. **Serial Detection**: Continuously scans for STM32-based flight controllers (vendorId: `0483`)
2. **CLI Extraction**: Connects via serial, enters CLI mode, extracts `dump` configuration
3. **MSC Mode**: Transitions to Mass Storage Controller mode to access blackbox files
4. **File Operations**: Copies `.BBL`/`.BHL` files (requires manual USB reconnection to exit MSC mode)

### Critical Files
- `main.js` - Main process with serial communication and file operations
- `renderer.js` - UI process with real-time status updates  
- `preload.js` - Secure IPC bridge using contextBridge pattern
- `EMBEDDING.md` - Complete embedding API documentation

## Development Conventions

### Message Security Pattern
The app implements an **ultra-strict whitelist** for progress messages in `sendProgress()`:
```javascript
// Only whitelisted messages are displayed - NO exceptions
const allowedMessages = ['🚀 INITIATING...', '✅ CONNECTION ESTABLISHED!', ...];
```
When adding new progress messages, they MUST be added to both the allowedMessages array AND dynamic pattern regex.

### Serial Communication Workflow
Standard extraction sequence:
1. `#\r` - Enter CLI mode
2. `dump\r` - Extract configuration
3. Reconnect and `msc\r` - Enter mass storage mode
4. File copying (manual USB reconnection required to exit MSC mode)

### Build System
- `npm run build-win` - NSIS installer with admin privileges
- `npm run build-portable` - Portable executable
- `build.bat` - Creates distribution packages + embeddable module
- Uses `electron-builder` with specific Windows configurations

### Embedding Architecture
The app supports 3 operational modes via command-line args:
- `--embedded` - Runs without window decorations for parent app integration
- `--silent` - Headless mode with IPC communication only
- `--auto-extract COM3` - Automated extraction from specified port

## Styling & UI Patterns

### Corporate Cyberpunk Theme
- Uses `style_new.css` with cyan/purple gradient accents
- Spec cards have dynamic accent colors via CSS custom properties
- Card hover effects include glow and transform animations
- Progress messages use emoji prefixes for visual hierarchy

### Component Structure
- Spec cards show firmware/board/pilot/status with connection indicators
- Progress log is a monospace terminal-style display
- Button states change during operations (EXTRACTING... → COMPLETE)

## Key Development Commands

```bash
# Development with hot reload
npm run dev

# Production builds
npm run build        # All formats
npm run build-win    # NSIS installer only
npm run build-portable # Portable exe only

# Complete distribution build
build.bat
```

## Integration Points

### Parent App Communication
When embedded, uses Node.js `process.send()` for IPC:
```javascript
// Send data to parent application
process.send({
  type: 'plug-n-dump-data', 
  data: extractionResults
});
```

### File System Conventions
- Output: `%USERPROFILE%\Documents\Echo Corp FPV Nexus\BBL Logs\{timestamp}\`
- Folder naming: `MM-DD-YY H-MM AM/PM` format
- Files: `dump.txt` + copied `.BBL`/`.BHL` blackbox logs

## Hardware-Specific Logic

### Flight Controller Detection
Only connects to devices with vendorId `0483` (STMicroelectronics). Flight controllers remain in MSC mode until manually disconnected and reconnected via USB.

### Cross-Platform Considerations
Windows-specific implementations for:
- Drive detection and volume label checking
- File system operations on MSC-mounted drives
- Registry-based installation detection

## Security & Error Handling
- All user input is sanitized through whitelist patterns
- Serial port operations include comprehensive error handling
- File operations use sync methods with try-catch wrapping
- No raw data logging for security compliance