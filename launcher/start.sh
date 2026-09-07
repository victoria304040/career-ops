#!/bin/bash
# 求職助手 career-ops 啟動器（Linux）
# 執行方式：chmod +x start.sh && ./start.sh

cd "$(dirname "$0")/../web" || { echo "找不到 web 資料夾"; exit 1; }

echo "============================================"
echo " 求職助手 career-ops 啟動器"
echo "============================================"
echo

if ! command -v node >/dev/null 2>&1; then
    echo "[錯誤] 未偵測到 Node.js。"
    echo "請先安裝 Node.js（免費）：https://nodejs.org/"
    echo "或使用套件管理員，例如：sudo apt install nodejs npm"
    read -r -p "按 Enter 結束..."
    exit 1
fi

NODEMAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODEMAJOR" -lt 22 ]; then
    echo "[錯誤] Node.js 版本需 22 以上，目前是 $(node -v)。"
    echo "請到 https://nodejs.org/ 下載最新 LTS 版本。"
    read -r -p "按 Enter 結束..."
    exit 1
fi

echo "[OK] Node.js $(node -v) 已就緒"
echo

if [ ! -d "node_modules" ]; then
    echo "[首次執行] 正在安裝必要元件，請稍候（約 1-3 分鐘）..."
    npm ci || { echo "[錯誤] 安裝失敗，請檢查網路後重試。"; read -r -p "按 Enter 結束..."; exit 1; }
    echo "[OK] 元件安裝完成"
    echo
else
    echo "[OK] 元件已安裝，直接啟動"
    echo
fi

# 安裝根目錄依賴（評估器需要），跳過 Chromium 下載
cd "$(dirname "$0")/.."
if [ ! -d "node_modules/@google/generative-ai" ]; then
    echo "[首次執行] 正在安裝評估器元件..."
    npm install --ignore-scripts || { echo "[錯誤] 評估器元件安裝失敗。"; read -r -p "按 Enter 結束..."; exit 1; }
    echo "[OK] 評估器元件安裝完成"
    echo
fi
cd "$(dirname "$0")/../web"

echo "正在啟動，瀏覽器會自動開啟..."
echo "使用期間請「不要關閉」這個視窗。要結束時關閉此視窗即可。"
echo

( sleep 3; xdg-open "http://localhost:3100" 2>/dev/null || true ) &
npm run dev -- -p 3100

echo
echo "伺服器已停止。"
read -r -p "按 Enter 結束..."
