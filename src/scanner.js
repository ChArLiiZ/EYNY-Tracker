import { PANEL_ID } from './constants.js';
import { getDB, getEntry, normalizeEntry, saveDB, upsert, removeEntry } from './db.js';
import { extractThreadId } from './utils.js';
import { createButton, applyVisualToHost, setProgressState } from './ui-helpers.js';
import { extractListThumb, fetchThumbForTid } from './thumbnail.js';

function guessThumb(container) {
  if (!container) return '';
  if (container.tagName && container.tagName.toLowerCase() === 'tbody') {
    return extractListThumb(container);
  }
  return '';
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

export function scanListPage() {
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
      const db = getDB();
      db[threadId] = normalizeEntry(threadId, { ...old, ...thread });
      saveDB();
    }

    ensureActionsForThread(host, thread, tb, true);
    applyVisualToHost(host, threadId);
  });
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
}
