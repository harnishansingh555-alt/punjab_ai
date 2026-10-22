@echo off
cd /d "%~dp0"

where node >nul 2>nul || (echo Node.js is not installed. Install it from https://nodejs.org and run this file again. & pause & exit /b)

if not exist node_modules call npm install

set "PAGE=http://localhost:3000/chat.html"

start "" cmd /c "timeout /t 3 >nul & start %PAGE%"
echo Punjab AI is starting. Keep this window open while you use the site.
node server.js
pause
