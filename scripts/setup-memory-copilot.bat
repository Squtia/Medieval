@echo off
chcp 65001 >nul
echo ==================================================
echo [Medieval] Memory Copilot 一鍵環境配置啟動器
echo ==================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-memory-copilot.ps1"

echo.
echo 按任意鍵關閉視窗...
pause >nul
