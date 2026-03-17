import { VALID_STATUSES } from './constants.js';
import { getDB, getEntry, normalizeEntry, saveDB } from './db.js';
import { extractThreadId } from './utils.js';
import { setProgressState } from './ui-helpers.js';

export function extractListThumb(tb) {
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

export async function fetchThumbForTid(threadId, startUrl = location.origin + '/forum.php?mod=forumdisplay&fid=48', maxPages = 120, onProgress = null) {
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

export function fetchMissingThumbsFromCurrentPage(refreshUI) {
  const db = getDB();
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

export async function fetchAllMissingThumbs(refreshUI) {
  const db = getDB();
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
