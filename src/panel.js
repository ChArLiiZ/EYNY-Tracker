import { PANEL_ID, TOGGLE_ID, VALID_STATUSES } from './constants.js';
import { statusLabel, statusColor } from './constants.js';
import { getDB, setDB, saveDB, getEntry, normalizeEntry, upsert, removeEntry, loadUIState, saveUIState, deleteGMValue, beginBatch, endBatch } from './db.js';
import { formatTime, isoDateOnly } from './utils.js';
import { createButton, makePlaceholderThumb } from './ui-helpers.js';
import { fetchMissingThumbsFromCurrentPage, fetchAllMissingThumbs } from './thumbnail.js';
import { showToast } from './toast.js';
import { showSyncSettings, syncFull, getSyncConfig } from './sync.js';

const panelState = {
  expanded: {},
  selected: new Set(),
  dragId: null,
};

function isExpanded(threadId) {
  return !!panelState.expanded[threadId];
}

function setExpanded(threadId, value) {
  panelState.expanded[threadId] = !!value;
  persistUIState();
  renderPanel();
}

function persistUIState() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  saveUIState({
    sortMode: panel.querySelector('.kuro-sort')?.value || 'manual',
    sortDir: panel.querySelector('.kuro-sort-dir')?.value || 'desc',
    filter: panel.querySelector('.kuro-pill.active')?.dataset.filter || '',
    wideMode: panel.classList.contains('max'),
    expanded: Object.keys(panelState.expanded).filter(k => panelState.expanded[k]),
  });
}

function restoreUIState(panel) {
  const state = loadUIState();
  if (!state || typeof state !== 'object') return;
  if (state.sortMode) {
    const el = panel.querySelector('.kuro-sort');
    if (el) el.value = state.sortMode;
  }
  if (state.sortDir) {
    const el = panel.querySelector('.kuro-sort-dir');
    if (el) el.value = state.sortDir;
  }
  if (state.filter !== undefined) {
    const pills = panel.querySelectorAll('.kuro-pill');
    pills.forEach(p => {
      p.classList.toggle('active', p.dataset.filter === (state.filter || ''));
    });
  }
  if (state.wideMode) panel.classList.add('max');
  if (Array.isArray(state.expanded)) {
    state.expanded.forEach(id => { panelState.expanded[id] = true; });
  }
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

// Reorder within a given subset of IDs, then apply back to the full global order
function reorderWithinView(viewIds, mutator) {
  const globalIds = getManualOrderedIds();
  // Apply the mutation to the view subset
  const newViewIds = mutator(viewIds);
  if (!newViewIds) return;
  // Rebuild global list: replace positions that belong to the view subset
  const viewSet = new Set(viewIds);
  const result = [];
  let vi = 0;
  for (const gid of globalIds) {
    if (viewSet.has(gid)) {
      result.push(newViewIds[vi++]);
    } else {
      result.push(gid);
    }
  }
  renumberManualOrder(result);
  renderPanel();
}

function moveManualOrder(threadId, direction, viewIds) {
  reorderWithinView(viewIds, (ids) => {
    const idx = ids.indexOf(threadId);
    if (idx < 0) return null;
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= ids.length) return null;
    const copy = [...ids];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    return copy;
  });
}

function setManualOrderPosition(threadId, position, viewIds) {
  reorderWithinView(viewIds, (ids) => {
    const idx = ids.indexOf(threadId);
    if (idx < 0) return null;
    let pos = Number(position);
    if (!Number.isFinite(pos)) return null;
    pos = Math.max(1, Math.min(ids.length, Math.floor(pos)));
    const copy = [...ids];
    const [item] = copy.splice(idx, 1);
    copy.splice(pos - 1, 0, item);
    return copy;
  });
}

function handleDragDrop(fromId, toId, viewIds) {
  if (!fromId || !toId || fromId === toId) return;
  reorderWithinView(viewIds, (ids) => {
    const fromIdx = ids.indexOf(fromId);
    const toIdx = ids.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0) return null;
    const copy = [...ids];
    const [item] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, item);
    return copy;
  });
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

