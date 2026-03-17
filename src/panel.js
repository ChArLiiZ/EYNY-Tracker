import { PANEL_ID, TOGGLE_ID, VALID_STATUSES } from './constants.js';
import { statusLabel, statusColor } from './constants.js';
import { getDB, setDB, saveDB, getEntry, normalizeEntry, upsert, removeEntry } from './db.js';
import { formatTime } from './utils.js';
import { createButton, makePlaceholderThumb } from './ui-helpers.js';
import { fetchMissingThumbsFromCurrentPage, fetchAllMissingThumbs } from './thumbnail.js';

const uiState = { expanded: {} };

function isExpanded(threadId) {
  return !!uiState.expanded[threadId];
}

function setExpanded(threadId, value) {
  uiState.expanded[threadId] = !!value;
  renderPanel();
}

function getManualOrderedIds() {
  const db = getDB();
  return Object.values(db)
    .filter(item => (item.status && VALID_STATUSES.includes(item.status)) || (item.note && String(item.note).trim()))
    .sort((a, b) => (a.manualOrder ?? 999999) - (b.manualOrder ?? 999999))
    .map(x => x.threadId);
}

function renumberManualOrder(ids) {
  const db = getDB();
  ids.forEach((id, idx) => {
    if (db[id]) db[id].manualOrder = idx;
  });
  saveDB();
}

function moveManualOrder(threadId, direction) {
  const ids = getManualOrderedIds();
  const idx = ids.indexOf(threadId);
  if (idx < 0) return;
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= ids.length) return;
  [ids[idx], ids[target]] = [ids[target], ids[idx]];
  renumberManualOrder(ids);
  renderPanel();
}

function setManualOrderPosition(threadId, position) {
  const ids = getManualOrderedIds();
  const idx = ids.indexOf(threadId);
  if (idx < 0) return;
  let pos = Number(position);
  if (!Number.isFinite(pos)) return;
  pos = Math.max(1, Math.min(ids.length, Math.floor(pos)));
  const [item] = ids.splice(idx, 1);
  ids.splice(pos - 1, 0, item);
  renumberManualOrder(ids);
  renderPanel();
}

