import { PANEL_ID, TOGGLE_ID } from './constants.js';
import { setRefreshUICallback } from './db.js';
import { injectStyle } from './style.js';
import { scanListPage, scanSearchPage, scanThreadPage } from './scanner.js';
import { ensurePanel, renderPanel } from './panel.js';

function refreshUI() {
  scanListPage();
  scanSearchPage();
  scanThreadPage();
  renderPanel();
}

setRefreshUICallback(refreshUI);

function init() {
  injectStyle();
  ensurePanel(refreshUI);
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