function showImportPreview(file, refreshUI) {
  file.text().then(text => {
    let imported;
    try {
      imported = JSON.parse(text);
    } catch {
      showToast('匯入失敗：JSON 格式錯誤', 'error');
      return;
    }

    if (!imported || typeof imported !== 'object') {
      showToast('匯入失敗：資料格式無效', 'error');
      return;
    }

    const db = getDB();
    const importIds = Object.keys(imported);
    const newCount = importIds.filter(id => !db[id]).length;
    const updateCount = importIds.filter(id => db[id]).length;
    const totalCount = importIds.length;

    const overlay = document.createElement('div');
    overlay.className = 'kuro-import-preview';
    overlay.innerHTML = `
      <div class="kuro-import-preview-content">
        <h3>匯入預覽</h3>
        <div class="kuro-import-stat"><span>匯入檔案中的項目</span><strong>${totalCount} 筆</strong></div>
        <div class="kuro-import-stat"><span>新增項目</span><strong>${newCount} 筆</strong></div>
        <div class="kuro-import-stat"><span>將覆蓋既有項目</span><strong>${updateCount} 筆</strong></div>
        <div class="kuro-import-stat"><span>目前清單項目數</span><strong>${Object.keys(db).length} 筆</strong></div>
        <div class="kuro-import-actions"></div>
      </div>
    `;

    const actions = overlay.querySelector('.kuro-import-actions');
    actions.appendChild(createButton('取消', () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
    }));
    actions.appendChild(createButton(`確認匯入 ${totalCount} 筆`, () => {
      setDB({ ...db, ...imported });
      saveDB();
      refreshUI();
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      showToast(`已匯入 ${totalCount} 筆（新增 ${newCount}，更新 ${updateCount}）`, 'success');
    }));

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('show'));
    });
  });
}

export function updateToggleCount() {
  const toggle = document.getElementById(TOGGLE_ID);
  if (!toggle) return;
  const db = getDB();
  const count = Object.values(db).filter(item =>
    (item.status && VALID_STATUSES.includes(item.status)) || (item.note && String(item.note).trim())
  ).length;
  let countEl = toggle.querySelector('.kuro-toggle-count');
  if (count > 0) {
    if (!countEl) {
      countEl = document.createElement('span');
      countEl.className = 'kuro-toggle-count';
      toggle.appendChild(countEl);
    }
    countEl.textContent = count;
  } else if (countEl) {
    countEl.remove();
  }
}

