@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0node_modules\electron\dist\electron.exe" (
  echo Electron is missing. Run npm ci in this folder first.
  pause
  exit /b 1
)
set ELECTRON_RUN_AS_NODE=
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0." %*
