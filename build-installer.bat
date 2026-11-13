@echo off
setlocal
title Matheesha Flour Mill - Build Installer

REM ============================================================
REM  Matheesha Flour Mill - Electron installer build
REM  Put this file in: C:\Users\user\Documents\codedge\CEQ-20260223-001
REM ============================================================

REM Use Node v20.19.0 first (prepended so it wins over any other Node)
set "PATH=D:\Thakshila_doc\nvm\v20.19.0;%PATH%"

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "ELECTRON=%ROOT%\electron"

echo.
echo Project : %ROOT%
for /f "delims=" %%v in ('node -v 2^>nul') do set "NODEVER=%%v"
if not defined NODEVER (
  echo [ERROR] Node not found. Check D:\Thakshila_doc\nvm\v20.19.0
  goto :fail
)
echo Node    : %NODEVER%
echo.

REM ---------- 1. Frontend build (optional) ----------
choice /c YN /m "Did the frontend change? Rebuild it"
if errorlevel 2 (set "BUILD_FE=N") else (set "BUILD_FE=Y")

if "%BUILD_FE%"=="Y" (
  echo.
  echo [1/5] Building frontend...
  pushd "%ROOT%\frontend"
  call npm run build
  if errorlevel 1 (popd & goto :fail)
  popd
) else (
  echo [1/5] Skipping frontend build.
)

REM ---------- 2. Backend copy ----------
echo.
echo [2/5] Refreshing backend-dist...
pushd "%ELECTRON%"
if exist backend-dist rmdir /s /q backend-dist
robocopy "%ROOT%\backend" backend-dist /E /XD node_modules .wwebjs_auth .wwebjs_cache chrome tmp /XF node .puppeteerrc.cjs /NFL /NDL /NJH /NJS /NP
if errorlevel 8 (
  echo [ERROR] Backend copy failed.
  popd & goto :fail
)

pushd backend-dist
call npm install --omit=dev
if errorlevel 1 (popd & popd & goto :fail)
popd

REM ---------- 3. Fix .env ----------
echo.
echo [3/5] Setting NODE_ENV=production in backend-dist\.env ...
if not exist backend-dist\.env (
  echo [ERROR] backend-dist\.env not found.
  popd & goto :fail
)
REM WriteAllLines saves UTF-8 without BOM (a BOM would break the first key for dotenv)
powershell -NoProfile -Command "$p = Resolve-Path 'backend-dist\.env'; $l = (Get-Content $p) -replace '^NODE_ENV=.*','NODE_ENV=production'; [IO.File]::WriteAllLines($p, $l)"
if errorlevel 1 (popd & goto :fail)

choice /c YN /m "Open .env to check printer names (RECEIPT_PRINTER_NAME / INVOICE_PRINTER_NAME)"
if errorlevel 2 (
  rem skip
) else (
  start /wait notepad backend-dist\.env
)

echo.
echo Check these values:
type backend-dist\.env | findstr /i "NODE_ENV NOTIFY_WHATSAPP_TO WHATSAPP_ALERT_IMAGE PRINTER_NAME"
echo.
echo Expected: NODE_ENV=production, NOTIFY_WHATSAPP_TO=94779337369,
echo           WHATSAPP_ALERT_IMAGE=assets/mill_alert_banner.jpeg
echo.
choice /c YN /m "Values OK? Continue"
if errorlevel 2 (popd & goto :fail)

REM ---------- 4. Frontend copy (only if rebuilt) ----------
echo.
if "%BUILD_FE%"=="Y" (
  echo [4/5] Copying frontend build to frontend-dist...
  if exist frontend-dist rmdir /s /q frontend-dist
  robocopy "%ROOT%\frontend\dist\frontend" frontend-dist /E /NFL /NDL /NJH /NJS /NP
  if errorlevel 8 (
    echo [ERROR] Frontend copy failed.
    popd & goto :fail
  )
) else (
  echo [4/5] Keeping existing frontend-dist.
)

if not exist frontend-dist\server\server.mjs (
  echo [ERROR] frontend-dist\server\server.mjs missing. Rebuild the frontend.
  popd & goto :fail
)

REM ---------- 5. Build installer ----------
echo.
echo [5/5] Building installer...
call npm run build:win
if errorlevel 1 (popd & goto :fail)
popd

echo.
echo ============================================================
echo  BUILD DONE - installer is in:
echo  %ROOT%\dist-electron
echo ============================================================
start "" "%ROOT%\dist-electron"
pause
exit /b 0

:fail
echo.
echo ============================================================
echo  BUILD FAILED - see the messages above.
echo ============================================================
pause
exit /b 1
