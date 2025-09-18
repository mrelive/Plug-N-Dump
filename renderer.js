// UI Elements
const status = document.getElementById('status');
const extractBtn = document.getElementById('extract-btn');
const restartBtn = document.getElementById('restart-btn');
const openLogsBtn = document.getElementById('open-logs-btn');
const clearLogsBtn = document.getElementById('clear-logs-btn');
const statusIndicator = document.getElementById('status-indicator');
const progressLog = document.getElementById('progress-log');

// Custom window controls
const settingsBtn = document.getElementById('settings-btn');
const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');
const settingsPanel = document.getElementById('settings-panel');
const closeSettingsBtn = document.getElementById('close-settings-btn');

// Settings elements
const autoExtractCheckbox = document.getElementById('auto-extract-checkbox');
const minimizeToTrayCheckbox = document.getElementById('minimize-to-tray-checkbox');
const runOnStartupCheckbox = document.getElementById('run-on-startup-checkbox');

// Specification card elements
const firmwareVersion = document.getElementById('firmware-version');
const firmwareDate = document.getElementById('firmware-date');
const boardName = document.getElementById('board-name');
const boardId = document.getElementById('board-id');
const pilotName = document.getElementById('pilot-name');
const connectionStatus = document.getElementById('connection-status');
const portInfo = document.getElementById('port-info');

let currentPortPath;
let lastBackupPath = null;
let extractionData = {
  filesCount: 0,
  savePath: ''
};

// Disabled - old cyberpunk data stream effect (was causing visual glitches)
function createDataStream() {
  // Data stream effect disabled for cleaner corporate aesthetic
  return;
}

// Typing effect for status updates
function typeText(element, text, speed = 30) {
  element.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
    } else {
      clearInterval(timer);
    }
  }, speed);
}

let currentOperation = 'none'; // Can be 'extract' or 'clear'

// Custom Dialog System
const dialogOverlay = document.getElementById('dialog-overlay');
const customDialog = document.getElementById('custom-dialog');
const dialogTitle = document.getElementById('dialog-title');
const dialogMessage = document.getElementById('dialog-message');
const dialogDetail = document.getElementById('dialog-detail');
const dialogIcon = document.getElementById('dialog-icon');
const dialogBtnPrimary = document.getElementById('dialog-btn-primary');
const dialogBtnSecondary = document.getElementById('dialog-btn-secondary');

// Show custom dialog
function showCustomDialog(options) {
  return new Promise((resolve) => {
    dialogTitle.textContent = options.title || 'Dialog';
    dialogMessage.textContent = options.message || '';
    dialogDetail.textContent = options.detail || '';
    dialogDetail.style.display = options.detail ? 'block' : 'none';
    
    // Set icon
    dialogIcon.className = `dialog-icon ${options.type || 'question'}`;
    dialogIcon.textContent = options.type === 'info' ? 'ℹ' : '?';
    
    // Set button texts
    dialogBtnPrimary.textContent = options.buttons[0] || 'OK';
    dialogBtnSecondary.textContent = options.buttons[1] || 'Cancel';
    dialogBtnSecondary.style.display = options.buttons[1] ? 'block' : 'none';
    
    // Show dialog
    dialogOverlay.classList.add('show');
    
    // Handle button clicks
    const handlePrimary = () => {
      dialogOverlay.classList.remove('show');
      dialogBtnPrimary.removeEventListener('click', handlePrimary);
      dialogBtnSecondary.removeEventListener('click', handleSecondary);
      resolve(0); // Primary button (Yes/OK)
    };
    
    const handleSecondary = () => {
      dialogOverlay.classList.remove('show');
      dialogBtnPrimary.removeEventListener('click', handlePrimary);
      dialogBtnSecondary.removeEventListener('click', handleSecondary);
      resolve(1); // Secondary button (No/Cancel)
    };
    
    dialogBtnPrimary.addEventListener('click', handlePrimary);
    dialogBtnSecondary.addEventListener('click', handleSecondary);
    
    // Handle overlay click to close
    const handleOverlay = (e) => {
      if (e.target === dialogOverlay) {
        handleSecondary();
        dialogOverlay.removeEventListener('click', handleOverlay);
      }
    };
    dialogOverlay.addEventListener('click', handleOverlay);
  });
}

