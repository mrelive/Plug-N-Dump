@echo off
echo Building ECHO CORP Plug-N-Dump v2.0.0 for distribution...

echo.
echo [1/5] Installing and updating dependencies...
call npm install

echo.
echo [2/5] Building one-click installer (NSIS)...
call npm run build-oneclick

echo.
echo [3/5] Building portable version...
call npm run build-portable

echo.
echo [4/5] Building all formats...
call npm run build-all

echo.
echo [5/5] Creating embeddable module package...
mkdir dist\embeddable 2>nul
xcopy main.js dist\embeddable\ /Y
xcopy renderer.js dist\embeddable\ /Y
xcopy preload.js dist\embeddable\ /Y
xcopy index.html dist\embeddable\ /Y
xcopy style.css dist\embeddable\ /Y
xcopy *.png dist\embeddable\ /Y
xcopy package.json dist\embeddable\ /Y

echo.
echo Building complete!
echo.
echo Outputs:
echo - One-click installer: dist\Plug-N-Dump™ By Echo Corp-OneClick-Setup-2.0.0.exe
echo - Portable version: dist\Plug-N-Dump™ By Echo Corp-Portable-2.0.0.exe
echo - Embeddable module: dist\embeddable\
echo.
echo Package Updates (v2.0.0):
echo - Electron: 29.4.6 → 38.1.2 (Latest LTS with improved performance)
echo - SerialPort: 12.0.0 → 13.0.0 (Better hardware compatibility)
echo - electron-builder: 24.13.3 → 26.0.12 (Latest build tools)
echo - All dependencies updated to latest stable versions
echo.
echo Installation Features:
echo - One-click installer: Just run and it installs automatically
echo - Runs immediately after installation
echo - Creates desktop and start menu shortcuts
echo - Admin privileges for hardware access
echo - Silent uninstall available through Windows Programs
echo.
echo For automated deployment:
echo   "Plug-N-Dump™ By Echo Corp-OneClick-Setup-2.0.0.exe" --silent