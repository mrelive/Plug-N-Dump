# Plug-N-Dump Integration Guide for The FPV Nexus

This guide outlines the best practices for integrating the `Plug-N-Dump` utility into a parent application like 'The FPV Nexus'. The application is designed with this embedding capability as a core feature.

## 1. Launching in Embedded Mode

Your main application should launch `Plug-N-Dump` as a **child process**. To enable the special integration features, you must use the `--embedded` command-line flag.

This flag activates the following behaviors:
-   **No Window Frame:** The application starts without the standard title bar, borders, or menus. This allows it to be rendered seamlessly within your parent application's UI.
-   **IPC Communication:** It enables a dedicated Inter-Process Communication (IPC) channel, allowing your main application and `Plug-N-Dump` to exchange messages.

## 2. Two-Way Communication (IPC)

The IPC channel allows for robust, real-time communication between the two processes.

### Receiving Data from Plug-N-Dump

`Plug-N-Dump` will automatically send structured progress updates to the parent process. Your main application can listen for these messages to display real-time status in its own UI.

The message format is as follows:
```json
{
  "type": "plug-n-dump-progress",
  "data": {
    "step": "connect",
    "status": "active",
    "message": "Connecting to FC on COM3...",
    "data": {}
  }
}
```

### Sending Commands to Plug-N-Dump

Your main application can also send commands *to* `Plug-N-Dump`. For example, you can programmatically trigger an extraction process.

The command format is as follows:
```json
{
  "type": "extract-request",
  "data": { "port": "COM3" }
}
```

## 3. Conceptual Implementation

Here is a simplified Node.js example demonstrating how to manage the `Plug-N-Dump` child process from your main 'FPV Nexus' backend.

```javascript
// In your main FPV Nexus application (conceptual example)
const { spawn } = require('child_process');
const path = require('path');

// 1. Define the path to the Plug-N-Dump executable
//    Ensure this path points to the packaged executable (e.g., in the 'dist' folder).
const pndPath = path.join(__dirname, 'path', 'to', 'Plug-N-Dump.exe');

// 2. Set the arguments to run in embedded mode
const pndArgs = ['--embedded'];

// 3. Spawn the process with an IPC channel enabled
//    The 'ipc' option in stdio is critical for enabling messaging.
const pndProcess = spawn(pndPath, pndArgs, {
  stdio: ['pipe', 'pipe', 'pipe', 'ipc'] 
});

// 4. Listen for progress updates from Plug-N-Dump
pndProcess.on('message', (message) => {
  if (message.type === 'plug-n-dump-progress') {
    console.log('Received progress from Plug-N-Dump:', message.data);
    
    // You can now use this data to update the FPV Nexus UI in real-time.
    // For example: updateMyUI(message.data.step, message.data.status, message.data.message);
  }
});

// 5. Example: Function to send a command to Plug-N-Dump
function startExtraction(comPort) {
  console.log(`Requesting extraction on ${comPort} from Plug-N-Dump...`);
  pndProcess.send({
    type: 'extract-request',
    data: { port: comPort }
  });
}

// --- Process Lifecycle Management ---

pndProcess.on('error', (err) => {
  console.error('Failed to start or run Plug-N-Dump process:', err);
});

pndProcess.on('exit', (code) => {
  console.log(`Plug-N-Dump process exited with code ${code}`);
});

// Ensure the child process is terminated when your main app closes
process.on('exit', () => {
  pndProcess.kill();
});
```

For more detailed information on all available command-line arguments and IPC message types, please refer to the `EMBEDDING.md` file.
