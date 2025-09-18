const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, screen } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const fs = require('fs');
const fsp = fs.promises;
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { spawn, exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Disable GPU acceleration for better reliability
app.disableHardwareAcceleration();

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('embedded', {
    type: 'boolean',
    default: false,
    description: 'Run in embedded mode (no window decorations, optimized for parent app)'
  })
  .option('silent', {
    type: 'boolean', 
    default: false,
    description: 'Run in silent mode (headless, no UI)'
  })
  .option('parent-window', {
    type: 'string',
    description: 'Parent window handle for embedding'
  })
  .option('auto-extract', {
    type: 'string',
    description: 'Automatically extract from specified COM port'
  })
  .option('output-dir', {
    type: 'string',
    description: 'Custom output directory for extracted files'
  })
  .argv;

// Global app configuration
const appConfig = {
  isEmbedded: argv.embedded || !!argv.parentWindow,
  isSilent: argv.silent,
  parentWindow: argv.parentWindow,
  autoExtractPort: argv.autoExtract,
  customOutputDir: argv.outputDir,
  isStandalone: !argv.embedded && !argv.parentWindow
};

// Single declaration of mainWindow to satisfy TS/JS linters
let mainWindow = null;

// Helper function to send structured progress data
function sendProgress(step, status, message = null, data = {}) {
  const payload = { step, status, message, data };
  
  // Send to frontend if window exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-progress', payload);
  }
  
  // Send to parent process if embedded
  if (appConfig.isEmbedded && process.send) {
    process.send({
      type: 'plug-n-dump-progress',
      data: payload
    });
  }
  
  // Log for debugging
  console.log(`[Progress] Step: ${step}, Status: ${status}, Message: ${message}`);
}

// Hot reload for development
if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (e) {
    console.log('electron-reload not found, install it for hot reload');
  }
}

let tray = null;

// Global state for auto-extraction and log clearing workflow
let autoExtractionState = {
  wasAutoExtracted: false,
  awaitingLogClear: false,
  lastExtractedPort: null,
  cancelled: false
};

// Function to handle post auto-extraction log clearing prompt
async function handlePostExtractionPrompt(portPath) {
  if (!autoExtractionState.wasAutoExtracted) return;
  
  try {
    // Send custom dialog request to renderer
    const response = await new Promise((resolve) => {
      mainWindow.webContents.send('show-custom-dialog', {
        type: 'question',
        title: 'Clear Blackbox Logs?',
        message: 'Auto-extraction completed successfully!',
        detail: 'Would you like to clear the blackbox logs from your flight controller? This will require unplugging and reconnecting your FC.',
        buttons: ['Yes, Clear Logs', 'No, Keep Logs']
      });
      
      // Listen for dialog response
      ipcMain.once('custom-dialog-response', (event, result) => {
        resolve({ response: result });
      });
    });
    
    if (response.response === 0) { // User chose "Yes, Clear Logs"
      autoExtractionState.awaitingLogClear = true;
      autoExtractionState.lastExtractedPort = portPath;
      
      // Show instruction dialog
      await new Promise((resolve) => {
        mainWindow.webContents.send('show-custom-dialog', {
          type: 'info',
          title: 'Unplug Your Flight Controller',
          message: 'Please unplug your flight controller now',
          detail: 'Unplug your flight controller\'s USB cable, wait 2 seconds, then plug it back in. The app will automatically detect the reconnection and clear the logs.',
          buttons: ['OK, I understand']
        });
        
        ipcMain.once('custom-dialog-response', () => {
          resolve();
        });
      });
      
      // Send message to renderer to show waiting state
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('waiting-for-replug');
      }
      
      // No notification - silent operation
    }
    
    // Reset auto-extraction state
    autoExtractionState.wasAutoExtracted = false;
  } catch (error) {
    console.error('Error showing post-extraction prompt:', error);
  }
}

