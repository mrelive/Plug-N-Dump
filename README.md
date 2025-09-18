# Plug-N-Dump™ by ECHO CORP

**Professional Flight Controller Data Extraction Tool**

A specialized Electron-based application for extracting flight data from Betaflight flight controllers via serial communication. Designed for FPV pilots and technicians who need reliable, automated data extraction and blackbox log management.

## 🚀 Features

- **One-Click Installation**: Professional NSIS installer with automatic elevation
- **Auto-Detection**: Automatically detects STM32-based flight controllers (VID: 0483)
- **CLI Data Extraction**: Extracts complete `dump` configuration from Betaflight CLI
- **Mass Storage Mode**: Transitions to MSC mode for blackbox file copying
- **Auto-Extract on Detection**: Optional automatic extraction when FC is connected
- **System Tray Integration**: Minimize to tray for background operation
- **Windows Startup**: Optional auto-start with Windows boot
- **Corporate UI**: Professional cyberpunk-themed interface

## 📦 Download

**Latest Release: v2.0.0**

- **[📥 One-Click Installer (87.4 MB)](dist/Plug-N-Dump™%20By%20Echo%20Corp-OneClick-Setup-2.0.0.exe)**
- **[📦 Portable Version (87.1 MB)](dist/Plug-N-Dump™%20By%20Echo%20Corp-Portable-2.0.0.exe)**

## 🔧 System Requirements

- **OS**: Windows 10/11 (64-bit)
- **Hardware**: USB port for flight controller connection
- **Permissions**: Administrator rights for installation

## 📊 Supported Hardware

- **Flight Controllers**: STMicroelectronics-based (VID: 0483)
- **Firmware**: Betaflight with CLI and MSC support
- **File Types**: `.BBL` and `.BHL` blackbox logs

## ⚙️ Settings

- **Auto-Extract**: Automatically start extraction when FC detected
- **Minimize to Tray**: Hide in system tray instead of taskbar
- **Run on Startup**: Start with Windows (minimized to tray)

## 🏢 Corporate Integration

Plug-N-Dump supports embedding within larger applications:

- **Silent Mode**: Headless operation via command line
- **Embedded Mode**: Integration with parent applications
- **IPC Communication**: Node.js process messaging
- **Custom Output**: Configurable save directories

## 📁 Output Structure

```
%USERPROFILE%\\Documents\\Echo Corp FPV Nexus\\BBL Logs\\
└── MM-DD-YY H-MM AM_PM\\
    ├── dump.txt (CLI configuration)
    ├── LOG00001.BBL (blackbox data)
    └── LOG00002.BBL (additional logs)
```

## 🔨 Development

Built with modern technologies:
- **Electron 38.1.2** (latest LTS)
- **SerialPort 13.0.0** (hardware communication)
- **Yargs 18.0.0** (CLI argument parsing)
- **drivelist 12.0.2** (drive detection)

## 📄 License

© 2025 ECHO CORP. All rights reserved.

---

**Professional FPV Data Solutions** | Built for pilots, by pilots