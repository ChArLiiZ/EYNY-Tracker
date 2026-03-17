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

export function applyVisualToHost(host, threadId) {
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
