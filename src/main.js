import { PANEL_ID, TOGGLE_ID } from './constants.js';
import { setRefreshUICallback, getEntry, upsert, removeEntry } from './db.js';
import { extractThreadId } from './utils.js';
import { injectStyle } from './style.js';
import { scanListPage, scanSearchPage, scanThreadPage } from './scanner.js';
import { ensurePanel, renderPanel } from './panel.js';
import { showToast } from './toast.js';

function refreshUI() {
  scanListPage();
  scanSearchPage();
  scanThreadPage();
  renderPanel();
}

setRefreshUICallback(refreshUI);

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Skip if user is typing in an input/textarea
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;

    // Only on thread pages
    const threadId = extractThreadId(location.href);
    if (!threadId) return;

    const titleEl = document.querySelector('#thread_subject') || document.querySelector('h1');
    const title = titleEl?.textContent?.trim() || '';

    const basePatch = {
      title,
      url: location.href,
      thumb: getEntry(threadId)?.thumb || '',
      note: getEntry(threadId)?.note || '',
    };

    const statusMap = { '1': 'todo', '2': 'seen', '3': 'downloaded' };
    const labelMap = { '1': '待看', '2': '已看', '3': '已下載' };

    if (statusMap[e.key]) {
      e.preventDefault();
      const existing = getEntry(threadId);
      upsert(threadId, { ...basePatch, status: statusMap[e.key] });
      showToast(
        existing?.status ? `已更新為${labelMap[e.key]}` : `已加入清單：${labelMap[e.key]}`,
        'success'
      );
    } else if (e.key === '0' || e.key === 'Delete') {
      const existing = getEntry(threadId);
      if (existing) {
        e.preventDefault();
        removeEntry(threadId);
        showToast('已從清單中移除', 'info');
      }
    }
  });
}

function init() {
  injectStyle();
  ensurePanel(refreshUI);
  refreshUI();
  setupKeyboardShortcuts();

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
