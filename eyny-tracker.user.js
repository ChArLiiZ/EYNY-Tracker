// ==UserScript==
// @name         EYNY Tracker
// @namespace    kuro-eyny
// @version      0.4.0
// @description  待看/已看/已下載管理（v0.4）
// @match        https://www*.eyny.com/forum.php?*
// @match        https://www*.eyny.com/forum-*.html
// @match        https://www*.eyny.com/thread-*.html
// @match        https://www*.eyny.com/search.php*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const KEY = 'kuro_eyny_tracker_v2';
  const PANEL_ID = 'kuro-panel-root';
  const TOGGLE_ID = 'kuro-panel-toggle';
  const STYLE_ID = 'kuro-eyny-style';
  const VALID_STATUSES = ['todo', 'seen', 'downloaded'];
  const uiState = { expanded: {} };

  const statusLabel = {
    todo: '待看',
    seen: '已看',
    downloaded: '已下載',
  };

  const statusColor = {
    todo: '#f6c344',
    seen: '#8b949e',
    downloaded: '#3fb950',
  };

  function loadDB() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  let db = loadDB();

  function saveDB() {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  }

  function extractThreadId(url) {
    const m = String(url).match(/thread-(\d+)-/) || String(url).match(/[?&]tid=(\d+)/);
    return m ? m[1] : '';
  }

  function normalizeEntry(threadId, patch = {}) {
    const old = db[threadId] || {};
    const createdAt = old.createdAt || nowIso();
    const status = VALID_STATUSES.includes(patch.status) ? patch.status : (VALID_STATUSES.includes(old.status) ? old.status : '');
    return {
      ...old,
      ...patch,
      threadId,
      status,
      note: patch.note !== undefined ? patch.note : (old.note || ''),
      thumb: patch.thumb !== undefined ? patch.thumb : (old.thumb || ''),
      manualOrder: patch.manualOrder !== undefined ? patch.manualOrder : (old.manualOrder ?? 999999),
      createdAt,
      updatedAt: nowIso(),
    };
  }

  function upsert(threadId, patch) {
    if (!threadId) return;
    db[threadId] = normalizeEntry(threadId, patch);
    saveDB();
    refreshUI();
  }

  function removeEntry(threadId) {
    if (!threadId) return;
    delete db[threadId];
    saveDB();
    refreshUI();
  }

  function getEntry(threadId) {
    return db[threadId] || null;
  }

  function isExpanded(threadId) {
    return !!uiState.expanded[threadId];
  }

  function setExpanded(threadId, value) {
    uiState.expanded[threadId] = !!value;
    renderPanel();
  }

  function renumberManualOrder(ids) {
    ids.forEach((id, idx) => {
      if (db[id]) db[id].manualOrder = idx;
    });
    saveDB();
  }

  function getManualOrderedIds() {
    return Object.values(db)
      .filter(item => (item.status && VALID_STATUSES.includes(item.status)) || (item.note && String(item.note).trim()))
      .sort((a, b) => (a.manualOrder ?? 999999) - (b.manualOrder ?? 999999))
      .map(x => x.threadId);
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

  async function fetchThumbForTid(threadId, startUrl = location.origin + '/forum.php?mod=forumdisplay&fid=48', maxPages = 120, onProgress = null) {
    if (!threadId) return '';
    const visited = new Set();
    const queue = [startUrl];
    let scanned = 0;

    while (queue.length && scanned < maxPages) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);
      scanned += 1;
      if (onProgress) onProgress({ scanned, url });

      try {
        const res = await fetch(url, { credentials: 'include' });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // 如果被年齡確認頁擋住，跳過當前頁，但仍嘗試從頁內拿分頁連結
        const row = doc.querySelector(`tbody#normalthread_${threadId}`);
        if (row) {
          const thumb = extractListThumb(row);
          if (thumb) return thumb;
        }

        const nextLinks = [];
        doc.querySelectorAll('div.pg a[href]').forEach(link => {
          const href = link.getAttribute('href') || '';
          const text = (link.textContent || '').trim();
          if (!href || href.startsWith('javascript')) return;
          if (!/^\d+$/.test(text)) return;
          try {
            const abs = new URL(href, url).href;
            if (/forum(?:\.php\?mod=forumdisplay&fid=48|\-48\-)/.test(abs) && !visited.has(abs)) {
              nextLinks.push(abs);
            }
          } catch {}
        });

        for (const abs of nextLinks) {
          if (!visited.has(abs) && !queue.includes(abs)) queue.push(abs);
        }
      } catch {}
    }
    return '';
  }

  function extractListThumb(tb) {
    if (!tb) return '';
    const imgs = Array.from(tb.querySelectorAll('img'));
    for (const img of imgs) {
      const src = img.getAttribute('src') || img.getAttribute('file') || img.dataset?.src || '';
      const w = Number(img.getAttribute('width') || img.width || 0);
      const h = Number(img.getAttribute('height') || img.height || 0);
      if (!src) continue;
      if (/^(data:|javascript:)/i.test(src)) continue;
      if (/logo|icon|avatar|smiley|common\//i.test(src)) continue;
      if ((w && w < 40) || (h && h < 40)) continue;
      try {
        return new URL(src, location.href).href;
      } catch {
        return src;
      }
    }
    return '';
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .kuro-actions{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;align-items:center}
      .kuro-btn{border:1px solid #3a3f44;background:#16181a;color:#f3f4f6;border-radius:10px;padding:5px 10px;font-size:12px;cursor:pointer;line-height:1.6;transition:all .15s ease}
      .kuro-btn:hover{background:#202326;border-color:#4a5258}
      .kuro-btn.active{outline:2px solid #ffffff22;border-color:#6b7280}
      .kuro-icon-btn{border:1px solid #3a3f44;background:#16181a;color:#e5e7eb;border-radius:9px;padding:1px 6px;font-size:12px;cursor:pointer;line-height:1.5;min-width:28px;transition:all .15s ease}
      .kuro-icon-btn:hover{background:#202326;border-color:#4a5258}
      .kuro-icon-btn.active{outline:2px solid #ffffff22}
      .kuro-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:11px;color:#111;font-weight:700;margin-left:6px;letter-spacing:.2px}
      .kuro-seen{opacity:.55}
      .kuro-todo{box-shadow: inset 0 0 0 2px rgba(246,195,68,.45)}
      .kuro-downloaded{box-shadow: inset 0 0 0 2px rgba(63,185,80,.45)}
      #${TOGGLE_ID}{position:fixed;right:16px;bottom:16px;z-index:99999;background:#0f1113;color:#fff;border:1px solid #2f3338;border-radius:999px;padding:10px 16px;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.25)}
      #${PANEL_ID}{position:fixed;right:16px;bottom:60px;width:min(760px, calc(100vw - 32px));max-height:84vh;background:#0f1113;color:#fff;border:1px solid #2a2f35;border-radius:16px;z-index:99999;display:none;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.45)}
      #${PANEL_ID}.show{display:block}
      #${PANEL_ID}.max{width:min(1100px, calc(100vw - 32px));max-height:90vh}
      #${PANEL_ID} header{padding:14px 16px;border-bottom:1px solid #24292e;font-weight:700;font-size:15px;background:linear-gradient(180deg,#121519,#0f1113);display:flex;align-items:center;justify-content:space-between;gap:12px}
      #${PANEL_ID} .body{padding:14px 16px;overflow:auto;max-height:66vh}
      #${PANEL_ID}.max .body{max-height:72vh}
      #${PANEL_ID} input,#${PANEL_ID} select,#${PANEL_ID} textarea{width:100%;box-sizing:border-box;margin:6px 0;padding:8px;border-radius:8px;border:1px solid #444;background:#181a1b;color:#fff}
      .kuro-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 160px;gap:10px;align-items:center;margin-bottom:10px}
      .kuro-toolbar-secondary{display:grid;grid-template-columns:180px 130px 1fr;gap:10px;align-items:center;margin-bottom:10px}
      .kuro-order-tools{display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:flex-start}
      .kuro-order-tools .kuro-btn{padding:2px 8px;min-width:34px}
      .kuro-order-input{width:36px !important; margin:0 !important; padding:4px 4px !important; text-align:center; font-size:12px !important; -moz-appearance:textfield}
      .kuro-order-input::-webkit-outer-spin-button,
      .kuro-order-input::-webkit-inner-spin-button{appearance:none;-webkit-appearance:none;margin:0}
      .kuro-order-label{font-size:12px;color:#9ca3af;line-height:1}
      .kuro-actions-grid{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;margin-bottom:8px}
      .kuro-summary-bar{padding:8px 10px;background:#14181c;border:1px solid #232930;border-radius:10px;margin-bottom:10px}
      .kuro-item{border:1px solid #262b31;border-radius:14px;padding:10px;margin-bottom:10px;display:grid;grid-template-columns:22px 70px 1fr;gap:12px;background:#13161a}
      .kuro-thumb{width:70px;height:56px;background:#1a1d21;border:1px solid #2a2f35;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:11px;color:#777}
      .kuro-thumb img{width:100%;height:100%;object-fit:cover;display:block}
      .kuro-item a{color:#8fd1ff;text-decoration:none}
      .kuro-item a:hover{text-decoration:underline}
      .kuro-mini{font-size:12px;color:#9ca3af}
      .kuro-row-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
      .kuro-status-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}
      .kuro-title-line{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .kuro-title-line strong{font-size:14px;line-height:1.35}
      .kuro-note-edit{min-height:78px;resize:vertical;border-radius:10px}
      .kuro-meta{margin-top:6px;display:grid;gap:3px}
      .kuro-item-summary{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .kuro-item-body{display:none;margin-top:10px;padding-top:10px;border-top:1px solid #24292e}
      .kuro-item.expanded .kuro-item-body{display:block}
      .kuro-collapse-hint{font-size:12px;color:#888;white-space:nowrap}
      .kuro-progress{margin:8px 0;padding:8px;border:1px solid #333;border-radius:8px;background:#17191b}
      .kuro-progress-bar{height:8px;border-radius:999px;background:#2a2d31;overflow:hidden;margin-top:6px}
      .kuro-progress-fill{height:100%;width:0;background:#3fb950;transition:width .2s ease}
    `;
    document.head.appendChild(style);
  }

  function createButton(label, onClick, active = false, iconOnly = false, title = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = (iconOnly ? 'kuro-icon-btn' : 'kuro-btn') + (active ? ' active' : '');
    btn.textContent = label;
    if (title) btn.title = title;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  function ensureActionsForThread(host, thread, visualContainer, iconOnly = false, includeThumbFetch = false) {
    if (!host || !thread.threadId) return;
    if (host.querySelector(':scope > .kuro-actions')) return;

    const wrap = document.createElement('div');
    wrap.className = 'kuro-actions';
    wrap.dataset.threadId = thread.threadId;

    const basePatch = () => ({
      title: thread.title,
      url: thread.url,
      thumb: thread.thumb || guessThumb(visualContainer || host),
      note: getEntry(thread.threadId)?.note || '',
    });

    wrap.appendChild(createButton(iconOnly ? '⭐' : '⭐ 待看', () => {
      upsert(thread.threadId, { ...basePatch(), status: 'todo' });
    }, false, iconOnly, '待看'));

    wrap.appendChild(createButton(iconOnly ? '👁' : '👁 已看', () => {
      upsert(thread.threadId, { ...basePatch(), status: 'seen' });
    }, false, iconOnly, '已看'));

    wrap.appendChild(createButton(iconOnly ? '⬇' : '⬇ 已下載', () => {
      upsert(thread.threadId, { ...basePatch(), status: 'downloaded' });
    }, false, iconOnly, '已下載'));

    wrap.appendChild(createButton(iconOnly ? '📝' : '📝 備註', () => {
      const current = getEntry(thread.threadId);
      const note = prompt('備註', current?.note || '');
      if (note !== null) {
        upsert(thread.threadId, {
          ...basePatch(),
          status: current?.status || '',
          note,
        });
      }
    }, false, iconOnly, '備註'));

    if (includeThumbFetch) {
      wrap.appendChild(createButton(iconOnly ? '🖼' : '🖼 補抓此篇縮圖', async () => {
        const current = getEntry(thread.threadId) || {};
        setProgressState({ text: '正在補抓此篇縮圖…', percent: 5 });
        const thumb = await fetchThumbForTid(
          thread.threadId,
          `${location.origin}/forum.php?mod=forumdisplay&fid=48`,
          120,
          ({ scanned }) => setProgressState({ text: `正在補抓此篇縮圖… 已掃描 ${scanned} 頁`, percent: Math.min(95, scanned) })
        );
        if (thumb) {
          upsert(thread.threadId, { ...current, ...basePatch(), thumb });
          setProgressState({ text: '已補抓此篇縮圖', percent: 100 });
          setTimeout(() => setProgressState(null), 1500);
          alert('已補抓此篇縮圖。');
        } else {
          setProgressState(null);
          alert('找不到這篇的列表縮圖。可能沉得太後面，或該帖本來就沒有列表縮圖。');
        }
      }, false, iconOnly, '補抓此篇縮圖'));
    }

    wrap.appendChild(createButton(iconOnly ? '❌' : '❌ 清除', () => {
      removeEntry(thread.threadId);
    }, false, iconOnly, '清除'));

    host.appendChild(wrap);
  }

  function guessThumb(container) {
    if (!container) return '';
    if (container.tagName && container.tagName.toLowerCase() === 'tbody') {
      return extractListThumb(container);
    }
    return '';
  }

  function applyVisualToHost(host, threadId) {
    if (!host || !threadId) return;

    host.classList.remove('kuro-seen', 'kuro-todo', 'kuro-downloaded');
    host.querySelectorAll(':scope > .kuro-badge').forEach(el => el.remove());

    const entry = getEntry(threadId);
    if (!entry || !entry.status) return;

    const badge = document.createElement('span');
    badge.className = 'kuro-badge';
    badge.textContent = statusLabel[entry.status] || entry.status;
    badge.style.background = statusColor[entry.status] || '#999';
    host.appendChild(badge);

    if (entry.status === 'todo') host.classList.add('kuro-todo');
    if (entry.status === 'downloaded') {
      host.classList.add('kuro-downloaded');
      host.classList.add('kuro-seen');
    }

    const actions = host.querySelector(':scope > .kuro-actions');
    if (actions) {
      const btns = actions.querySelectorAll('button');
      btns.forEach(btn => btn.classList.remove('active'));
      const textMap = {
        todo: ['⭐', '⭐ 待看'],
        seen: ['👁', '👁 已看'],
        downloaded: ['⬇', '⬇ 已下載'],
      };
      btns.forEach(btn => {
        if ((textMap[entry.status] || []).includes(btn.textContent)) btn.classList.add('active');
      });
    }
  }

  function scanListPage() {
    document.querySelectorAll('tbody[id^="normalthread_"]').forEach(tb => {
      const a = tb.querySelector('a.s.xst, a.xst');
      if (!a) return;
      const threadId = extractThreadId(a.href) || tb.id.replace(/^\D+_/, '');
      if (!threadId) return;
      const host = a.parentElement || tb;
      const thread = {
        threadId,
        title: a.textContent.trim(),
        url: a.href,
        thumb: extractListThumb(tb),
      };

      const old = getEntry(threadId);
      if (old && thread.thumb && !old.thumb) {
        db[threadId] = normalizeEntry(threadId, { ...old, ...thread });
        saveDB();
      }

      ensureActionsForThread(host, thread, tb, true);
      applyVisualToHost(host, threadId);
    });
  }

  function scanSearchPage() {
    if (!/search\.php\?/.test(location.href)) return;

    const links = Array.from(document.querySelectorAll('a.xst, a.s.xst, a[href*="mod=viewthread"]'))
      .filter(a => {
        const href = a.getAttribute('href') || '';
        const text = (a.textContent || '').trim();
        return text && /mod=viewthread|thread-\d+-/i.test(href);
      });

    links.forEach(a => {
      const threadId = extractThreadId(a.href);
      if (!threadId) return;
      if (a.closest && a.closest(`#${PANEL_ID}`)) return;

      let host = a.closest('th');
      if (!host) host = a.parentElement;
      if (!host) return;

      const row = a.closest('tr') || host;
      const thread = {
        threadId,
        title: a.textContent.trim(),
        url: a.href,
        thumb: extractListThumb(row),
      };

      const old = getEntry(threadId);
      if (old && thread.thumb && !old.thumb) {
        db[threadId] = normalizeEntry(threadId, { ...old, ...thread });
        saveDB();
      }

      ensureActionsForThread(host, thread, row, true);
      applyVisualToHost(host, threadId);
    });
  }

  function scanThreadPage() {
    const titleEl = document.querySelector('#thread_subject') || document.querySelector('h1');
    if (!titleEl) return;
    const threadId = extractThreadId(location.href);
    if (!threadId) return;
    const thread = {
      threadId,
      title: titleEl.textContent.trim(),
      url: location.href,
      thumb: getEntry(threadId)?.thumb || '',
    };

    const host = titleEl.parentElement || titleEl;
    ensureActionsForThread(host, thread, null, false, true);
    applyVisualToHost(host, threadId);
  }

  function setProgressState(state) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    let box = panel.querySelector('.kuro-progress');
    if (!state) {
      if (box) box.remove();
      return;
    }
    if (!box) {
      box = document.createElement('div');
      box.className = 'kuro-progress';
      box.innerHTML = '<div class="kuro-progress-text"></div><div class="kuro-progress-bar"><div class="kuro-progress-fill"></div></div>';
      const body = panel.querySelector('.body');
      body.insertBefore(box, body.firstChild);
    }
    box.querySelector('.kuro-progress-text').textContent = state.text || '載入中...';
    box.querySelector('.kuro-progress-fill').style.width = `${Math.max(0, Math.min(100, state.percent || 0))}%`;
  }

  function fetchMissingThumbsFromCurrentPage() {
    let updated = 0;
    document.querySelectorAll('tbody[id^="normalthread_"]').forEach(tb => {
      const a = tb.querySelector('a.s.xst, a.xst');
      if (!a) return;
      const threadId = extractThreadId(a.href) || tb.id.replace(/^\D+_/, '');
      if (!threadId) return;
      const entry = getEntry(threadId);
      if (!entry) return;
      if (entry.thumb) return;
      const thumb = extractListThumb(tb);
      if (!thumb) return;
      db[threadId] = normalizeEntry(threadId, { ...entry, thumb });
      updated += 1;
    });
    if (updated > 0) saveDB();
    refreshUI();
    alert(updated > 0 ? `已補抓 ${updated} 筆縮圖（僅目前頁面能找到的項目）。` : '這一頁沒有可補的縮圖。');
  }

  async function fetchAllMissingThumbs() {
    const missingIds = Object.values(db)
      .filter(item => ((item.status && VALID_STATUSES.includes(item.status)) || (item.note && String(item.note).trim())) && !item.thumb)
      .map(item => item.threadId);
    if (!missingIds.length) {
      alert('目前沒有缺少縮圖的項目。');
      return;
    }

    const pending = new Set(missingIds);
    const visited = new Set();
    let queue = [location.href];
    let pagesScanned = 0;
    let found = 0;
    const maxPages = 600;

    setProgressState({ text: `正在補抓縮圖… 0/${missingIds.length}`, percent: 0 });

    while (queue.length && pending.size && pagesScanned < maxPages) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);
      pagesScanned += 1;

      try {
        const res = await fetch(url, { credentials: 'include' });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        doc.querySelectorAll('tbody[id^="normalthread_"]').forEach(tb => {
          const a = tb.querySelector('a.s.xst, a.xst');
          if (!a) return;
          const tid = extractThreadId(a.href) || tb.id.replace(/^\D+_/, '');
          if (!tid || !pending.has(tid)) return;
          const thumb = extractListThumb(tb);
          if (!thumb) return;
          const entry = getEntry(tid);
          if (!entry) return;
          db[tid] = normalizeEntry(tid, { ...entry, thumb });
          pending.delete(tid);
          found += 1;
        });

        // 收集下一批分頁連結（只收同論壇列表）
        doc.querySelectorAll('div.pg a[href]').forEach(link => {
          const href = link.getAttribute('href') || '';
          const text = (link.textContent || '').trim();
          if (!href || href.startsWith('javascript')) return;
          if (!/^\d+$/.test(text)) return;
          try {
            const abs = new URL(href, url).href;
            if (/forum(?:\.php\?mod=forumdisplay&fid=48|\-48\-)/.test(abs) && !visited.has(abs)) {
              queue.push(abs);
            }
          } catch {}
        });

        saveDB();
        refreshUI();
        const done = found;
        const total = missingIds.length;
        const percent = total ? (done / total) * 100 : 100;
        setProgressState({ text: `正在補抓縮圖… 已掃描 ${pagesScanned} 頁，已補到 ${done}/${total}，剩餘 ${pending.size}`, percent });
        await new Promise(r => setTimeout(r, 250));
      } catch (e) {
        setProgressState({ text: `補抓中發生錯誤，已掃描 ${pagesScanned} 頁，繼續中…`, percent: missingIds.length ? (found / missingIds.length) * 100 : 100 });
      }
    }

    saveDB();
    refreshUI();
    setProgressState({ text: `補抓完成：共補到 ${found}/${missingIds.length}，掃描 ${pagesScanned} 頁`, percent: 100 });
    setTimeout(() => setProgressState(null), 3000);
    alert(`補抓完成：共補到 ${found}/${missingIds.length} 張縮圖。` + (pending.size ? `\n仍有 ${pending.size} 張沒找到（可能沉太後面或該頁無縮圖）。` : ''));
  }

  function ensurePanel() {
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
        fetchMissingThumbsFromCurrentPage();
      });
      panel.querySelector('.kuro-fetch-all-thumbs').addEventListener('click', async () => {
        const ok = confirm('要開始從論壇列表頁批次補抓全部缺少縮圖的項目嗎？這可能會花一點時間。');
        if (!ok) return;
        await fetchAllMissingThumbs();
      });
      panel.querySelector('.kuro-export').addEventListener('click', () => {
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
        db = {};
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
        db = {};
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
          db = { ...db, ...imported };
          saveDB();
          refreshUI();
        } catch {
          alert('匯入失敗');
        }
      });
    }
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

  function makePlaceholderThumb() {
    const div = document.createElement('div');
    div.className = 'kuro-thumb';
    div.textContent = '無縮圖';
    return div;
  }

  function renderPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

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

  function refreshUI() {
    scanListPage();
    scanSearchPage();
    scanThreadPage();
    renderPanel();
  }

  function init() {
    injectStyle();
    ensurePanel();
    refreshUI();

    const observer = new MutationObserver((mutations) => {
      let shouldRefresh = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.id === PANEL_ID || node.id === TOGGLE_ID) continue;
          if (node.closest && node.closest(`#${PANEL_ID}`)) continue;
          if (
            node.matches?.('tbody[id^="normalthread_"], #thread_subject, h1, a.xst, a.s.xst, a[href*="mod=viewthread"]') ||
            node.querySelector?.('tbody[id^="normalthread_"], #thread_subject, h1, a.xst, a.s.xst, a[href*="mod=viewthread"]')
          ) {
            shouldRefresh = true;
            break;
          }
        }
        if (shouldRefresh) break;
      }
      if (shouldRefresh) setTimeout(refreshUI, 0);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