// Copy blackbox files from MSC mode
// Note: Flight controller will remain in MSC mode until physically unplugged and reconnected.
async function copyBlackboxFiles(folderName) {
  sendProgress('msc', 'active', 'Scanning for BETAFLT drive...');
  
  const possibleDrives = ['D:', 'E:', 'F:', 'G:', 'H:', 'I:', 'J:', 'K:', 'L:'];
  
  for (const drive of possibleDrives) {
    try {
      await fsp.access(drive + '\\');
      
      try {
        const { stdout } = await execAsync(`vol ${drive}`, { timeout: 1000 });
        
        if (stdout.includes('BETAFLT')) {
          console.log(`Found BETAFLT drive at ${drive}`);
          sendProgress('msc', 'completed', `BETAFLT drive detected at ${drive}`);
          sendProgress('copy', 'active', 'Analyzing drive contents...');
          
          try {
            const searchPaths = [
              drive + '\\',
              path.join(drive, 'LOGS'),
              path.join(drive, 'logs'),
              path.join(drive, 'LOG'),
              path.join(drive, 'BLACKBOX'),
              path.join(drive, 'blackbox')
            ];
            
            let allFiles = [];
            let foundPath = '';
            
            for (const searchPath of searchPaths) {
              try {
                await fsp.access(searchPath);
                const pathContents = await fsp.readdir(searchPath);
                const blackboxFiles = pathContents.filter(file => 
                  /\.bbl$|\.bhl$/i.test(file)
                );
                
                if (blackboxFiles.length > 0) {
                  allFiles = blackboxFiles.map(file => ({ file, path: searchPath }));
                  foundPath = searchPath;
                  break;
                }
              } catch (readError) {
                // Path doesn't exist or is not readable, continue
              }
            }
            
            if (allFiles.length > 0) {
              sendProgress('copy', 'active', `Found ${allFiles.length} blackbox files`, { fileCount: allFiles.length });
              
              const baseBackupDir = appConfig.customOutputDir || path.join(app.getPath('documents'), 'Echo Corp FPV Nexus', 'BBL Logs');
              const backupDir = path.join(baseBackupDir, folderName);
              await fsp.mkdir(backupDir, { recursive: true });
              
              sendProgress('copy', 'active', `Backup directory created: ${folderName}`);
              
              let copiedCount = 0;
              for (const fileInfo of allFiles) {
                const srcPath = path.join(fileInfo.path, fileInfo.file);
                const destPath = path.join(backupDir, fileInfo.file);
                await fsp.copyFile(srcPath, destPath);
                copiedCount++;
                sendProgress('copy', 'active', `Copied: ${fileInfo.file}`, { copied: copiedCount, total: allFiles.length });
              }
              
              sendProgress('copy', 'completed', `Successfully backed up ${copiedCount} files.`);
              sendProgress('complete', 'completed', 'Extraction complete. Unplug USB to exit MSC mode.', { backupPath: backupDir });
              
              // Trigger post-extraction prompt if this was an auto-extraction
              if (autoExtractionState.wasAutoExtracted) {
                setTimeout(() => {
                  handlePostExtractionPrompt(autoExtractionState.lastExtractedPort);
                }, 2000); // Small delay to let user see completion message
              }
              
              return;
            } else {
              sendProgress('msc', 'error', 'BETAFLT drive found but no blackbox files');
              return;
            }
          } catch (driveReadError) {
            sendProgress('msc', 'error', 'Could not access BETAFLT drive contents');
            return;
          }
        }
      } catch (volError) {
        // vol command failed, continue
      }
    } catch (error) {
      // Drive not accessible, continue
    }
  }
  
  sendProgress('msc', 'error', 'No blackbox files found - check MSC mode');
}

