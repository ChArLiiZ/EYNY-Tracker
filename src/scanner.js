import { PANEL_ID } from './constants.js';
import { getDB, getEntry, normalizeEntry, saveDB, upsert, removeEntry, beginBatch, endBatch } from './db.js';
import { extractThreadId } from './utils.js';
import { createButton, applyVisualToHost, setProgressState } from './ui-helpers.js';
import { extractListThumb, fetchThumbForTid } from './thumbnail.js';
import { showToast } from './toast.js';

function guessThumb(container) {
  if (!container) return '';
  if (container.tagName && container.tagName.toLowerCase() === 'tbody') {
    return extractListThumb(container);
  }
  return '';
}

function toggleInlineNote(host, thread) {
  const existing = host.querySelector('.kuro-inline-note');
  if (existing) {
    existing.remove();
    return;
  }

  const current = getEntry(thread.threadId);
  const wrap = document.createElement('div');
  wrap.className = 'kuro-inline-note';

  const textarea = document.createElement('textarea');
  textarea.placeholder = '輸入備註...';
  textarea.value = current?.note || '';

  const saveBtn = createButton('💾', () => {
    upsert(thread.threadId, {
      title: thread.title,
      url: thread.url,
      thumb: thread.thumb || current?.thumb || '',
      status: current?.status || '',
      note: textarea.value,
    });
    showToast('備註已儲存', 'success');
  }, false, true, '儲存備註');

  wrap.appendChild(textarea);
  wrap.appendChild(saveBtn);
  host.appendChild(wrap);
  textarea.focus();
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

  const statusAction = (status) => () => {
    const existing = getEntry(thread.threadId);
    upsert(thread.threadId, { ...basePatch(), status });
    if (existing && existing.status) {
      showToast(`已更新狀態`, 'success');
    } else {
      showToast('已加入清單', 'success');
    }
  };

  wrap.appendChild(createButton(iconOnly ? '⭐' : '⭐ 待看', statusAction('todo'), false, iconOnly, '待看'));
  wrap.appendChild(createButton(iconOnly ? '👁' : '👁 已看', statusAction('seen'), false, iconOnly, '已看'));
  wrap.appendChild(createButton(iconOnly ? '⬇' : '⬇ 已下載', statusAction('downloaded'), false, iconOnly, '已下載'));
  wrap.appendChild(createButton(iconOnly ? '🚫' : '🚫 略過', statusAction('skipped'), false, iconOnly, '略過'));

  wrap.appendChild(createButton(iconOnly ? '📝' : '📝 備註', () => {
    toggleInlineNote(host, thread);
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
        showToast('已補抓此篇縮圖', 'success');
      } else {
        setProgressState(null);
        showToast('找不到列表縮圖，可能沉太後面或無縮圖', 'warning');
      }
    }, false, iconOnly, '補抓此篇縮圖'));
  }

  wrap.appendChild(createButton(iconOnly ? '❌' : '❌ 清除', () => {
    removeEntry(thread.threadId);
    showToast('已從清單中移除', 'info');
  }, false, iconOnly, '清除'));

  host.appendChild(wrap);
}

function collectPageThreads() {
  const threads = [];
  document.querySelectorAll('tbody[id^="normalthread_"]').forEach(tb => {
    const a = tb.querySelector('a.s.xst, a.xst');
    if (!a) return;
    const threadId = extractThreadId(a.href) || tb.id.replace(/^\D+_/, '');
    if (!threadId) return;
    threads.push({
      threadId,
      title: a.textContent.trim(),
      url: a.href,
      thumb: extractListThumb(tb),
      host: a.parentElement || tb,
      tb,
    });
  });
  return threads;
}

function ensureSkipAllButton(threads) {
  if (document.querySelector('.kuro-skip-all-wrap')) return;

  const pagers = document.querySelectorAll('.pg, .pgt, #fd_page_bottom');
  let anchor = pagers[pagers.length - 1];
  if (!anchor) {
    const threadList = document.getElementById('threadlisttableid') || document.querySelector('#moderate');
    if (threadList) anchor = threadList;
    else return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'kuro-skip-all-wrap';
  wrap.style.cssText = 'display:flex;justify-content:flex-end;padding:8px 0;gap:8px';

  const btn = createButton('🚫 略過本頁未分類', () => {
    const untracked = threads.filter(t => !getEntry(t.threadId));
    if (!untracked.length) {
      showToast('本頁所有文章都已分類', 'info');
      return;
    }
    const skippedIds = untracked.map(t => t.threadId);
    beginBatch();
    untracked.forEach(t => {
      upsert(t.threadId, {
        title: t.title,
        url: t.url,
        thumb: t.thumb,
        note: '',
        status: 'skipped',
      });
    });
    endBatch();
    showToast(`已將 ${untracked.length} 篇未分類文章設為略過`, 'success', 5000, {
      label: '復原',
      onClick: () => {
        beginBatch();
        skippedIds.forEach(id => removeEntry(id));
        endBatch();
      },
    });
  });

  wrap.appendChild(btn);
  anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
}

export function scanListPage() {
  const threads = collectPageThreads();

  threads.forEach(({ threadId, title, url, thumb, host, tb }) => {
    const thread = { threadId, title, url, thumb };

    const old = getEntry(threadId);
    if (old && thread.thumb && !old.thumb) {
      const db = getDB();
      db[threadId] = normalizeEntry(threadId, { ...old, ...thread });
      saveDB();
    }

    ensureActionsForThread(host, thread, tb, true);
    applyVisualToHost(host, threadId);
  });

  if (threads.length > 0) {
    ensureSkipAllButton(threads);
  }
}

export function scanSearchPage() {
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
      const db = getDB();
      db[threadId] = normalizeEntry(threadId, { ...old, ...thread });
      saveDB();
    }

    ensureActionsForThread(host, thread, row, true);
    applyVisualToHost(host, threadId);
  });
}

export function scanThreadPage() {
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

  // Keyboard shortcut hint (#8)
  if (!host.querySelector('.kuro-kbd-bar')) {
    const hint = document.createElement('div');
    hint.className = 'kuro-kbd-bar';
    hint.innerHTML = '快捷鍵：<kbd>1</kbd> 待看　<kbd>2</kbd> 已看　<kbd>3</kbd> 已下載　<kbd>4</kbd> 略過　<kbd>0</kbd> 清除';
    host.appendChild(hint);
  }
}
