@echo off
title DirectLink Walkie-Talkie
cd /d "%~dp0"
echo ========================================================
echo        Starting DirectLink Secure Walkie-Talkie
echo ========================================================
echo.
node server.js
pause