function createWindow () {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Configure window options based on app mode
  const windowOptions = {
    width: Math.round(width * 0.4),
    height: Math.round(height * 0.65),
    frame: false, // Always remove frame for custom controls
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, 'Plug-N-Dump.ico'), // Use ICO for Windows
    show: !appConfig.isSilent, // Don't show window in silent mode
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };

  // Add parent window if specified (for embedding)
  if (appConfig.parentWindow) {
    windowOptions.parent = appConfig.parentWindow;
    windowOptions.modal = false;
    windowOptions.alwaysOnTop = false;
  }

  // Skip window creation entirely in silent mode
  if (appConfig.isSilent) {
    windowOptions.show = false;
    windowOptions.width = 1;
    windowOptions.height = 1;
    windowOptions.webPreferences.offscreen = true;
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile('index.html');

  // Only create tray for standalone mode
  if (appConfig.isStandalone && !appConfig.isSilent) {
    tray = new Tray(path.join(__dirname, 'Plug-N-Dump.ico'));
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show App', click: function(){
          mainWindow.show();
          mainWindow.focus();
      }},
      { label: 'Quit', click: function(){
          app.isQuiting = true;
          app.quit();
      }}
    ]);
    tray.setToolTip('Plug-N-Dump™ By Echo Corp.');
    tray.setContextMenu(contextMenu);
    
    // Double click to show window
    tray.on('double-click', () => {
      mainWindow.show();
      mainWindow.focus();
    });

    mainWindow.on('close', function (event) {
      if(!app.isQuiting){
        if (appSettings.minimizeToTray) {
          // Only prevent close if minimize to tray is enabled
          event.preventDefault();
          mainWindow.hide();
          
          // No notification needed - silently minimize to tray
        }
        // If minimizeToTray is false, let the app close normally
      }
      return appSettings.minimizeToTray ? false : true;
    });
    
    // Minimize to tray instead of taskbar (only if setting enabled)
    mainWindow.on('minimize', function (event) {
      if (appSettings.minimizeToTray) {
        event.preventDefault();
        mainWindow.hide();
      }
      // No notification needed - silent background operation
      // If minimizeToTray is false, let normal minimize behavior occur
    });
  }

  // Auto-hide window in embedded mode
  if (appConfig.isEmbedded && mainWindow) {
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setResizable(true);
  }

  // Auto-extract if port specified
  if (appConfig.autoExtractPort && mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        sendProgress('auto-extract', 'active', 'Auto-extraction mode activated');
        mainWindow.webContents.send('auto-extract', appConfig.autoExtractPort);
      }, 2000);
    });
  }

  let lastPorts = [];

  // Initial port scan when renderer is ready - check for already connected flight controllers
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      SerialPort.list().then(ports => {
        const flightControllers = ports.filter(port => port.vendorId && port.vendorId.toUpperCase() === '0483');
        if (flightControllers.length > 0) {
          console.log('Found flight controllers already connected:', flightControllers.map(fc => fc.path));
          mainWindow.webContents.send('serial-ports', flightControllers);
          lastPorts = ports;
        }
      }).catch(err => {
        console.log('Initial port scan error:', err.message);
      });
    }, 500); // Small delay to ensure renderer is fully initialized
  });

  // Continuous port monitoring for changes
  setInterval(() => {
    SerialPort.list().then(ports => {
      const portPaths = ports.map(p => p.path).sort();
      const lastPortPaths = lastPorts.map(p => p.path).sort();

      if (JSON.stringify(portPaths) !== JSON.stringify(lastPortPaths)) {
        const flightControllers = ports.filter(port => port.vendorId && port.vendorId.toUpperCase() === '0483');
        const previousFCs = lastPorts.filter(port => port.vendorId && port.vendorId.toUpperCase() === '0483');
        
        // Check if a new flight controller was connected
        if (flightControllers.length > previousFCs.length) {
          const newFCs = flightControllers.filter(fc => !previousFCs.some(prev => prev.path === fc.path));
          
          if (newFCs.length > 0) {
            // Check if we're waiting for a replug to clear logs
            if (autoExtractionState.awaitingLogClear && newFCs.length === 1 && !autoExtractionState.cancelled) {
              console.log('FC replugged detected, proceeding with log clearing for:', newFCs[0].path);
              
              // Clear the waiting state
              autoExtractionState.awaitingLogClear = false;
              
              // No notification needed - silent auto-clear operation
              
              // Send message to renderer to show auto-clearing state
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('auto-clearing-logs');
              }
              
              // Trigger automatic log clearing
              setTimeout(() => {
                console.log('Starting automatic log clearing for:', newFCs[0].path);
                mainWindow.webContents.send('auto-clear-logs', newFCs[0].path);
              }, 2000);
              
              return; // Don't process normal auto-extraction since we're clearing
            } else if (autoExtractionState.awaitingLogClear && autoExtractionState.cancelled) {
              console.log('Log clearing was cancelled via reset - clearing state and proceeding with normal detection');
              autoExtractionState.awaitingLogClear = false;
              // Fall through to normal processing
            }
            
            // Show app when FC detected (but no notification)
            if (tray && !mainWindow.isVisible()) {
              // Auto-show the window when FC is detected
              mainWindow.show();
              mainWindow.focus();
            }
            
            // Auto-extract if enabled (regardless of window visibility)
            if (appSettings.autoExtractOnDetection && newFCs.length === 1) {
              console.log('Auto-extraction triggered for:', newFCs[0].path);
              console.log('Auto-extract setting:', appSettings.autoExtractOnDetection);
              
              // Set auto-extraction state
              autoExtractionState.wasAutoExtracted = true;
              autoExtractionState.lastExtractedPort = newFCs[0].path;
              
              // Show window if hidden for auto-extraction
              if (!mainWindow.isVisible()) {
                console.log('Showing hidden window for auto-extraction');
                mainWindow.show();
                mainWindow.focus();
              }
              
              setTimeout(() => {
                console.log('Sending auto-extract-request to renderer');
                mainWindow.webContents.send('auto-extract-request', newFCs[0].path);
              }, 2000);
            } else {
              console.log('Auto-extraction not triggered. Setting:', appSettings.autoExtractOnDetection, 'New FCs:', newFCs.length);
            }
          }
        }
        
        mainWindow.webContents.send('serial-ports', flightControllers);
        lastPorts = ports;
      }
    });
  }, 1000);
}

