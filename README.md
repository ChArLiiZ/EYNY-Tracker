# EYNY Tracker

> Violentmonkey / Tampermonkey userscript，追蹤管理 EYNY 論壇帖子的觀看與下載狀態。

## 功能

- **狀態追蹤** — 將帖子標記為 ⭐ 待看、👁 已看、⬇ 已下載、🚫 略過
- **浮動面板** — 統一管理所有已追蹤的帖子，支援搜尋、篩選、排序
- **縮圖預覽** — 自動擷取列表頁縮圖，支援批次補抓
- **拖曳排序** — 自訂排序模式下可拖曳或輸入順位調整順序
- **批次操作** — 點擊縮圖多選，一次變更狀態或刪除
- **備註功能** — 為每篇帖子加入文字備註
- **鍵盤快捷鍵** — 在帖子頁按 `1`~`4` 快速設定狀態，`0` 清除
- **復原操作** — 刪除、清空、批次操作後可透過 Toast 通知復原
- **匯出/匯入** — JSON 格式匯出匯入，支援預覽與統計
- **一鍵略過** — 在列表頁底部一鍵將未分類帖子設為略過

## 安裝

1. 安裝瀏覽器擴充套件 [Violentmonkey](https://violentmonkey.github.io/) 或 [Tampermonkey](https://www.tampermonkey.net/)
2. 下載 `dist/eyny-tracker.user.js`，在擴充套件中安裝
3. 前往 EYNY 論壇即可使用

## 開發

```bash
# 安裝依賴
npm install

# 打包（產出至 dist/eyny-tracker.user.js）
npm run build

# Watch 模式
npm run dev
```

### 技術

- **原始碼**：ES modules（`src/`）
- **打包**：esbuild → 單一 IIFE `.user.js`
- **儲存**：Violentmonkey GM_getValue / GM_setValue（自動從 localStorage 遷移）
- **UI**：Glassmorphism 暗色主題浮動面板 + 論壇頁亮色適配

## 截圖

_TODO_

## License

MIT