// Initialize cyberpunk effects
document.addEventListener('DOMContentLoaded', () => {
  createDataStream();
  // The UI now starts in a clean state by default.
  // resetUI() is now only called on user action or error.
  window.electronAPI.requestSerialPorts();
});

// Reset UI to its initial state
function resetUI() {
  currentOperation = 'none';
  // Reset button states
  extractBtn.disabled = true;
  clearLogsBtn.disabled = true;
  extractBtn.innerHTML = '<span>INITIATE EXTRACTION</span>';
  openLogsBtn.style.display = 'none';
  clearLogsBtn.innerHTML = '<span>CLEAR BLACKBOX LOGS</span>';
  
  // Reset progress steps
  const allSteps = document.querySelectorAll('.progress-step');
  allSteps.forEach(step => {
    step.classList.remove('active', 'completed', 'error');
    const label = step.querySelector('.step-label');
    label.textContent = label.dataset.labelExtract || '';
    step.style.display = 'flex'; // Show all steps
  });
  
  // Reset status text and connection indicators
  updateSpecificationCards(null, false);
  statusIndicator.classList.remove('connected');
  
  // Clear any waiting states from auto-clearing workflow
  const cards = document.querySelectorAll('.spec-card');
  cards.forEach(card => {
    card.classList.remove('waiting');
  });

  // Notify main process to clean up any ongoing operations
  window.electronAPI.restartProcess();
  window.electronAPI.requestSerialPorts();
}

function handlePorts(ports) {
    const fcPort = ports.find(p => p.vendorId === '0483');
    if (fcPort) {
      if (currentPortPath !== fcPort.path) {
        currentPortPath = fcPort.path;
        
        // Update specification cards
        updateSpecificationCards(fcPort, true);
        
        extractBtn.disabled = false;
        clearLogsBtn.disabled = false; // Ensure this is enabled at the same time
        statusIndicator.classList.add('connected');
      }
    } else {
      if (currentPortPath) {
        currentPortPath = null;
        resetUI(); // If the device is disconnected, reset the whole UI
      }
    }
}

window.electronAPI.onSerialPorts((event, ports) => {
    handlePorts(ports);
});

// Update specification cards with flight controller data
function updateSpecificationCards(fcPort, connected) {
  const cards = document.querySelectorAll('.spec-card');
  
  if (connected && fcPort) {
    // Mark all cards as connected
    cards.forEach(card => card.classList.add('connected'));
    
    // Update firmware card
    firmwareVersion.textContent = 'BETAFLIGHT';
    firmwareDate.textContent = 'Detecting version...';
    
    // Update board card
    boardName.textContent = fcPort.friendlyName || 'STM32 FC';
    boardId.textContent = fcPort.path || 'Unknown Board';
    
    // Update pilot card
    pilotName.textContent = 'MR.ELIVE';
    
    // Update status card
    connectionStatus.textContent = 'CONNECTED';
    portInfo.textContent = fcPort.path;
    
  } else {
    // Mark all cards as disconnected
    cards.forEach(card => card.classList.remove('connected'));
    
    // Reset firmware card
    firmwareVersion.textContent = 'Detecting...';
    firmwareDate.textContent = 'Scanning ports';
    
    // Reset board card
    boardName.textContent = 'Unknown';
    boardId.textContent = 'Flight Controller';
    
    // Reset pilot card
    pilotName.textContent = 'Unknown';
    
    // Reset status card
    connectionStatus.textContent = 'STANDBY';
    portInfo.textContent = 'Awaiting connection';
  }
}

extractBtn.addEventListener('click', () => {
  if (currentPortPath) {
    currentOperation = 'extract';
    extractBtn.disabled = true;
    clearLogsBtn.disabled = true;
    extractBtn.innerHTML = '<span class="btn-icon"></span><span>EXTRACTING...</span>';
    
    // Set labels for extraction
    const allSteps = document.querySelectorAll('.progress-step');
    allSteps.forEach(step => {
      const label = step.querySelector('.step-label');
      label.textContent = label.dataset.labelExtract || '';
      step.style.display = 'flex';
    });

    // Reset progress steps visual state
    allSteps.forEach(step => step.classList.remove('active', 'completed', 'error'));
    
    window.electronAPI.extractData(currentPortPath);
  }
});

restartBtn.addEventListener('click', () => {
  resetUI();
});