// Add IPC handler for renderer to request a port scan
ipcMain.handle('request-serial-ports', async () => {
  try {
    const ports = await SerialPort.list();
    const flightControllers = ports.filter(port => port.vendorId && port.vendorId.toUpperCase() === '0483');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial-ports', flightControllers);
    }
  } catch (err) {
    console.error('Failed to list serial ports on request:', err);
  }
});

// Add custom window control handlers
ipcMain.handle('window-minimize', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (appSettings.minimizeToTray) {
      mainWindow.hide(); // Hide to tray if setting enabled
    } else {
      mainWindow.minimize(); // Normal minimize to taskbar
      // No notification - silent operation
    }
  }
});

ipcMain.handle('window-close', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

// Add settings management
let appSettings = {
  autoExtractOnDetection: false,
  minimizeToTray: true,
  runOnStartup: false
};

// Load settings from file
function loadSettings() {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      appSettings = { ...appSettings, ...JSON.parse(settingsData) };
    }
    
    // Apply startup setting on load
    if (appSettings.runOnStartup) {
      setAutoStart(true);
    }
  } catch (error) {
    console.log('Failed to load settings:', error);
  }
}

// Save settings to file
function saveSettings() {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(appSettings, null, 2));
  } catch (error) {
    console.log('Failed to save settings:', error);
  }
}

// Handle startup configuration
function setAutoStart(enable) {
  try {
    if (process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin: enable,
        openAsHidden: true, // Start minimized to tray
        path: process.execPath,
        args: appConfig.isEmbedded ? ['--embedded'] : []
      });
      console.log(`Auto-start ${enable ? 'enabled' : 'disabled'}`);
    }
  } catch (error) {
    console.error('Failed to set auto-start:', error);
  }
}

ipcMain.handle('get-settings', async () => {
  return appSettings;
});

ipcMain.handle('update-settings', async (event, newSettings) => {
  const oldSettings = { ...appSettings };
  appSettings = { ...appSettings, ...newSettings };
  
  // Handle startup setting change
  if (oldSettings.runOnStartup !== appSettings.runOnStartup) {
    setAutoStart(appSettings.runOnStartup);
  }
  
  saveSettings();
  return appSettings;
});

// Add IPC handler for custom dialog responses
ipcMain.handle('custom-dialog-response', async (event, response) => {
  // This will be handled by the Promise in handlePostExtractionPrompt
  return response;
});

