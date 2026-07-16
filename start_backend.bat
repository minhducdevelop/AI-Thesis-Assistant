@echo off
title ThesisAI - Backend Server
cd /d "%~dp0\backend"

echo [1/2] Dang giai phong cong 8000 neu dang bi chiem dung...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /f /pid %%a >nul 2>&1
)
ping 127.0.0.1 -n 3 >nul

echo [2/2] Dang khoi dong FastAPI Server (Cong 8000)...
if exist venv\Scripts\python.exe (
    venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
) else (
    echo [LOI] Khong tim thay venv\Scripts\python.exe. Dang chay bang python he thong...
    python -m uvicorn app.main:app --reload --port 8000
)
pause
