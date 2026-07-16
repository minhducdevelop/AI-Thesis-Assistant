@echo off
title AI Thesis Assistant - Full System Launcher
echo ==========================================================
echo       [AI THESIS ASSISTANT] KHOI DONG TOAN BO HE THONG
echo ==========================================================
echo.

:: Buoc 1: Khoi dong Backend trong cua so rieng
echo [1/2] Dang khoi dong Backend Server (Cong 8000)...
start "ThesisAI Backend" cmd /c "cd /d "%~dp0\backend" && call venv\Scripts\activate && python -m uvicorn app.main:app --port 8000 && pause"

:: Doi 3 giay de backend khoi dong
echo Dang doi Backend khoi dong...
timeout /t 3 /nobreak >nul

:: Buoc 2: Khoi dong Frontend trong cua so rieng
echo [2/2] Dang khoi dong Frontend Client (Cong 3000)...
start "ThesisAI Frontend" cmd /c "cd /d "%~dp0\frontend" && npm run dev && pause"

echo.
echo ==========================================================
echo   HE THONG DA KHOI DONG THANH CONG!
echo   Backend: http://localhost:8000
echo   Frontend: http://localhost:3000
echo ==========================================================
echo.
echo Ban co the dong cua so nay.
pause