// Add restart process handler
ipcMain.handle('restart-process', async (event) => {
  // Reset any ongoing operations
  if (global.currentPort && global.currentPort.isOpen) {
    try {
      global.currentPort.close();
    } catch (e) {
      // Port was already closed
    }
  }
  global.currentPort = null;
  
  // Reset auto-extraction state to cancel any pending log clearing workflow
  autoExtractionState.wasAutoExtracted = false;
  autoExtractionState.awaitingLogClear = false;
  autoExtractionState.lastExtractedPort = null;
  
  // Add a cancelled flag to prevent any in-flight operations
  autoExtractionState.cancelled = true;
  
  // Clear the cancelled flag after a short delay to allow for normal operations
  setTimeout(() => {
    autoExtractionState.cancelled = false;
  }, 1000);
  
  console.log('Reset protocol: Cleared auto-extraction state and cancelled any pending operations');
  
  return Promise.resolve();
});

// Add IPC handlers for embedding communication
ipcMain.handle('get-app-config', async () => {
  return appConfig;
});

ipcMain.handle('send-to-parent', async (event, data) => {
  // If embedded, send data to parent application
  if (appConfig.isEmbedded && process.send) {
    process.send({
      type: 'plug-n-dump-data',
      data: data
    });
  }
  return Promise.resolve();
});

ipcMain.handle('get-extraction-status', async () => {
  return {
    isRunning: global.currentPort && global.currentPort.isOpen,
    lastResult: global.lastExtractionResult || null
  };
});

// Handle external commands for embedding
if (appConfig.isEmbedded) {
  process.on('message', (message) => {
    if (message.type === 'extract-request' && mainWindow) {
      mainWindow.webContents.send('external-extract-request', message.data);
    } else if (message.type === 'get-status' && mainWindow) {
      const status = {
        isRunning: global.currentPort && global.currentPort.isOpen,
        lastResult: global.lastExtractionResult || null
      };
      process.send({
        type: 'status-response',
        data: status
      });
    }
  });
}