function sortItems(items, mode, direction = 'desc') {
  const arr = [...items];
  const factor = direction === 'asc' ? 1 : -1;
  const byTitle = (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hant') * factor;
  const byStatus = (a, b) => String(a.status || '').localeCompare(String(b.status || ''), 'zh-Hant') * factor;
  const byDate = (field) => (a, b) => String(a[field] || '').localeCompare(String(b[field] || '')) * factor;
  const byManual = (a, b) => ((a.manualOrder ?? 999999) - (b.manualOrder ?? 999999));

  switch (mode) {
    case 'created': arr.sort(byDate('createdAt')); break;
    case 'title': arr.sort(byTitle); break;
    case 'status': arr.sort((a, b) => byStatus(a, b) || byDate('updatedAt')(a, b)); break;
    case 'manual': arr.sort(byManual); break;
    case 'updated':
    default:
      arr.sort(byDate('updatedAt'));
      break;
  }
  return arr;
}

export function ensurePanel(refreshUI) {
  if (!document.getElementById(TOGGLE_ID)) {
    const toggle = document.createElement('button');
    toggle.id = TOGGLE_ID;
    toggle.type = 'button';
    toggle.textContent = '📚 我的清單';
    toggle.addEventListener('click', () => {
      const panel = document.getElementById(PANEL_ID);
      if (panel) panel.classList.toggle('show');
    });
    document.body.appendChild(toggle);
  }

  if (!document.getElementById(PANEL_ID)) {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <header>
        <div>我的清單</div>
        <div class="kuro-row-actions">
          <button type="button" class="kuro-btn kuro-toggle-max">⤢ 寬版</button>
        </div>
      </header>
      <div class="body">
        <div class="kuro-toolbar">
          <input type="text" placeholder="搜尋標題/備註" class="kuro-search">
          <select class="kuro-filter">
            <option value="">全部</option>
            <option value="todo">待看</option>
            <option value="seen">已看</option>
            <option value="downloaded">已下載</option>
          </select>
        </div>
        <div class="kuro-toolbar-secondary">
          <select class="kuro-sort">
            <option value="manual" selected>自訂排序</option>
            <option value="updated">最近更新</option>
            <option value="created">最近加入</option>
            <option value="title">標題</option>
            <option value="status">狀態</option>
          </select>
          <select class="kuro-sort-dir">
            <option value="desc">↓ 倒序</option>
            <option value="asc">↑ 正序</option>
          </select>
          <div class="kuro-mini kuro-summary-bar"></div>
        </div>
        <div class="kuro-actions-grid">
          <button type="button" class="kuro-btn kuro-fetch-missing-thumbs">🖼 補抓本頁缺圖</button>
          <button type="button" class="kuro-btn kuro-fetch-all-thumbs">🖼 全部補抓縮圖</button>
          <button type="button" class="kuro-btn kuro-export">匯出 JSON</button>
          <button type="button" class="kuro-btn kuro-import">匯入 JSON</button>
          <button type="button" class="kuro-btn kuro-clear-all">清空全部資料</button>
          <button type="button" class="kuro-btn kuro-hard-reset">重置所有版本資料</button>
        </div>
        <div class="kuro-list"></div>
        <div class="kuro-row-actions kuro-pager">
          <button type="button" class="kuro-btn kuro-prev-page">上一頁</button>
          <div class="kuro-mini kuro-page-info">第 1 / 1 頁</div>
          <button type="button" class="kuro-btn kuro-next-page">下一頁</button>
        </div>
        <input type="file" class="kuro-import-file" style="display:none" accept="application/json">
      </div>
    `;
    document.body.appendChild(panel);

    panel.dataset.page = '1';
    panel.querySelector('.kuro-toggle-max').addEventListener('click', () => {
      panel.classList.toggle('max');
    });
    panel.querySelector('.kuro-search').addEventListener('input', () => { panel.dataset.page = '1'; renderPanel(); });
    panel.querySelector('.kuro-filter').addEventListener('change', () => { panel.dataset.page = '1'; renderPanel(); });
    panel.querySelector('.kuro-sort').addEventListener('change', () => { panel.dataset.page = '1'; renderPanel(); });
    panel.querySelector('.kuro-sort-dir').addEventListener('change', () => { panel.dataset.page = '1'; renderPanel(); });
    panel.querySelector('.kuro-prev-page').addEventListener('click', () => {
      const current = Number(panel.dataset.page || '1');
      panel.dataset.page = String(Math.max(1, current - 1));
      renderPanel();
    });
    panel.querySelector('.kuro-next-page').addEventListener('click', () => {
      const current = Number(panel.dataset.page || '1');
      panel.dataset.page = String(current + 1);
      renderPanel();
    });
    panel.querySelector('.kuro-fetch-missing-thumbs').addEventListener('click', () => {
      fetchMissingThumbsFromCurrentPage(refreshUI);
    });
    panel.querySelector('.kuro-fetch-all-thumbs').addEventListener('click', async () => {
      const ok = confirm('要開始從論壇列表頁批次補抓全部缺少縮圖的項目嗎？這可能會花一點時間。');
      if (!ok) return;
      await fetchAllMissingThumbs(refreshUI);
    });
    panel.querySelector('.kuro-export').addEventListener('click', () => {
      const db = getDB();
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `eyny-tracker-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    panel.querySelector('.kuro-import').addEventListener('click', () => {
      panel.querySelector('.kuro-import-file').click();
    });
    panel.querySelector('.kuro-clear-all').addEventListener('click', () => {
      const ok = confirm('確定要清空目前版本的清單資料嗎？');
      if (!ok) return;
      setDB({});
      saveDB();
      refreshUI();
    });
    panel.querySelector('.kuro-hard-reset').addEventListener('click', () => {
      const ok = confirm('確定要重置所有版本資料嗎？這會刪除 v1 / v2 的 localStorage 紀錄，且無法復原。');
      if (!ok) return;
      try {
        localStorage.removeItem('kuro_eyny_tracker_v1');
        localStorage.removeItem('kuro_eyny_tracker_v2');
      } catch {}
      setDB({});
      saveDB();
      alert('已重置所有版本資料，頁面將重新整理。');
      location.reload();
    });
    panel.querySelector('.kuro-import-file').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const imported = JSON.parse(text);
        const db = getDB();
        setDB({ ...db, ...imported });
        saveDB();
        refreshUI();
      } catch {
        alert('匯入失敗');
      }
    });
  }
}

