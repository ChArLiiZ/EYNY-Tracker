import { TOAST_CONTAINER_ID } from './constants.js';

let container = null;

function getContainer() {
  if (!container || !document.getElementById(TOAST_CONTAINER_ID)) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `kuro-toast kuro-toast-${type}`;
  toast.textContent = message;
  getContainer().appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
