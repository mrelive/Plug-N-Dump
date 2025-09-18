# ECHO CORP Plug-N-Dump - Embedding Integration Guide

## Overview
This application can be used both as a standalone tool and as an embedded component within other Electron applications.

## Standalone Installation

### Silent Installation
```bash
# Basic silent install
"ECHO CORP Plug-N-Dump-Setup-1.0.0.exe" /S

# Silent install with custom directory
"ECHO CORP Plug-N-Dump-Setup-1.0.0.exe" /S /D=C:\MyApps\PlugNDump

# Silent install without auto-run (for embedding)
"ECHO CORP Plug-N-Dump-Setup-1.0.0.exe" /S /NORUN
```

### Command Line Usage
```bash
# Run in embedded mode
plug-n-dump.exe --embedded

# Run in silent mode (headless)
plug-n-dump.exe --silent

# Auto-extract from specific port
plug-n-dump.exe --auto-extract COM3

# Custom output directory
plug-n-dump.exe --output-dir "C:\MyBackups"

# Combined options
plug-n-dump.exe --embedded --auto-extract COM3 --output-dir "C:\MyBackups"
```

## Embedding in Another Electron App

### 1. Installation Detection
```javascript
const { spawn } = require('child_process');
const path = require('path');

// Check if Plug-N-Dump is installed
function isPlugNDumpInstalled() {
  try {
    const { execSync } = require('child_process');
    const result = execSync('reg query "HKLM\\SOFTWARE\\ECHO CORP\\Plug-N-Dump" /v InstallPath', 
                           { encoding: 'utf8' });
    return result.includes('InstallPath');
  } catch (error) {
    return false;
  }
}
```

### 2. Silent Installation from Your App
```javascript
async function installPlugNDump() {
  return new Promise((resolve, reject) => {
    const installer = spawn('ECHO CORP Plug-N-Dump-Setup-1.0.0.exe', ['/S', '/NORUN'], {
      detached: false,
      stdio: 'pipe'
    });
    
    installer.on('close', (code) => {
      if (code === 0) {
        resolve('Installation successful');
      } else {
        reject(new Error(`Installation failed with code ${code}`));
      }
    });
  });
}
```

### 3. Launching Embedded Instance
```javascript
const { spawn } = require('child_process');

function launchPlugNDump(options = {}) {
  const args = ['--embedded'];
  
  if (options.autoExtract) {
    args.push('--auto-extract', options.autoExtract);
  }
  
  if (options.outputDir) {
    args.push('--output-dir', options.outputDir);
  }
  
  const plugNDump = spawn('plug-n-dump.exe', args, {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  });
  
  // Listen for data from Plug-N-Dump
  plugNDump.on('message', (message) => {
    if (message.type === 'plug-n-dump-data') {
      console.log('Received data:', message.data);
      // Handle extraction results
    }
  });
  
  return plugNDump;
}
```

### 4. Communication API
```javascript
// Send extraction request
plugNDumpProcess.send({
  type: 'extract-request',
  data: {
    port: 'COM3',
    outputDir: 'C:\\MyBackups'
  }
});

// Request status
plugNDumpProcess.send({
  type: 'get-status'
});

// Listen for responses
plugNDumpProcess.on('message', (message) => {
  switch (message.type) {
    case 'status-response':
      console.log('Status:', message.data);
      break;
    case 'plug-n-dump-data':
      console.log('Extraction result:', message.data);
      break;
  }
});
```

## Embedding as BrowserWindow Child

```javascript
const { BrowserWindow } = require('electron');

function createEmbeddedPlugNDump(parentWindow) {
  const plugNDumpWindow = new BrowserWindow({
    width: 600,
    height: 500,
    parent: parentWindow,
    modal: false,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  // Load Plug-N-Dump with embedded flag
  const plugNDumpPath = getPlugNDumpInstallPath();
  const { spawn } = require('child_process');
  
  spawn('plug-n-dump.exe', ['--embedded', '--parent-window', parentWindow.id.toString()]);
  
  return plugNDumpWindow;
}
```

## Registry Keys
The installer creates these registry entries for detection:

```
HKLM\SOFTWARE\ECHO CORP\Plug-N-Dump\
  - InstallPath: Installation directory
  - Version: Current version
  - EmbeddingSupport: "true"
```

## File Locations
- **Executable**: `%ProgramFiles%\ECHO CORP\Plug-N-Dump\plug-n-dump.exe`
- **Data**: `%APPDATA%\ECHO CORP\Plug-N-Dump\`
- **Logs**: `%USERPROFILE%\Desktop\ECHO-CORP-EXTRACTIONS\`

## Exit Codes
- `0`: Success
- `1`: General error
- `2`: Port not found
- `3`: Extraction failed
- `4`: MSC mode failed