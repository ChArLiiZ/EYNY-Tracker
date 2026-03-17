import { KEY, VALID_STATUSES } from './constants.js';
import { nowIso } from './utils.js';

let db = loadDB();
let refreshUICallback = null;

function loadDB() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveDB() {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function getDB() {
  return db;
}

export function setDB(newDb) {
  db = newDb;
}

export function setRefreshUICallback(fn) {
  refreshUICallback = fn;
}

export function normalizeEntry(threadId, patch = {}) {
  const old = db[threadId] || {};
  const createdAt = old.createdAt || nowIso();
  const status = VALID_STATUSES.includes(patch.status) ? patch.status : (VALID_STATUSES.includes(old.status) ? old.status : '');
  return {
    ...old,
    ...patch,
    threadId,
    status,
    note: patch.note !== undefined ? patch.note : (old.note || ''),
    thumb: patch.thumb !== undefined ? patch.thumb : (old.thumb || ''),
    manualOrder: patch.manualOrder !== undefined ? patch.manualOrder : (old.manualOrder ?? 999999),
    createdAt,
    updatedAt: nowIso(),
  };
}

export function upsert(threadId, patch) {
  if (!threadId) return;
  db[threadId] = normalizeEntry(threadId, patch);
  saveDB();
  if (refreshUICallback) refreshUICallback();
}

export function removeEntry(threadId) {
  if (!threadId) return;
  delete db[threadId];
  saveDB();
  if (refreshUICallback) refreshUICallback();
}

export function getEntry(threadId) {
  return db[threadId] || null;
}