window.electronAPI.onUpdateProgress((event, { step, status, message, data }) => {
  console.log('Progress Update:', { step, status, message, data });

  const allStepsList = currentOperation === 'clear' 
    ? ['connect', 'cli', 'dump', 'msc', 'complete'] 
    : ['connect', 'cli', 'dump', 'msc', 'copy', 'complete'];
  
  // Update current and previous steps
  const currentStepIndex = allStepsList.indexOf(step);
  document.querySelectorAll('.progress-step').forEach((stepElement, i) => {
    const s = stepElement.dataset.step;
    const stepIndexInCurrentOp = allStepsList.indexOf(s);

    if (stepIndexInCurrentOp === -1) return; // Skip steps not in the current operation

    stepElement.classList.remove('active', 'completed', 'error');

    if (stepIndexInCurrentOp < currentStepIndex) {
      stepElement.classList.add('completed');
    } else if (stepIndexInCurrentOp === currentStepIndex) {
      if (status === 'active') {
        stepElement.classList.add('active');
      } else if (status === 'completed') {
        stepElement.classList.add('completed');
      } else if (status === 'error') {
        stepElement.classList.add('error');
      }
    }
  });

  // Update status text
  if (message) {
    connectionStatus.textContent = message;
  }

  // Handle completion
  if (step === 'complete' && status === 'completed') {
    if (currentOperation === 'extract') {
      connectionStatus.textContent = 'EXTRACTION COMPLETE';
      extractBtn.innerHTML = '<span class="btn-icon"></span><span>COMPLETE</span>';
      extractBtn.disabled = true;
      
      if (data.backupPath) {
        lastBackupPath = data.backupPath;
        openLogsBtn.style.display = 'flex';
      }
    } else if (currentOperation === 'clear') {
      connectionStatus.textContent = 'LOGS CLEARED';
      clearLogsBtn.innerHTML = '<span class="btn-icon"></span><span>COMPLETE</span>';
      clearLogsBtn.disabled = true;
    }
  }
});

// Extract firmware information from dump data
function updateFirmwareInfo() {
  // This would parse the actual dump data, for now we'll simulate
  firmwareVersion.textContent = '4.4.2';
  firmwareDate.textContent = 'Jun 7 2023 / 03:32:04';
  boardName.textContent = 'SPEEDYBEEF405MINI';
  boardId.textContent = 'ECU01';
}

// Open logs folder button event handler
openLogsBtn.addEventListener('click', () => {
  console.log('Open logs button clicked. Path:', lastBackupPath);
  if (lastBackupPath) {
    window.electronAPI.openLogsFolder(lastBackupPath);
  }
});

clearLogsBtn.addEventListener('click', () => {
  if (currentPortPath) {
    const confirmation = confirm("Are you sure you want to clear all blackbox logs from the flight controller? This action cannot be undone.");
    if (confirmation) {
      currentOperation = 'clear';
      extractBtn.disabled = true;
      clearLogsBtn.disabled = true;
      clearLogsBtn.innerHTML = '<span class="btn-icon"></span><span>CLEARING...</span>';

      // Set labels and visibility for clearing
      const allSteps = document.querySelectorAll('.progress-step');
      allSteps.forEach(step => {
        const label = step.querySelector('.step-label');
        const clearLabel = label.dataset.labelClear || '';
        label.textContent = clearLabel;
        
        // Hide steps not relevant to clearing
        if (clearLabel === '') {
          step.style.display = 'none';
        } else {
          step.style.display = 'flex';
        }
      });

      // Reset progress steps visual state
      allSteps.forEach(step => step.classList.remove('active', 'completed', 'error'));

      window.electronAPI.clearBlackboxLogs(currentPortPath);
    }
  }
});

// Window Controls Event Handlers
settingsBtn.addEventListener('click', async () => {
  settingsPanel.classList.toggle('open');
  
  // Load current settings when opening panel
  if (settingsPanel.classList.contains('open')) {
    const settings = await window.electronAPI.getSettings();
    autoExtractCheckbox.checked = settings.autoExtractOnDetection;
    minimizeToTrayCheckbox.checked = settings.minimizeToTray;
    runOnStartupCheckbox.checked = settings.runOnStartup;
  }
});

closeSettingsBtn.addEventListener('click', () => {
  settingsPanel.classList.remove('open');
});

minimizeBtn.addEventListener('click', () => {
  window.electronAPI.windowMinimize();
});

closeBtn.addEventListener('click', () => {
  window.electronAPI.windowClose();
});

