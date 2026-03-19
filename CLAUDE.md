# EYNY Tracker

EYNY 論壇的 Violentmonkey userscript，用於追蹤管理帖子的觀看/下載狀態。

## 專案結構

- `src/` — 原始碼（ES modules）
  - `main.js` — 入口，init、MutationObserver（100ms 防抖）、鍵盤快捷鍵
  - `constants.js` — 常數、狀態定義（todo/seen/downloaded/skipped）、顏色
  - `utils.js` — 工具函式（時間格式化、thread ID 擷取）
  - `db.js` — GM_getValue/GM_setValue CRUD、batch 模式、normalizeEntry
  - `style.js` — CSS 注入（glassmorphism 暗色主題 + 論壇頁亮色適配）
  - `ui-helpers.js` — 按鈕建立、視覺狀態套用（差異更新）、進度條
  - `thumbnail.js` — 縮圖爬取邏輯（限流、指數退避、Set 去重）
  - `scanner.js` — 頁面掃描、操作按鈕注入、略過本頁未分類
  - `panel.js` — 浮動面板 UI、篩選藥丸、排序、分頁、批次操作、拖曳排序
  - `toast.js` — 非阻塞通知系統（支援復原按鈕）
- `build.js` — esbuild 打包設定（banner 含 UserScript metadata，版本號從 package.json 讀取）
- `.github/workflows/release.yml` — GitHub Actions：push tag 時自動 build + 建立 Release

## 指令

```bash
npm run build    # 打包到 dist/eyny-tracker.user.js
npm run dev      # watch 模式，存檔自動重新打包
```

## 發版流程

版本號統一由 `package.json` 的 `version` 欄位控制，`build.js` 會自動讀取並注入到 UserScript metadata。

```bash
# 1. 推送 tag 即可觸發 GitHub Actions 自動 build + 建立 Release
git tag v0.7.0
git push origin v0.7.0

# CI 會自動：
#   - 從 tag 名稱同步 package.json 版本號
#   - npm ci && npm run build
#   - 將 dist/eyny-tracker.user.js 上傳為 Release asset
```

- Release 產出的 `.user.js` 包含 `@downloadURL` / `@updateURL`，指向 GitHub Releases latest
- 使用者安裝後，Violentmonkey 會自動檢查更新

## 開發注意事項

- 這是 Violentmonkey userscript，打包產出必須是單一 IIFE `.user.js` 檔案
- UserScript metadata block（`// ==UserScript==`）定義在 `build.js` 的 banner 中，修改 match 規則請改那裡
- 版本號從 `package.json` 的 `version` 欄位讀取，不要在 `build.js` 中寫死版本號
- `@grant GM_getValue / GM_setValue / GM_deleteValue` — 使用 Violentmonkey 儲存 API
- 資料儲存在 GM storage，key 為 `kuro_eyny_tracker_v2`，首次載入會自動從 localStorage 遷移
- UI 偏好（排序、篩選、寬版模式）存在 `kuro_eyny_ui_state`
- 所有模組之間透過 ES module import/export 連接，esbuild 打包時會 tree-shake 並合併為單檔
- 修改原始碼後需要重新 `npm run build`，再將 `dist/eyny-tracker.user.js` 安裝到 Violentmonkey
- `dist/` 在 `.gitignore` 中，不進 git

## 效能設計

- `beginBatch()` / `endBatch()` — 批次操作時只觸發一次 saveDB + refreshUI
- `applyVisualToHost` 使用 `data-kuro-status` 追蹤狀態，未變更時跳過 DOM 操作
- MutationObserver 100ms 防抖 + 過濾自身注入的元素避免遞迴觸發
- 搜尋輸入框 150ms 防抖
- 面板隱藏時跳過 `renderPanel()`，開啟時才渲染
- 卡片列表使用 DocumentFragment 一次性寫入 DOM
- 論壇頁元素移除不必要的 `backdrop-filter: blur()` 減少 GPU 負擔

## 狀態定義

| 內部值 | 標籤 | 色碼 | 視覺效果 |
|--------|------|------|----------|
| `todo` | 待看 | `#f0c351` 金色 | 金色邊框發光 |
| `seen` | 已看 | `#6ec8f5` 亮藍 | 藍色邊框發光（最醒目） |
| `downloaded` | 已下載 | `#6b7280` 灰色 | 降低透明度（已完成） |
| `skipped` | 略過 | `#9b7280` 暗紅灰 | 降低透明度 + 微紅調 |
