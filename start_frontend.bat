@echo off
title AI Thesis Assistant - Frontend Client
echo ==========================================================
echo       [AI THESIS ASSISTANT] KHOI TAO FRONTEND CLIENT
echo ==========================================================
cd /d "%~dp0\frontend"

:: Kiem tra xem npm co trong PATH khong
set NPM_CMD=npm
where npm >nul 2>&1
if errorlevel 1 (
    echo NPM khong co trong PATH mac dinh. Dang tu dong tim kiem...
    
    if exist "C:\Program Files\nodejs\npm.cmd" (
        set NPM_CMD="C:\Program Files\nodejs\npm.cmd"
    ) else if exist "C:\Program Files (x86)\nodejs\npm.cmd" (
        set NPM_CMD="C:\Program Files (x86)\nodejs\npm.cmd"
    ) else (
        echo [LOI] Khong tim thay Node.js/NPM. Vui long khoi dong lai may tinh hoac cai dat lai Node.js.
        pause
        exit /b
      )
)

:npm_found
echo Da tim thay NPM. Dang su dung: %NPM_CMD%

echo [1/2] Dang cai dat cac thu vien Node (npm install)...
call %NPM_CMD% install

echo [2/2] Dang khoi dong React Vite dev server (Cong 3000)...
call %NPM_CMD% run dev
pause