ipcMain.handle('extract-data', async (event, portPath) => {
  try {
    sendProgress('connect', 'active', `Connecting to FC on ${portPath}...`);
    
    const port = new SerialPort({ path: portPath, baudRate: 115200 });
    global.currentPort = port;
    let dumpData = '';
    let cliEntered = false;

    await new Promise((resolve, reject) => {
      port.on('open', () => {
        sendProgress('connect', 'completed', 'Connection established');
        sendProgress('cli', 'active', 'Entering CLI mode...');
        port.write('#\r');
      });

      let dumpSent = false;
      port.on('data', async (data) => {
        const chunk = data.toString();
        
        if (!cliEntered && (chunk.includes('Entering CLI Mode') || chunk.trim().endsWith('#'))) {
          cliEntered = true;
          sendProgress('cli', 'completed', 'CLI mode activated');
          sendProgress('dump', 'active', 'Extracting configuration dump...');
          dumpSent = true;
          port.write('dump\r');
        } else if (dumpSent) {
          dumpData += chunk;
          if (dumpData.includes('batch end') && (chunk.includes('#') || chunk.trim().endsWith('#'))) {
            dumpSent = false;
            sendProgress('dump', 'completed', 'Configuration dump extracted');
            
            const now = new Date();
            const folderName = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getFullYear()).slice(-2)} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/:/g, '-')}`;
            const dir = path.join(app.getPath('documents'), 'Echo Corp FPV Nexus', 'BBL Logs', folderName);
            
            try {
              await fsp.mkdir(dir, { recursive: true });
              await fsp.writeFile(path.join(dir, 'dump.txt'), dumpData);
              sendProgress('dump', 'completed', `Configuration saved to ${folderName}`);
            } catch (error) {
              sendProgress('dump', 'error', 'Error saving dump file');
              port.close();
              reject(error);
              return;
            }
            
            port.close(async () => {
              sendProgress('msc', 'active', 'Reconnecting for MSC mode...');
              
              try {
                const mscPort = new SerialPort({ path: portPath, baudRate: 115200 });
                mscPort.on('open', () => {
                  sendProgress('msc', 'active', 'Initializing mass storage protocol...');
                  mscPort.write('#\r');
                });

                let mscCliEntered = false;
                mscPort.on('data', (mscData) => {
                  const mscChunk = mscData.toString();
                  if (!mscCliEntered && mscChunk.includes('#')) {
                    mscCliEntered = true;
                    sendProgress('msc', 'active', 'Activating mass storage mode...');
                    mscPort.write('msc\r');
                    
                    setTimeout(() => {
                      mscPort.close(async () => {
                        sendProgress('msc', 'active', 'Waiting for drive to mount...');
                        await new Promise(r => setTimeout(r, 5000));
                        await copyBlackboxFiles(folderName);
                        resolve();
                      });
                    }, 1000);
                  }
                });
                mscPort.on('error', (err) => reject(err));
              } catch (err) {
                reject(err);
              }
            });
          }
        }
      });

      port.on('error', (err) => {
        sendProgress('connect', 'error', 'Failed to connect to flight controller');
        reject(err);
      });
    });
  } catch (error) {
    console.error('Extraction process failed:', error);
    sendProgress('connect', 'error', `Extraction failed: ${error.message}`);
  }
});

// IPC handler to open logs folder
ipcMain.handle('open-logs-folder', async (event, folderPath) => {
  try {
    const { shell } = require('electron');
    await shell.openPath(folderPath);
    console.log(`Opened folder: ${folderPath}`);
  } catch (error) {
    console.error('Failed to open folder:', error);
  }
});

ipcMain.handle('clear-blackbox-logs', async (event, portPath) => {
  try {
    sendProgress('connect', 'active', `Connecting to FC on ${portPath} to clear logs...`);
    
    const port = new SerialPort({ path: portPath, baudRate: 115200 });
    let cliEntered = false;

    await new Promise((resolve, reject) => {
      port.on('open', () => {
        sendProgress('connect', 'completed', 'Connection established, entering CLI mode...');
        port.write('#\r');
      });

      let commandSent = false;
      port.on('data', (data) => {
        const chunk = data.toString();
        console.log('--- FC (Clear) RAW:', chunk); // Log raw data from FC

        if (!cliEntered && (chunk.includes('Entering CLI Mode') || chunk.trim().endsWith('#'))) {
          cliEntered = true;
          sendProgress('cli', 'completed', 'CLI mode activated');
          sendProgress('dump', 'active', 'Sending erase command...');
          commandSent = true;
          port.write('flash_erase\r');
        } else if (commandSent && chunk.trim().endsWith('#')) {
          // The '#' prompt indicates the 'clear' command has finished.
          commandSent = false; // Prevent re-entry
          sendProgress('dump', 'completed', 'Erase command executed.');
          
          port.close(() => {
            sendProgress('complete', 'completed', 'Blackbox logs cleared successfully.');
            resolve();
          });
        }
      });

      port.on('error', (err) => {
        sendProgress('connect', 'error', 'Failed to connect for clearing logs.');
        reject(err);
      });
    });
  } catch (error) {
    console.error('Log clearing process failed:', error);
    sendProgress('clear', 'error', `Log clearing failed: ${error.message}`);
  }
});

// Auto-updater disabled - updates managed by parent application
// if (appConfig.isStandalone && process.env.NODE_ENV !== 'development') {
//   autoUpdater.checkForUpdatesAndNotify();
//   
//   autoUpdater.on('update-available', () => {
//     if (mainWindow) {
//       sendProgress('🔄 Update available - downloading in background...');
//     }
//   });
//   
//   autoUpdater.on('update-downloaded', () => {
//     if (mainWindow) {
//       sendProgress('✅ Update downloaded - will install on next restart');
//     }
//   });
//   
//   // Check for updates every hour in standalone mode
//   setInterval(() => {
//     autoUpdater.checkForUpdatesAndNotify();
//   }, 60 * 60 * 1000);
// }

app.whenReady().then(() => {
  loadSettings(); // Load settings before creating window
  
  // Set app icon globally
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.echocorp.plugndump');
  }
  
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
