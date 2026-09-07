#!/bin/bash
# 求職助手 career-ops 啟動器（Mac）
# 雙擊即可執行；若無法執行，請在終端機執行：chmod +x start.command

cd "$(dirname "$0")/../web" || { echo "找不到 web 資料夾"; exit 1; }

echo "============================================"
echo " 求職助手 career-ops 啟動器"
echo "============================================"
echo

# 1. 檢查 Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "[錯誤] 未偵測到 Node.js。"
    echo "請先安裝 Node.js（免費）：https://nodejs.org/"
    echo "下載 LTS 版本安裝後，重新雙擊本檔案。"
    open "https://nodejs.org/"
    read -r -p "按 Enter 結束..."
    exit 1
fi

# 2. 檢查版本 >= 22
NODEMAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODEMAJOR" -lt 22 ]; then
    echo "[錯誤] Node.js 版本需 22 以上，目前是 $(node -v)。"
    echo "請到 https://nodejs.org/ 下載最新 LTS 版本。"
    open "https://nodejs.org/"
    read -r -p "按 Enter 結束..."
    exit 1
fi

echo "[OK] Node.js $(node -v) 已就緒"
echo

# 3. 首次安裝依賴
if [ ! -d "node_modules" ]; then
    echo "[首次執行] 正在安裝必要元件，請稍候（約 1-3 分鐘）..."
    npm ci || { echo "[錯誤] 安裝失敗，請檢查網路後重試。"; read -r -p "按 Enter 結束..."; exit 1; }
    echo "[OK] 元件安裝完成"
    echo
else
    echo "[OK] 元件已安裝，直接啟動"
    echo
fi

echo "正在啟動，瀏覽器會自動開啟..."
echo "使用期間請「不要關閉」這個視窗。要結束時關閉此視窗即可。"
echo

# 4. 延遲開瀏覽器 + 啟動伺服器
( sleep 3; open "http://localhost:3000" ) &
npm run dev

echo
echo "伺服器已停止。"
read -r -p "按 Enter 結束..."