export function ensurePanel(refreshUI) {
  if (!document.getElementById(TOGGLE_ID)) {
    const toggle = document.createElement('button');
    toggle.id = TOGGLE_ID;
    toggle.type = 'button';
    toggle.innerHTML = '📚 我的清單';
    toggle.addEventListener('click', () => {
      const panel = document.getElementById(PANEL_ID);
      if (panel) {
        const wasHidden = !panel.classList.contains('show');
        panel.classList.toggle('show');
        if (wasHidden) renderPanel();
        persistUIState();
      }
    });
    document.body.appendChild(toggle);
  }

  if (!document.getElementById(PANEL_ID)) {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <header>
        <div>我的清單</div>
        <div class="kuro-row-actions" style="gap:8px">
          <button type="button" class="kuro-btn kuro-toggle-max">⤢ 寬版</button>
          <button type="button" class="kuro-close-btn" title="關閉">✕</button>
        </div>
      </header>
      <div class="body">
        <div class="kuro-toolbar">
          <input type="text" placeholder="搜尋標題/備註" class="kuro-search">
        </div>
        <div class="kuro-filter-pills"></div>
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
        </div>
        <div class="kuro-summary-bar"></div>
        <details class="kuro-advanced-filters">
          <summary>進階篩選</summary>
          <div class="kuro-filter-grid">
            <label>加入日期從 <input type="date" class="kuro-date-from"></label>
            <label>加入日期到 <input type="date" class="kuro-date-to"></label>
            <label><input type="checkbox" class="kuro-filter-no-thumb"> 僅缺少縮圖</label>
            <label><input type="checkbox" class="kuro-filter-has-note"> 僅有備註</label>
          </div>
        </details>
        <div class="kuro-batch-bar" style="display:none">
          <div class="kuro-mini kuro-batch-info">已選 0 筆</div>
          <button type="button" class="kuro-btn kuro-batch-todo">⭐ 待看</button>
          <button type="button" class="kuro-btn kuro-batch-seen">👁 已看</button>
          <button type="button" class="kuro-btn kuro-batch-downloaded">⬇ 已下載</button>
          <button type="button" class="kuro-btn kuro-batch-skipped">🚫 略過</button>
          <button type="button" class="kuro-btn kuro-batch-delete">❌ 刪除</button>
          <button type="button" class="kuro-btn kuro-batch-clear">取消選取</button>
        </div>
        <div class="kuro-actions-grid">
          <button type="button" class="kuro-btn kuro-sync-now">☁ 立即同步</button>
          <button type="button" class="kuro-btn kuro-sync-settings">⚙ 同步設定</button>
          <span class="kuro-sync-status"></span>
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

    // Create filter pills
    const pillsContainer = panel.querySelector('.kuro-filter-pills');
    const filters = [
      { value: '', label: '全部' },
      { value: 'todo', label: '⭐ 待看' },
      { value: 'seen', label: '👁 已看' },
      { value: 'downloaded', label: '⬇ 已下載' },
      { value: 'skipped', label: '🚫 略過' },
    ];
    filters.forEach(f => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'kuro-pill' + (f.value === '' ? ' active' : '');
      pill.dataset.filter = f.value;
      const labelSpan = document.createElement('span');
      labelSpan.textContent = f.label;
      const countSpan = document.createElement('span');
      countSpan.className = 'kuro-pill-count';
      countSpan.textContent = '0';
      pill.appendChild(labelSpan);
      pill.appendChild(countSpan);
      pill.addEventListener('click', () => {
        pillsContainer.querySelectorAll('.kuro-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        panel.dataset.page = '1';
        persistUIState();
        renderPanel();
      });
      pillsContainer.appendChild(pill);
    });

    restoreUIState(panel);

    panel.dataset.page = '1';
    panel.querySelector('.kuro-toggle-max').addEventListener('click', () => {
      panel.classList.toggle('max');
      persistUIState();
    });
    panel.querySelector('.kuro-close-btn').addEventListener('click', () => {
      panel.classList.remove('show');
    });
    let searchTimer = null;
    panel.querySelector('.kuro-search').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { panel.dataset.page = '1'; renderPanel(); }, 150);
    });
    panel.querySelector('.kuro-sort').addEventListener('change', () => { panel.dataset.page = '1'; persistUIState(); renderPanel(); });
    panel.querySelector('.kuro-sort-dir').addEventListener('change', () => { panel.dataset.page = '1'; persistUIState(); renderPanel(); });
    panel.querySelector('.kuro-date-from').addEventListener('change', () => { panel.dataset.page = '1'; renderPanel(); });
    panel.querySelector('.kuro-date-to').addEventListener('change', () => { panel.dataset.page = '1'; renderPanel(); });
    panel.querySelector('.kuro-filter-no-thumb').addEventListener('change', () => { panel.dataset.page = '1'; renderPanel(); });
    panel.querySelector('.kuro-filter-has-note').addEventListener('change', () => { panel.dataset.page = '1'; renderPanel(); });
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
      showToast('已匯出 JSON', 'success');
    });
    panel.querySelector('.kuro-import').addEventListener('click', () => {
      panel.querySelector('.kuro-import-file').click();
    });
    panel.querySelector('.kuro-clear-all').addEventListener('click', () => {
      const ok = confirm('確定要清空目前版本的清單資料嗎？');
      if (!ok) return;
      const dbSnapshot = { ...getDB() };
      setDB({});
      saveDB();
      refreshUI();
      showToast('已清空全部資料', 'info', 5000, {
        label: '復原',
        onClick: () => { setDB(dbSnapshot); saveDB(); refreshUI(); },
      });
    });
    panel.querySelector('.kuro-hard-reset').addEventListener('click', () => {
      const ok = confirm('確定要重置所有版本資料嗎？這會刪除 v1 / v2 的資料，且無法復原。');
      if (!ok) return;
      deleteGMValue('kuro_eyny_tracker_v1');
      deleteGMValue('kuro_eyny_tracker_v2');
      try {
        localStorage.removeItem('kuro_eyny_tracker_v1');
        localStorage.removeItem('kuro_eyny_tracker_v2');
      } catch {}
      setDB({});
      saveDB();
      showToast('已重置所有版本資料，頁面將重新整理', 'info');
      setTimeout(() => location.reload(), 800);
    });
    panel.querySelector('.kuro-sync-now').addEventListener('click', async () => {
      const cfg = getSyncConfig();
      if (!cfg.token || !cfg.gistId) {
        showSyncSettings();
        return;
      }
      const btn = panel.querySelector('.kuro-sync-now');
      btn.disabled = true;
      btn.textContent = '同步中...';
      try {
        await syncFull(false);
      } finally {
        btn.disabled = false;
        btn.textContent = '☁ 立即同步';
      }
    });
    panel.querySelector('.kuro-sync-settings').addEventListener('click', () => showSyncSettings());

    panel.querySelector('.kuro-import-file').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      showImportPreview(file, refreshUI);
      e.target.value = '';
    });

    // Batch action handlers
    const batchAction = (action) => {
      const ids = [...panelState.selected];
      if (!ids.length) return;
      beginBatch();
      if (action === 'delete') {
        const ok = confirm(`確定要刪除選取的 ${ids.length} 筆資料嗎？`);
        if (!ok) { endBatch(); return; }
        const snapshots = {};
        ids.forEach(id => { snapshots[id] = { ...getEntry(id) }; });
        ids.forEach(id => removeEntry(id));
        panelState.selected.clear();
        endBatch();
        showToast(`已刪除 ${ids.length} 筆`, 'info', 5000, {
          label: '復原',
          onClick: () => {
            beginBatch();
            Object.entries(snapshots).forEach(([id, data]) => upsert(id, data));
            endBatch();
          },
        });
      } else {
        const snapshots = {};
        ids.forEach(id => {
          const entry = getEntry(id);
          if (entry) {
            snapshots[id] = { ...entry };
            upsert(id, { ...entry, status: action });
          }
        });
        panelState.selected.clear();
        endBatch();
        showToast(`已將 ${ids.length} 筆設為${statusLabel[action]}`, 'success', 5000, {
          label: '復原',
          onClick: () => {
            beginBatch();
            Object.entries(snapshots).forEach(([id, data]) => upsert(id, data));
            endBatch();
          },
        });
      }
    };
    panel.querySelector('.kuro-batch-todo').addEventListener('click', () => batchAction('todo'));
    panel.querySelector('.kuro-batch-seen').addEventListener('click', () => batchAction('seen'));
    panel.querySelector('.kuro-batch-downloaded').addEventListener('click', () => batchAction('downloaded'));
    panel.querySelector('.kuro-batch-skipped').addEventListener('click', () => batchAction('skipped'));
    panel.querySelector('.kuro-batch-delete').addEventListener('click', () => batchAction('delete'));
    panel.querySelector('.kuro-batch-clear').addEventListener('click', () => {
      panelState.selected.clear();
      renderPanel();
    });
  }

  updateToggleCount();
}

