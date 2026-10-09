@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 需要先安装 Node.js，或使用点亮的 Windows 便携版。
  echo Node.js 官方下载页面：https://nodejs.org/en/download
  pause
  exit /b 1
)
echo 点亮开发版：http://localhost:4176
start "" "http://localhost:4176"
node scripts\serve-dev.mjs
pause
