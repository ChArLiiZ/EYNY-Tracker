import { KEY, UI_STATE_KEY, VALID_STATUSES } from './constants.js';
import { nowIso } from './utils.js';

/* globals GM_getValue, GM_setValue, GM_deleteValue */

let db = loadDB();
let refreshUICallback = null;
let batchDepth = 0;
let onSaveCallback = null;

export function setOnSaveCallback(fn) {
  onSaveCallback = fn;
}

function loadDB() {
  try {
    let data = GM_getValue(KEY, null);
    if (data === null) {
      // One-time migration from localStorage
      const lsData = localStorage.getItem(KEY);
      if (lsData) {
        data = JSON.parse(lsData);
        GM_setValue(KEY, data);
      }
    }
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function saveDB() {
  try {
    GM_setValue(KEY, db);
    if (onSaveCallback) onSaveCallback();
  } catch (e) {
    console.error('[EYNY Tracker] 儲存失敗', e);
  }
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

export function loadUIState() {
  try {
    return GM_getValue(UI_STATE_KEY, {});
  } catch {
    return {};
  }
}

export function saveUIState(state) {
  try {
    GM_setValue(UI_STATE_KEY, state);
  } catch {}
}

export function deleteGMValue(key) {
  try {
    GM_deleteValue(key);
  } catch {}
}

function nextManualOrder() {
  let max = -1;
  for (const id in db) {
    const o = db[id].manualOrder;
    if (typeof o === 'number' && o > max) max = o;
  }
  return max + 1;
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
    thumb: (patch.thumb !== undefined ? patch.thumb : (old.thumb || '')).replace(/^http:\/\//i, 'https://'),
    manualOrder: patch.manualOrder !== undefined ? patch.manualOrder : (old.manualOrder ?? nextManualOrder()),
    createdAt,
    updatedAt: nowIso(),
  };
}

export function beginBatch() {
  batchDepth++;
}

export function endBatch() {
  if (--batchDepth <= 0) {
    batchDepth = 0;
    saveDB();
    if (refreshUICallback) refreshUICallback();
  }
}

export function upsert(threadId, patch) {
  if (!threadId) return;
  db[threadId] = normalizeEntry(threadId, patch);
  if (batchDepth > 0) return;
  saveDB();
  if (refreshUICallback) refreshUICallback();
}

export function removeEntry(threadId) {
  if (!threadId) return;
  delete db[threadId];
  if (batchDepth > 0) return;
  saveDB();
  if (refreshUICallback) refreshUICallback();
}

export function getEntry(threadId) {
  return db[threadId] || null;
}
