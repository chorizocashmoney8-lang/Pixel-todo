@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\create-shortcut.ps1"
if errorlevel 1 (
  echo Shortcut creation failed.
  pause
  exit /b 1
)
echo Desktop shortcut created.
pause
