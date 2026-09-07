@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

title 求職助手 career-ops 啟動器

echo.
echo  ============================================
echo   求職助手 career-ops 啟動器
echo  ============================================
echo.

REM ── 1. 檢查 Node.js ──────────────────────────────────────────────
where node >nul 2>nul
if errorlevel 1 (
    echo  [錯誤] 未偵測到 Node.js。
    echo.
    echo  請先安裝 Node.js（免費）：
    echo    1. 前往 https://nodejs.org/
    echo    2. 下載「LTS」版本並安裝（一直按下一步即可）
    echo    3. 安裝完成後，重新雙擊本檔案
    echo.
    echo  正在為你開啟下載頁面...
    start "" https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM ── 2. 檢查 Node 版本是否 >= 22 ──────────────────────────────────
for /f "delims=" %%v in ('node -e "process.stdout.write(process.versions.node)"') do set NODEVER=%%v
for /f "tokens=1 delims=." %%m in ("!NODEVER!") do set NODEMAJOR=%%m

if !NODEMAJOR! LSS 22 (
    echo  [錯誤] 你的 Node.js 版本是 !NODEVER!，需要 22 以上。
    echo.
    echo  請到 https://nodejs.org/ 下載最新 LTS 版本重新安裝。
    echo.
    start "" https://nodejs.org/
    pause
    exit /b 1
)

echo  [OK] Node.js !NODEVER! 已就緒
echo.

REM ── 3. 切換到 web 目錄 ──────────────────────────────────────────
cd /d "%~dp0..\web"
if errorlevel 1 (
    echo  [錯誤] 找不到 web 資料夾，請確認專案完整。
    pause
    exit /b 1
)

REM ── 4. 首次安裝依賴（之後會自動跳過）────────────────────────────
if not exist "node_modules" (
    echo  [首次執行] 正在安裝必要元件，請稍候（約 1-3 分鐘）...
    echo  （此步驟只會做一次）
    echo.
    call npm ci
    if errorlevel 1 (
        echo.
        echo  [錯誤] 安裝失敗，請檢查網路連線後重試。
        pause
        exit /b 1
    )
    echo.
    echo  [OK] 元件安裝完成
    echo.
) else (
    echo  [OK] 元件已安裝，直接啟動
    echo.
)

REM ── 5. 啟動伺服器 + 自動開瀏覽器 ────────────────────────────────
echo  正在啟動，瀏覽器會自動開啟...
echo  使用期間請「不要關閉」這個黑色視窗。
echo  要結束時，關閉此視窗即可。
echo.

REM 延遲 3 秒後開瀏覽器（等伺服器起來）
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

REM 啟動 Next.js 開發伺服器
call npm run dev

REM 若伺服器結束，暫停讓使用者看到訊息
echo.
echo  伺服器已停止。
pause