// Settings Event Handlers
autoExtractCheckbox.addEventListener('change', async () => {
  const settings = await window.electronAPI.getSettings();
  settings.autoExtractOnDetection = autoExtractCheckbox.checked;
  await window.electronAPI.updateSettings(settings);
});

minimizeToTrayCheckbox.addEventListener('change', async () => {
  const settings = await window.electronAPI.getSettings();
  settings.minimizeToTray = minimizeToTrayCheckbox.checked;
  await window.electronAPI.updateSettings(settings);
});

runOnStartupCheckbox.addEventListener('change', async () => {
  const settings = await window.electronAPI.getSettings();
  settings.runOnStartup = runOnStartupCheckbox.checked;
  await window.electronAPI.updateSettings(settings);
});

// Handle auto-extract request from main process
window.electronAPI.onAutoExtractRequest((event, portPath) => {
  console.log('Auto-extract request received for port:', portPath);
  console.log('Extract button disabled?', extractBtn?.disabled);
  console.log('Current port path before auto-extract:', currentPortPath);
  
  // Show window and focus if auto-extracting
  if (portPath && extractBtn && !extractBtn.disabled) {
    console.log('Triggering auto-extraction...');
    currentPortPath = portPath;
    extractBtn.click();
  } else {
    console.log('Auto-extract failed - conditions not met');
  }
});

// Handle waiting for replug message from main process
window.electronAPI.onWaitingForReplug && window.electronAPI.onWaitingForReplug((event) => {
  console.log('Waiting for FC replug...');
  connectionStatus.textContent = 'WAITING FOR RECONNECTION';
  
  // Update all cards to show waiting state
  const cards = document.querySelectorAll('.spec-card');
  cards.forEach(card => {
    card.classList.remove('connected');
    card.classList.add('waiting');
  });
  
  // Update status card specifically
  connectionStatus.textContent = 'WAITING FOR REPLUG';
  portInfo.textContent = 'Please unplug and reconnect FC';
});

// Handle auto-clearing logs message from main process
window.electronAPI.onAutoClearingLogs && window.electronAPI.onAutoClearingLogs((event) => {
  console.log('Auto-clearing logs initiated...');
  connectionStatus.textContent = 'AUTO-CLEARING LOGS';
  
  // Remove waiting state and show connected
  const cards = document.querySelectorAll('.spec-card');
  cards.forEach(card => {
    card.classList.remove('waiting');
    card.classList.add('connected');
  });
});

// Handle auto-clear logs trigger from main process
window.electronAPI.onAutoClearLogs && window.electronAPI.onAutoClearLogs((event, portPath) => {
  console.log('Auto-clear logs request received for port:', portPath);
  
  if (portPath) {
    currentPortPath = portPath;
    currentOperation = 'clear';
    extractBtn.disabled = true;
    clearLogsBtn.disabled = true;
    clearLogsBtn.innerHTML = '<span class="btn-icon"></span><span>AUTO-CLEARING...</span>';

    // Set labels and visibility for clearing
    const allSteps = document.querySelectorAll('.progress-step');
    allSteps.forEach(step => {
      const label = step.querySelector('.step-label');
      const clearLabel = label.dataset.labelClear || '';
      label.textContent = clearLabel;
      
      // Hide steps not relevant to clearing
      if (clearLabel === '') {
        step.style.display = 'none';
      } else {
        step.style.display = 'flex';
      }
    });

    // Reset progress steps visual state
    allSteps.forEach(step => step.classList.remove('active', 'completed', 'error'));

    // Trigger the clearing process
    window.electronAPI.clearBlackboxLogs(currentPortPath);
  }
});

// Handle custom dialog requests from main process
window.electronAPI.onShowCustomDialog && window.electronAPI.onShowCustomDialog(async (event, options) => {
  const response = await showCustomDialog(options);
  window.electronAPI.sendCustomDialogResponse(response);
});

// Close settings panel when clicking outside
document.addEventListener('click', (event) => {
  if (!settingsPanel.contains(event.target) && !settingsBtn.contains(event.target)) {
    settingsPanel.classList.remove('open');
  }
});

// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const settings = await window.electronAPI.getSettings();
    autoExtractCheckbox.checked = settings.autoExtractOnDetection;
    minimizeToTrayCheckbox.checked = settings.minimizeToTray;
  } catch (error) {
    console.log('Failed to load settings:', error);
  }
});
