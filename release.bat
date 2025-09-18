@echo off
echo Creating Plug-N-Dump™ Release...

echo [1/3] Building installer...
call npm run build-oneclick
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b 1
)

echo [2/3] Adding installer to git...
git add dist\*.exe
git add README.md
git add .gitignore

echo [3/3] Pushing release to GitHub...
git commit -m "Release v2.0.0 - Installer only"
git push origin main

echo.
echo ✅ Release v2.0.0 pushed to GitHub!
echo 🌐 Repository: https://github.com/mrelive/Plug-N-Dump
echo 📦 Installer: dist\Plug-N-Dump™ By Echo Corp-OneClick-Setup-2.0.0.exe
pause