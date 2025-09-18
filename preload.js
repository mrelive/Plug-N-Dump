const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onSerialPorts: (callback) => ipcRenderer.on('serial-ports', callback),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', callback),
  onAutoExtract: (callback) => ipcRenderer.on('auto-extract', callback),
  onAutoExtractRequest: (callback) => ipcRenderer.on('auto-extract-request', callback),
  onExternalExtractRequest: (callback) => ipcRenderer.on('external-extract-request', callback),
  onWaitingForReplug: (callback) => ipcRenderer.on('waiting-for-replug', callback),
  onAutoClearingLogs: (callback) => ipcRenderer.on('auto-clearing-logs', callback),
  onAutoClearLogs: (callback) => ipcRenderer.on('auto-clear-logs', callback),
  onShowCustomDialog: (callback) => ipcRenderer.on('show-custom-dialog', callback),
  sendCustomDialogResponse: (response) => ipcRenderer.send('custom-dialog-response', response),
  extractData: (portPath) => ipcRenderer.invoke('extract-data', portPath),
  restartProcess: () => ipcRenderer.invoke('restart-process'),
  openLogsFolder: (folderPath) => ipcRenderer.invoke('open-logs-folder', folderPath),
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  sendToParent: (data) => ipcRenderer.invoke('send-to-parent', data),
  getExtractionStatus: () => ipcRenderer.invoke('get-extraction-status'),
  clearBlackboxLogs: (portPath) => ipcRenderer.invoke('clear-blackbox-logs', portPath),
  requestSerialPorts: () => ipcRenderer.invoke('request-serial-ports'),
  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings)
});
