# 開發紀錄（DEVLOG）

> 本檔案記錄「非技術人士改造」的進度，讓下次接手一看就知道做了什麼、接下來要做什麼。
> 目標：讓完全不懂程式的人，也能用 career-ops 掃職缺、評估、客製化 CV、追蹤應徵。

---

## 專案背景

- 原始專案：`career-ops-hq/career-ops`（開源 AI 求職工具，本機執行）
- 本 fork：`victoria304040/career-ops`（個人使用，不回饋上游）
- 改造方向：**方案 A — 本機網頁應用**（專案已有 `web/` Next.js 應用，補缺口而非重做）

### 核心發現（重要）

專案**已經有 80% 的網頁版**（`web/` 目錄，Next.js 16 + React 19）。真正的差距是三個缺口：

1. 啟動太技術（要 `cd web && npm ci && npm run dev`）
2. 評估綁 AI CLI（`/api/run` 靠 `spawnHeadlessCli` 呼叫 Claude Code 等）
3. 要裝 Node 22+

---

## ✅ 已完成事項

### 1. 三平台雙擊啟動器（`launcher/`）

| 檔案 | 平台 |
|---|---|
| `launcher/start.bat` | Windows |
| `launcher/start.command` | Mac |
| `launcher/start.sh` | Linux |

功能：自動檢查 Node ≥ 22 → 首次自動 `npm ci` → 啟動 web 伺服器 → 3 秒後自動開瀏覽器。全程中文提示。

### 2. AI 評估端點（`web/src/app/api/eval/route.ts`）

新增 `/api/eval`，包裝三個**獨立評估器**（不需要 AI CLI）：

- `gemini-eval.mjs`（Google Gemini，有免費額度）
- `openai-eval.mjs`（任何 OpenAI 相容端點）
- `ollama-eval.mjs`（本機 Ollama，免費離線）

設計重點：
- 用 `--file` 傳 JD（寫入暫存檔），避免命令列長度限制和 shell 注入
- 評估器**自己寫** `reports/` 和 tracker，符合 web 三鐵律「只編排核心、不重寫」
- key 只透過 env 傳給子程序、不落盤

### 3. 架構設計文件（`非技術人士改造架構設計.md`）

完整記錄改造目標、現有架構、三個改造模組、Roadmap、風險。

---

## 🔧 進行中（尚未完成）

### config-form.tsx 接線（AI 後端選擇 UI）

- 現況：`web/src/components/config-form.tsx` 的「Paste an AI key」和「No setup needed」選項目前是 `disabled`（寫著 "Coming soon"）
- 要做：啟用選項，讓使用者選 Gemini / OpenAI 相容 / Ollama 三種後端，加 key 輸入欄位 + 模型選擇 + 測試連線按鈕
- **已確認的決策**：key 用**做法 A**（寫入 root 的 `.env`，新增 `/api/config/key` 端點原子寫入），符合專案安全原則（評估器本來就用 dotenv 讀 `.env`）

---

## ⏭ 下一步待辦

- [ ] 新增 `/api/config/key` 端點（原子寫入 root `.env`，只寫 key 相關欄位，不覆蓋其他設定）
- [ ] 改 `config-form.tsx`：啟用「Paste an AI key」模式，接上 `/api/eval` 和 `/api/config/key`
- [ ] 加「測試連線」按鈕（驗證 key 有效）
- [ ] 找一個非技術人士，從零開始雙擊啟動 → 掃描 → 評估 → 看報告（驗證 MVP）

### Phase 2（體驗打磨，之後再做）

- [ ] 啟動器加「環境健康檢查」畫面（重用 `doctor.mjs`）
- [ ] 中文化關鍵介面（現有 UI 是英文）
- [ ] 可攜式資料夾（內建 node.exe，零安裝）—— 這是「雙擊即用」的真正解法

### Phase 3（選配）

- [ ] 打包免安裝 `.exe`（暫緩，Next.js + Playwright 打包有硬傷，見架構設計文件）

---

## ⚠️ 注意事項

1. **web 三鐵律**（`web/AGENTS.md`，改 web 前必讀）：
   - 只編排核心、不重寫核心邏輯
   - Markdown 是唯一真相來源（`data/applications.md`、`cv.md`、`reports/`）
   - 永不自動送出應徵

2. **評估器介面**（三個 `.mjs` 都一樣）：
   - 用 `CAREER_OPS_ROOT` 環境變數定位資料根
   - 接受 `--file`、`--model`、`--posting-url`、`--no-save` 參數
   - 自己寫 `reports/` 和 tracker（走核心單一寫入路徑）

3. **key 安全**：key 只存本機 `.env`，絕不上傳、不進 localStorage（現有程式碼註解明說 secret 不該存 clear-text localStorage）

4. **Node 版本**：`web/` 要求 Node ≥ 22（`web/package.json` 的 `engines.node`）

5. **單一 .exe 打包有硬傷**：Next.js 不能打包成單一 exe、Playwright 要下載 Chromium、核心有 128 個 .mjs 靠 spawn 呼叫。務實替代方案是「可攜式資料夾」（內建 node.exe）。

---

## 決策紀錄

| 日期 | 決策 | 理由 |
|---|---|---|
| 2026-09-07 | 採用方案 A（本機網頁應用） | 專案已有 80% 網頁版，改動最小 |
| 2026-09-07 | AI 後端支援多種（Gemini/Ollama/OpenAI） | 讓使用者選，非技術人士可用免費額度或本機模型 |
| 2026-09-07 | 預設 Gemini（免費額度），Ollama 當離線備援 | Gemini 有免費 tier，品質較本機小模型好 |
| 2026-09-07 | key 存 root `.env`（做法 A） | 符合專案安全原則，評估器本來就讀 `.env` |
| 2026-09-07 | 個人 fork 使用，不回饋上游 | 使用者決定 |
| 2026-09-07 | 第一階段只做啟動器（要裝 Node），暫緩 .exe | .exe 有硬傷，先驗證「非技術人士能用」 |
