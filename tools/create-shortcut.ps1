param([string]$OutputDirectory = [Environment]::GetFolderPath('Desktop'))
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $projectRoot '启动软件.cmd'
if (-not (Test-Path -LiteralPath $launcher)) { throw 'Launcher is missing.' }
if (-not (Test-Path -LiteralPath $OutputDirectory -PathType Container)) { throw 'Shortcut directory is missing.' }
$shell = New-Object -ComObject WScript.Shell
$shortcutPath = Join-Path $OutputDirectory 'Pixel Todo（源码版）.lnk'
if (Test-Path -LiteralPath $shortcutPath) { throw 'Shortcut already exists; the existing shortcut was not replaced.' }
$link = $shell.CreateShortcut($shortcutPath)
$link.TargetPath = $launcher
$link.WorkingDirectory = $projectRoot
$link.IconLocation = (Join-Path $projectRoot 'assets\icon.ico') + ',0'
$link.Description = '启动本目录中的 Pixel Todo 源码版'
$link.WindowStyle = 7
$link.Save()
Write-Output $shortcutPath
