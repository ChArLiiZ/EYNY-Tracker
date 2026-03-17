import { PANEL_ID } from './constants.js';
import { statusLabel, statusColor } from './constants.js';
import { getEntry } from './db.js';

export function createButton(label, onClick, active = false, iconOnly = false, title = '') {
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

export function makePlaceholderThumb() {
  const div = document.createElement('div');
  div.className = 'kuro-thumb';
  div.textContent = '無縮圖';
  return div;
}

const STATUS_CLASSES = ['kuro-todo', 'kuro-seen', 'kuro-downloaded', 'kuro-skipped'];
const STATUS_CLASS_MAP = { todo: 'kuro-todo', seen: 'kuro-seen', downloaded: 'kuro-downloaded', skipped: 'kuro-skipped' };
const TEXT_MAP = {
  todo: ['⭐', '⭐ 待看'],
  seen: ['👁', '👁 已看'],
  downloaded: ['⬇', '⬇ 已下載'],
  skipped: ['🚫', '🚫 略過'],
};

export function applyVisualToHost(host, threadId) {
  if (!host || !threadId) return;

  const entry = getEntry(threadId);
  const status = entry?.status || '';
  const prevStatus = host.dataset.kuroStatus || '';

  // Skip if nothing changed
  if (prevStatus === status) return;
  host.dataset.kuroStatus = status;

  // Update classes
  for (const cls of STATUS_CLASSES) host.classList.remove(cls);
  if (STATUS_CLASS_MAP[status]) host.classList.add(STATUS_CLASS_MAP[status]);

  // Update or create badge
  let badge = host.querySelector(':scope > .kuro-badge');
  if (status) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'kuro-badge';
      host.appendChild(badge);
    }
    badge.textContent = statusLabel[status] || status;
    badge.style.background = statusColor[status] || '#999';
  } else if (badge) {
    badge.remove();
  }

  // Update active button states
  const actions = host.querySelector(':scope > .kuro-actions');
  if (actions) {
    const btns = actions.querySelectorAll('button');
    const matches = TEXT_MAP[status] || [];
    btns.forEach(btn => {
      btn.classList.toggle('active', matches.includes(btn.textContent));
    });
  }
}

export function setProgressState(state) {
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
