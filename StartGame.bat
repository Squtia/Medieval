@echo off
echo =========================================
echo       Medieval Game Launcher
echo =========================================
echo.
echo Checking Node.js environment...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm command not found!
    echo Please make sure Node.js is installed and added to your PATH.
    echo Download link: https://nodejs.org/
    echo.
    pause
    exit /b
)

echo Checking node_modules folder...
if not exist node_modules (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b
    )
)

echo.
echo Starting local server and opening browser...
echo Please do not close this window while playing.
echo.
start http://localhost:5173/
call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server stopped unexpectedly!
    pause
)
