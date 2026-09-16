@echo off
title PRISMA - Nextant Solution Library
cd /d "%~dp0app"

if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

echo.
echo   Building production bundle...
call npm run build
if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
)

echo.
echo   PRISMA PoC - serving production build at http://localhost:4173/
echo   Use a Chromium browser ^(Edge/Chrome^) for the full liquid-glass effect.
echo.

start "" http://localhost:4173/
call npm run preview
