import { PANEL_ID, TOGGLE_ID } from './constants.js';
import { setRefreshUICallback, setOnSaveCallback, getEntry, upsert, removeEntry } from './db.js';
import { extractThreadId, isHgamefree, debounce } from './utils.js';
import { injectStyle } from './style.js';
import { scanListPage, scanSearchPage, scanThreadPage, scanHgameListPage, scanHgamePostPage } from './scanner.js';
import { ensurePanel, renderPanel, updateToggleCount } from './panel.js';
import { showToast } from './toast.js';
import { autoSync, initSync, setSyncRefreshUI } from './sync.js';

function refreshUI() {
  if (isHgamefree()) {
    scanHgameListPage();
    scanHgamePostPage();
  } else {
    scanListPage();
    scanSearchPage();
    scanThreadPage();
  }
  updateToggleCount();
  // Only render panel if it's visible
  const panel = document.getElementById(PANEL_ID);
  if (panel && panel.classList.contains('show')) {
    renderPanel();
  }
}

// #11: Debounce refreshUI when triggered by DB operations to coalesce rapid updates
const debouncedRefreshUI = debounce(refreshUI, 50);

setRefreshUICallback(debouncedRefreshUI);
setSyncRefreshUI(refreshUI); // Sync uses immediate refresh since it's a single operation
setOnSaveCallback(autoSync);

// #13: Cancel pending debounced calls on page unload to prevent truncated operations
window.addEventListener('beforeunload', () => {
  debouncedRefreshUI.cancel();
  autoSync.cancel();
});

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Skip if modifier keys are held or user is typing in an input/textarea
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;

    // Only on thread pages
    const threadId = extractThreadId(location.href);
    if (!threadId) return;

    const titleEl = document.querySelector('#thread_subject') || document.querySelector('h1.entry-title') || document.querySelector('h1');
    const title = titleEl?.textContent?.trim() || '';

    const basePatch = {
      title,
      url: location.href,
      thumb: getEntry(threadId)?.thumb || '',
      note: getEntry(threadId)?.note || '',
    };

    const statusMap = { '1': 'todo', '2': 'seen', '3': 'downloaded', '4': 'skipped' };
    const labelMap = { '1': '待看', '2': '已看', '3': '已下載', '4': '略過' };

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
        const snapshot = { ...existing };
        removeEntry(threadId);
        showToast('已從清單中移除', 'info', 5000, {
          label: '復原',
          onClick: () => upsert(threadId, snapshot),
        });
      }
    }
  });
}

function init() {
  injectStyle();
  ensurePanel(refreshUI);
  refreshUI();
  setupKeyboardShortcuts();
  // Cloud sync: init (auto-push only, pull is manual)
  initSync();

  let mutationTimer = null;
  const observer = new MutationObserver((mutations) => {
    if (mutationTimer) return; // already scheduled
    let shouldRefresh = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        // Skip our own injected elements
        if (node.id === PANEL_ID || node.id === TOGGLE_ID) continue;
        if (node.closest && node.closest(`#${PANEL_ID}`)) continue;
        if (node.classList && (
          node.classList.contains('kuro-actions') ||
          node.classList.contains('kuro-badge') ||
          node.classList.contains('kuro-inline-note') ||
          node.classList.contains('kuro-skip-all-wrap') ||
          node.classList.contains('kuro-toast')
        )) continue;
        // EYNY selectors
        const eynyMatch = 'tbody[id^="normalthread_"], #thread_subject, h1, a.xst, a.s.xst, a[href*="mod=viewthread"]';
        // hgamefree selectors
        const hgfMatch = 'article[class*="gridlove-post"], article[id^="post-"], .entry-title, .widget a[href*="hgamefree"], aside a[href*="hgamefree"]';
        const selectors = isHgamefree() ? hgfMatch : eynyMatch;
        if (
          node.matches?.(selectors) ||
          node.querySelector?.(selectors)
        ) {
          shouldRefresh = true;
          break;
        }
      }
      if (shouldRefresh) break;
    }
    if (shouldRefresh) {
      mutationTimer = setTimeout(() => {
        mutationTimer = null;
        refreshUI();
      }, 100);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

init();