export function renderPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const db = getDB();
  const search = panel.querySelector('.kuro-search')?.value?.trim().toLowerCase() || '';
  const filter = panel.querySelector('.kuro-filter')?.value || '';
  const sortMode = panel.querySelector('.kuro-sort')?.value || 'manual';
  const sortDir = panel.querySelector('.kuro-sort-dir')?.value || 'desc';
  const list = panel.querySelector('.kuro-list');
  if (!list) return;

  let items = Object.values(db)
    .filter(item => (item.status && VALID_STATUSES.includes(item.status)) || (item.note && String(item.note).trim()))
    .filter(item => !filter || item.status === filter)
    .filter(item => !search || `${item.title || ''} ${item.note || ''}`.toLowerCase().includes(search));

  if (sortMode === 'manual') {
    const needsInit = items.length > 0 && items.every(item => item.manualOrder === undefined || item.manualOrder === null || item.manualOrder === 999999);
    if (needsInit) {
      const seeded = [...items].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      seeded.forEach((item, idx) => {
        if (db[item.threadId]) db[item.threadId].manualOrder = idx;
      });
      saveDB();
      items = Object.values(db)
        .filter(item => (item.status && VALID_STATUSES.includes(item.status)) || (item.note && String(item.note).trim()))
        .filter(item => !filter || item.status === filter)
        .filter(item => !search || `${item.title || ''} ${item.note || ''}`.toLowerCase().includes(search));
    }
  }

  items = sortItems(items, sortMode, sortDir);
  const usePagination = sortMode !== 'manual';
  const perPage = 10;
  const totalPages = usePagination ? Math.max(1, Math.ceil(items.length / perPage)) : 1;
  let currentPage = Number(panel.dataset.page || '1');
  if (!Number.isFinite(currentPage) || currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  panel.dataset.page = String(currentPage);
  const start = usePagination ? (currentPage - 1) * perPage : 0;
  const pagedItems = usePagination ? items.slice(start, start + perPage) : items;

  const pageInfo = panel.querySelector('.kuro-page-info');
  if (pageInfo) pageInfo.textContent = usePagination ? `第 ${currentPage} / ${totalPages} 頁` : '自訂排序模式';
  const pager = panel.querySelector('.kuro-pager');
  if (pager) pager.style.display = usePagination ? 'flex' : 'none';
  const dirSelect = panel.querySelector('.kuro-sort-dir');
  if (dirSelect) dirSelect.disabled = sortMode === 'manual';
  const summaryBar = panel.querySelector('.kuro-summary-bar');
  if (summaryBar) {
    const todoCount = items.filter(x => x.status === 'todo').length;
    const seenCount = items.filter(x => x.status === 'seen').length;
    const downloadedCount = items.filter(x => x.status === 'downloaded').length;
    summaryBar.textContent = `共 ${items.length} 筆 · 待看 ${todoCount} · 已看 ${seenCount} · 已下載 ${downloadedCount}` + (usePagination ? ` · 本頁 ${pagedItems.length} 筆` : ' · 可用上下鍵自訂排序');
  }
  const prevBtn = panel.querySelector('.kuro-prev-page');
  const nextBtn = panel.querySelector('.kuro-next-page');
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  list.replaceChildren();

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'kuro-mini';
    empty.textContent = '清單是空的。';
    list.appendChild(empty);
    return;
  }

  pagedItems.forEach(item => {
    const expanded = isExpanded(item.threadId);
    const box = document.createElement('div');
    box.className = 'kuro-item' + (expanded ? ' expanded' : '');
    box.dataset.threadId = item.threadId;

    let handleCol = document.createElement('div');
    if (sortMode === 'manual') {
      const tools = document.createElement('div');
      tools.className = 'kuro-order-tools';
      const currentIndex = pagedItems.findIndex(x => x.threadId === item.threadId);
      const orderWrap = document.createElement('div');
      orderWrap.style.display = 'flex';
      orderWrap.style.alignItems = 'center';
      orderWrap.style.gap = '4px';
      const orderLabel = document.createElement('span');
      orderLabel.className = 'kuro-order-label';
      orderLabel.textContent = '#';
      const posInput = document.createElement('input');
      posInput.type = 'number';
      posInput.min = '1';
      posInput.max = String(pagedItems.length);
      posInput.value = String(currentIndex + 1);
      posInput.className = 'kuro-order-input';
      posInput.title = '輸入順位';
      const commitPosition = () => setManualOrderPosition(item.threadId, posInput.value);
      posInput.addEventListener('change', commitPosition);
      posInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitPosition();
        }
      });
      orderWrap.appendChild(orderLabel);
      orderWrap.appendChild(posInput);
      const upBtn = createButton('↑', () => moveManualOrder(item.threadId, 'up'), false, false, '上移');
      const downBtn = createButton('↓', () => moveManualOrder(item.threadId, 'down'), false, false, '下移');
      if (currentIndex === 0) upBtn.disabled = true;
      if (currentIndex === pagedItems.length - 1) downBtn.disabled = true;
      tools.appendChild(orderWrap);
      tools.appendChild(upBtn);
      tools.appendChild(downBtn);
      handleCol.appendChild(tools);
    }
    box.appendChild(handleCol);

    let thumbWrap;
    if (item.thumb) {
      thumbWrap = document.createElement('div');
      thumbWrap.className = 'kuro-thumb';
      const img = document.createElement('img');
      img.src = item.thumb;
      img.alt = item.title || 'thumb';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => {
        thumbWrap.replaceWith(makePlaceholderThumb());
      };
      thumbWrap.appendChild(img);
    } else {
      thumbWrap = makePlaceholderThumb();
    }
    box.appendChild(thumbWrap);

    const content = document.createElement('div');

    const summary = document.createElement('div');
    summary.className = 'kuro-item-summary';

    const left = document.createElement('div');
    const titleLine = document.createElement('div');
    titleLine.className = 'kuro-title-line';
    const titleLink = document.createElement('a');
    titleLink.href = item.url;
    titleLink.target = '_self';
    titleLink.innerHTML = `<strong>${item.title || ''}</strong>`;
    titleLine.appendChild(titleLink);
    left.appendChild(titleLine);
    const meta = document.createElement('div');
    meta.className = 'kuro-status-line';
    const badge = document.createElement('span');
    badge.className = 'kuro-badge';
    badge.textContent = statusLabel[item.status] || '未分類';
    badge.style.background = statusColor[item.status] || '#9ca3af';
    meta.appendChild(badge);
    const updated = document.createElement('span');
    updated.className = 'kuro-mini';
    updated.textContent = `更新 ${formatTime(item.updatedAt)}`;
    meta.appendChild(updated);
    left.appendChild(meta);

    const right = document.createElement('button');
    right.type = 'button';
    right.className = 'kuro-btn kuro-collapse-hint';
    right.textContent = expanded ? '收起 ▲' : '展開 ▼';
    right.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setExpanded(item.threadId, !expanded);
    });

    summary.appendChild(left);
    summary.appendChild(right);
    content.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'kuro-item-body';

    const metaDetail = document.createElement('div');
    metaDetail.className = 'kuro-meta kuro-mini';
    metaDetail.innerHTML = `
      <div>狀態：${statusLabel[item.status] || '未分類'}</div>
      <div>加入：${formatTime(item.createdAt)}</div>
      <div>更新：${formatTime(item.updatedAt)}</div>
    `;
    body.appendChild(metaDetail);

    const linkWrap = document.createElement('div');
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.textContent = '打開文章';
    linkWrap.appendChild(link);
    body.appendChild(linkWrap);

    const note = document.createElement('textarea');
    note.className = 'kuro-note-edit';
    note.placeholder = '備註...';
    note.value = item.note || '';
    note.addEventListener('change', () => {
      setExpanded(item.threadId, true);
      upsert(item.threadId, { ...item, note: note.value });
    });
    body.appendChild(note);

    const row = document.createElement('div');
    row.className = 'kuro-row-actions';
    row.appendChild(createButton('⭐ 待看', () => { setExpanded(item.threadId, true); upsert(item.threadId, { ...item, status: 'todo' }); }, item.status === 'todo'));
    row.appendChild(createButton('👁 已看', () => { setExpanded(item.threadId, true); upsert(item.threadId, { ...item, status: 'seen' }); }, item.status === 'seen'));
    row.appendChild(createButton('⬇ 已下載', () => { setExpanded(item.threadId, true); upsert(item.threadId, { ...item, status: 'downloaded' }); }, item.status === 'downloaded'));
    row.appendChild(createButton('❌ 清除', () => removeEntry(item.threadId)));
    body.appendChild(row);

    content.appendChild(body);
    box.appendChild(content);
    list.appendChild(box);
  });
}
