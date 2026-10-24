@echo off
cd /d "%~dp0"
echo Starting Yandex Smart Dashboard (dev)...
echo API:     http://localhost:8080
echo Frontend: http://localhost:5173
echo.
call pnpm dev
pause