export function renderPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  updateToggleCount();

  const db = getDB();
  const search = panel.querySelector('.kuro-search')?.value?.trim().toLowerCase() || '';
  const filter = panel.querySelector('.kuro-pill.active')?.dataset.filter || '';
  const sortMode = panel.querySelector('.kuro-sort')?.value || 'manual';
  const sortDir = panel.querySelector('.kuro-sort-dir')?.value || 'desc';
  const dateFrom = panel.querySelector('.kuro-date-from')?.value || '';
  const dateTo = panel.querySelector('.kuro-date-to')?.value || '';
  const noThumb = panel.querySelector('.kuro-filter-no-thumb')?.checked || false;
  const hasNote = panel.querySelector('.kuro-filter-has-note')?.checked || false;
  const list = panel.querySelector('.kuro-list');
  if (!list) return;

  // All valid items (before filter/search)
  const allItems = Object.values(db)
    .filter(item => (item.status && VALID_STATUSES.includes(item.status)) || (item.note && String(item.note).trim()));

  // Update pill counts
  const pills = panel.querySelectorAll('.kuro-pill');
  pills.forEach(pill => {
    const f = pill.dataset.filter;
    const count = f === '' ? allItems.length : allItems.filter(x => x.status === f).length;
    const countEl = pill.querySelector('.kuro-pill-count');
    if (countEl) countEl.textContent = count;
  });

  let items = allItems
    .filter(item => !filter || item.status === filter)
    .filter(item => !search || `${item.title || ''} ${item.note || ''}`.toLowerCase().includes(search))
    .filter(item => !dateFrom || isoDateOnly(item.createdAt) >= dateFrom)
    .filter(item => !dateTo || isoDateOnly(item.createdAt) <= dateTo)
    .filter(item => !noThumb || !item.thumb)
    .filter(item => !hasNote || (item.note && String(item.note).trim()));

  if (sortMode === 'manual') {
    const needsInit = items.length > 0 && items.every(item => item.manualOrder === undefined || item.manualOrder === null);
    if (needsInit) {
      const seeded = [...items].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      seeded.forEach((item, idx) => {
        if (db[item.threadId]) db[item.threadId].manualOrder = idx;
      });
      saveDB();
      items = allItems
        .filter(item => !filter || item.status === filter)
        .filter(item => !search || `${item.title || ''} ${item.note || ''}`.toLowerCase().includes(search))
        .filter(item => !dateFrom || isoDateOnly(item.createdAt) >= dateFrom)
        .filter(item => !dateTo || isoDateOnly(item.createdAt) <= dateTo)
        .filter(item => !noThumb || !item.thumb)
        .filter(item => !hasNote || (item.note && String(item.note).trim()));
    }
  }

  items = sortItems(items, sortMode, sortDir);

  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  let currentPage = Number(panel.dataset.page || '1');
  if (!Number.isFinite(currentPage) || currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  panel.dataset.page = String(currentPage);
  const start = (currentPage - 1) * perPage;
  const pagedItems = items.slice(start, start + perPage);

  // Summary bar with stat visualization (#12)
  const pageInfo = panel.querySelector('.kuro-page-info');
  if (pageInfo) pageInfo.textContent = `第 ${currentPage} / ${totalPages} 頁`;
  const pager = panel.querySelector('.kuro-pager');
  if (pager) pager.style.display = totalPages > 1 ? 'flex' : 'none';
  const dirSelect = panel.querySelector('.kuro-sort-dir');
  if (dirSelect) dirSelect.disabled = sortMode === 'manual';
  const summaryBar = panel.querySelector('.kuro-summary-bar');
  if (summaryBar) {
    const todoCount = items.filter(x => x.status === 'todo').length;
    const seenCount = items.filter(x => x.status === 'seen').length;
    const downloadedCount = items.filter(x => x.status === 'downloaded').length;
    const skippedCount = items.filter(x => x.status === 'skipped').length;
    let text = `共 ${items.length} 筆 · 待看 ${todoCount} · 已看 ${seenCount} · 已下載 ${downloadedCount} · 略過 ${skippedCount}`;
    if (search || filter || dateFrom || dateTo || noThumb || hasNote) {
      text = `搜尋結果 ${items.length}/${allItems.length} 筆 · 待看 ${todoCount} · 已看 ${seenCount} · 已下載 ${downloadedCount} · 略過 ${skippedCount}`;
    }
    if (sortMode === 'manual') text += ' · 可拖曳排序';

    summaryBar.innerHTML = '';
    const textEl = document.createElement('div');
    textEl.textContent = text;
    summaryBar.appendChild(textEl);

    // Visual stat bar
    if (items.length > 0) {
      const statBar = document.createElement('div');
      statBar.className = 'kuro-stat-bar';
      const segments = [
        { count: todoCount, color: statusColor.todo },
        { count: seenCount, color: statusColor.seen },
        { count: downloadedCount, color: statusColor.downloaded },
        { count: skippedCount, color: statusColor.skipped },
      ];
      segments.forEach(seg => {
        if (seg.count <= 0) return;
        const div = document.createElement('div');
        div.className = 'kuro-stat-segment';
        div.style.width = `${(seg.count / items.length) * 100}%`;
        div.style.background = seg.color;
        statBar.appendChild(div);
      });
      summaryBar.appendChild(statBar);
    }
  }
  const prevBtn = panel.querySelector('.kuro-prev-page');
  const nextBtn = panel.querySelector('.kuro-next-page');
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  // Batch bar
  const batchBar = panel.querySelector('.kuro-batch-bar');
  if (batchBar) {
    if (panelState.selected.size > 0) {
      batchBar.style.display = 'flex';
      batchBar.querySelector('.kuro-batch-info').textContent = `已選 ${panelState.selected.size} 筆`;
    } else {
      batchBar.style.display = 'none';
    }
  }

  // Build cards using DocumentFragment (#2)
  const fragment = document.createDocumentFragment();

  // Empty state
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'kuro-empty-state';
    const hasFilters = search || filter || dateFrom || dateTo || noThumb || hasNote;
    if (hasFilters) {
      empty.innerHTML = `
        <div class="kuro-empty-icon">🔍</div>
        <div class="kuro-empty-text">沒有符合條件的項目<br>試試調整篩選條件</div>
      `;
    } else {
      empty.innerHTML = `
        <div class="kuro-empty-icon">📚</div>
        <div class="kuro-empty-text">清單是空的<br>在論壇列表頁點擊 ⭐ 開始追蹤帖子</div>
      `;
    }
    fragment.appendChild(empty);
    list.replaceChildren(fragment);
    return;
  }

  const viewIds = sortMode === 'manual' ? items.map(x => x.threadId) : null;

  pagedItems.forEach((item, pageIndex) => {
    const expanded = isExpanded(item.threadId);
    const box = document.createElement('div');
    box.className = 'kuro-item' + (expanded ? ' expanded' : '') + (sortMode === 'manual' ? ' kuro-item-manual' : '');
    box.dataset.threadId = item.threadId;

    // Order column (manual mode only)
    if (sortMode === 'manual') {
      const globalIndex = start + pageIndex;
      const orderCol = document.createElement('div');
      orderCol.className = 'kuro-order-col';

      const upBtn = createButton('↑', () => moveManualOrder(item.threadId, 'up', viewIds), false, false, '上移');
      const downBtn = createButton('↓', () => moveManualOrder(item.threadId, 'down', viewIds), false, false, '下移');
      if (globalIndex === 0) upBtn.disabled = true;
      if (globalIndex === items.length - 1) downBtn.disabled = true;

      const posInput = document.createElement('input');
      posInput.type = 'text';
      posInput.inputMode = 'numeric';
      posInput.pattern = '[0-9]*';
      posInput.value = String(globalIndex + 1);
      posInput.className = 'kuro-order-input';
      posInput.title = '輸入順位';
      const commitPosition = () => setManualOrderPosition(item.threadId, posInput.value, viewIds);
      posInput.addEventListener('change', commitPosition);
      posInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); posInput.blur(); commitPosition(); }
      });

      orderCol.appendChild(upBtn);
      orderCol.appendChild(posInput);
      orderCol.appendChild(downBtn);
      box.appendChild(orderCol);

      // Drag-and-drop
      box.draggable = true;
      box.addEventListener('dragstart', (e) => {
        panelState.dragId = item.threadId;
        box.classList.add('kuro-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.threadId);
      });
      box.addEventListener('dragend', () => {
        panelState.dragId = null;
        box.classList.remove('kuro-dragging');
        list.querySelectorAll('.kuro-drag-over').forEach(el => el.classList.remove('kuro-drag-over'));
      });
      box.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (panelState.dragId && panelState.dragId !== item.threadId) {
          box.classList.add('kuro-drag-over');
        }
      });
      box.addEventListener('dragleave', () => {
        box.classList.remove('kuro-drag-over');
      });
      box.addEventListener('drop', (e) => {
        e.preventDefault();
        box.classList.remove('kuro-drag-over');
        const fromId = e.dataTransfer.getData('text/plain');
        if (fromId && fromId !== item.threadId) {
          handleDragDrop(fromId, item.threadId, viewIds);
        }
      });
    }

    // Thumbnail (click to toggle selection)
    let thumbWrap;
    if (item.thumb) {
      thumbWrap = document.createElement('div');
      thumbWrap.className = 'kuro-thumb';
      if (panelState.selected.has(item.threadId)) thumbWrap.classList.add('selected');
      const img = document.createElement('img');
      img.src = item.thumb.replace(/^http:\/\//i, 'https://');
      img.alt = item.title || 'thumb';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => {
        const ph = makePlaceholderThumb();
        if (panelState.selected.has(item.threadId)) ph.classList.add('selected');
        ph.addEventListener('click', thumbWrap._selectHandler);
        thumbWrap.replaceWith(ph);
      };
      thumbWrap.appendChild(img);
    } else {
      thumbWrap = makePlaceholderThumb();
      if (panelState.selected.has(item.threadId)) thumbWrap.classList.add('selected');
    }
    const updateBatchBar = () => {
      const bar = panel.querySelector('.kuro-batch-bar');
      if (bar) {
        if (panelState.selected.size > 0) {
          bar.style.display = 'flex';
          bar.querySelector('.kuro-batch-info').textContent = `已選 ${panelState.selected.size} 筆`;
        } else {
          bar.style.display = 'none';
        }
      }
    };
    thumbWrap._selectHandler = (e) => {
      e.stopPropagation();
      if (panelState.selected.has(item.threadId)) {
        panelState.selected.delete(item.threadId);
        thumbWrap.classList.remove('selected');
      } else {
        panelState.selected.add(item.threadId);
        thumbWrap.classList.add('selected');
      }
      updateBatchBar();
    };
    thumbWrap.addEventListener('click', thumbWrap._selectHandler);
    box.appendChild(thumbWrap);

    // Content
    const content = document.createElement('div');
    content.style.minWidth = '0';

    const summary = document.createElement('div');
    summary.className = 'kuro-item-summary';

    const left = document.createElement('div');
    left.style.minWidth = '0';
    const titleLine = document.createElement('div');
    titleLine.className = 'kuro-title-line';
    const titleLink = document.createElement('a');
    titleLink.href = item.url;
    titleLink.target = '_self';
    titleLink.title = item.title || '';
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

    // Note preview when collapsed (#11)
    if (!expanded && item.note && String(item.note).trim()) {
      const notePreview = document.createElement('div');
      notePreview.className = 'kuro-note-preview';
      notePreview.textContent = '📝 ' + String(item.note).trim().replace(/\n/g, ' ');
      left.appendChild(notePreview);
    }

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

    // Inline note editing
    const note = document.createElement('textarea');
    note.className = 'kuro-note-edit';
    note.placeholder = '備註...';
    note.value = item.note || '';
    note.addEventListener('change', () => {
      panelState.expanded[item.threadId] = true;
      upsert(item.threadId, { ...item, note: note.value });
      showToast('備註已儲存', 'success');
    });
    body.appendChild(note);

    // Status buttons with active highlight
    const row = document.createElement('div');
    row.className = 'kuro-row-actions';
    row.appendChild(createButton('⭐ 待看', () => {
      panelState.expanded[item.threadId] = true;
      upsert(item.threadId, { ...item, status: 'todo' });
    }, item.status === 'todo'));
    row.appendChild(createButton('👁 已看', () => {
      panelState.expanded[item.threadId] = true;
      upsert(item.threadId, { ...item, status: 'seen' });
    }, item.status === 'seen'));
    row.appendChild(createButton('⬇ 已下載', () => {
      panelState.expanded[item.threadId] = true;
      upsert(item.threadId, { ...item, status: 'downloaded' });
    }, item.status === 'downloaded'));
    row.appendChild(createButton('🚫 略過', () => {
      panelState.expanded[item.threadId] = true;
      upsert(item.threadId, { ...item, status: 'skipped' });
    }, item.status === 'skipped'));
    row.appendChild(createButton('❌ 清除', () => {
      const snapshot = { ...item };
      removeEntry(item.threadId);
      showToast('已從清單中移除', 'info', 5000, {
        label: '復原',
        onClick: () => upsert(snapshot.threadId, snapshot),
      });
    }));
    body.appendChild(row);

    content.appendChild(body);
    box.appendChild(content);
    fragment.appendChild(box);
  });

  list.replaceChildren(fragment);
}
