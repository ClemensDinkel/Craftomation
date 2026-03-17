@echo off
echo Starting Craftomation...
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  echo Download it from https://nodejs.org
  pause
  exit /b 1
)
echo.
node server/index.js
echo.
echo Server stopped.
pause
