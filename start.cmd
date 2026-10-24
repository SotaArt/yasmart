@echo off
cd /d "%~dp0"
echo Building Yandex Smart Dashboard...
call pnpm build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)
if "%DASHBOARD_PASSWORD%"=="" (
  set /p "DASHBOARD_PASSWORD=Enter dashboard password (required): "
)
if "%DASHBOARD_PASSWORD%"=="" (
  echo DASHBOARD_PASSWORD is required.
  pause
  exit /b 1
)
if "%SESSION_SECRET%"=="" (
  set /p "SESSION_SECRET=Enter session secret (Enter = derive from password): "
)
echo Starting production server...
echo API + Frontend: http://localhost:8080
echo.
call pnpm start
pause