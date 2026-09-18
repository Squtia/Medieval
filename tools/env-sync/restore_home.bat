@echo off
chcp 65001 > nul
echo ========================================================
echo   [Medieval] 家用開發環境一鍵還原精靈 (Home Restore Wizard)
echo ========================================================
echo.

node "%~dp0restore_home.js"

echo.
pause
