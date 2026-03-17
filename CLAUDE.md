# EYNY Tracker

EYNY 論壇的 Violentmonkey userscript，用於追蹤管理帖子的觀看/下載狀態。

## 專案結構

- `src/` — 原始碼（ES modules）
  - `main.js` — 入口，init 與 MutationObserver
  - `constants.js` — 常數、狀態定義、顏色
  - `utils.js` — 工具函式（時間格式化、thread ID 擷取）
  - `db.js` — localStorage CRUD、normalizeEntry
  - `style.js` — CSS 注入
  - `ui-helpers.js` — 按鈕建立、視覺狀態套用、進度條
  - `thumbnail.js` — 縮圖爬取邏輯
  - `scanner.js` — 頁面掃描、操作按鈕注入
  - `panel.js` — 浮動面板 UI、排序、分頁
- `dist/` — esbuild 打包產出（安裝到 Violentmonkey 用此檔案）
- `build.js` — esbuild 打包設定
- `eyny-tracker.user.js` — 舊版單檔（保留作參考）

## 指令

```bash
npm run build    # 打包到 dist/eyny-tracker.user.js
npm run dev      # watch 模式，存檔自動重新打包
```

## 開發注意事項

- 這是 Violentmonkey userscript，打包產出必須是單一 IIFE `.user.js` 檔案
- UserScript metadata block（`// ==UserScript==`）定義在 `build.js` 的 banner 中，修改 match 規則或版本號請改那裡
- `@grant none` — 在頁面 scope 執行，不使用 GM_* API
- 資料儲存在 `localStorage`，key 為 `kuro_eyny_tracker_v2`
- 所有模組之間透過 ES module import/export 連接，esbuild 打包時會 tree-shake 並合併為單檔
- 修改原始碼後需要重新 `npm run build`，再將 `dist/eyny-tracker.user.js` 安裝到 Violentmonkey
