import { TOAST_CONTAINER_ID } from './constants.js';

let container = null;
const MAX_TOASTS = 5;

function getContainer() {
  if (!container || !document.getElementById(TOAST_CONTAINER_ID)) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = 'info', duration = 3000, action = null) {
  const c = getContainer();

  // Limit max visible toasts — remove oldest when exceeding limit
  while (c.children.length >= MAX_TOASTS) {
    const oldest = c.firstElementChild;
    if (oldest) oldest.remove();
  }

  const toast = document.createElement('div');
  toast.className = `kuro-toast kuro-toast-${type}`;

  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  if (action) {
    const btn = document.createElement('button');
    btn.className = 'kuro-toast-action';
    btn.textContent = action.label || '復原';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      action.onClick();
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    });
    toast.appendChild(btn);
  }

  c.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });
  const effectiveDuration = action ? Math.max(duration, 5000) : duration;
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, effectiveDuration);
}
