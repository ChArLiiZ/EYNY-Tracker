import { SYNC_KEY } from './constants.js';
import { getDB, setDB, saveDB } from './db.js';
import { showToast } from './toast.js';
import { debounce } from './utils.js';

/* globals GM_getValue, GM_setValue, GM_xmlhttpRequest */

const GIST_FILENAME = 'eyny-tracker-data.json';
let syncInProgress = false;
let refreshUICallback = null;

export function setSyncRefreshUI(fn) {
  refreshUICallback = fn;
}

// ── Config helpers ──────────────────────────────────────

export function getSyncConfig() {
  try {
    return GM_getValue(SYNC_KEY, null) || {};
  } catch {
    return {};
  }
}

export function saveSyncConfig(cfg) {
  try {
    GM_setValue(SYNC_KEY, cfg);
  } catch {}
}

function isConfigured() {
  const cfg = getSyncConfig();
  return !!(cfg.token && cfg.gistId);
}

// ── GitHub API helpers ──────────────────────────────────

function ghRequest(method, url, token, body = null) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method,
      url,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      data: body ? JSON.stringify(body) : undefined,
      onload: (res) => {
        if (res.status >= 200 && res.status < 300) {
          try {
            resolve(JSON.parse(res.responseText));
          } catch {
            resolve(null);
          }
        } else {
          reject(new Error(`GitHub API ${res.status}: ${res.responseText?.slice(0, 200)}`));
        }
      },
      onerror: (err) => reject(new Error(`Network error: ${err.statusText || 'unknown'}`)),
      ontimeout: () => reject(new Error('Request timeout')),
      timeout: 15000,
    });
  });
}

// ── Create Gist ─────────────────────────────────────────

export async function createGist(token) {
  const db = getDB();
  const data = {
    description: 'EYNY Tracker sync data (auto-managed)',
    public: false,
    files: {
      [GIST_FILENAME]: {
        content: JSON.stringify(db, null, 2) || '{}',
      },
    },
  };
  const result = await ghRequest('POST', 'https://api.github.com/gists', token, data);
  return result.id;
}

// ── Push (upload local → Gist) ──────────────────────────

export async function syncPush(silent = false) {
  if (syncInProgress) return;
  if (!isConfigured()) return;
  const cfg = getSyncConfig();

  syncInProgress = true;
  updateSyncStatus('uploading');
  try {
    const db = getDB();
    await ghRequest('PATCH', `https://api.github.com/gists/${cfg.gistId}`, cfg.token, {
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(db, null, 2) || '{}',
        },
      },
    });
    cfg.lastSync = new Date().toISOString();
    saveSyncConfig(cfg);
    updateSyncStatus('success');
    if (!silent) showToast('已同步上傳到 Gist', 'success');
  } catch (err) {
    console.error('[EYNY Tracker] Sync push failed:', err);
    updateSyncStatus('error');
    if (!silent) showToast('同步上傳失敗：' + err.message, 'error');
  } finally {
    syncInProgress = false;
  }
}

// ── Pull (download Gist → merge local) ─────────────────

export async function syncPull(silent = false) {
  if (syncInProgress) return;
  if (!isConfigured()) return;
  const cfg = getSyncConfig();

  syncInProgress = true;
  updateSyncStatus('downloading');
  try {
    const gist = await ghRequest('GET', `https://api.github.com/gists/${cfg.gistId}`, cfg.token);
    const file = gist?.files?.[GIST_FILENAME];
    if (!file || !file.content) {
      updateSyncStatus('success');
      if (!silent) showToast('Gist 上沒有資料', 'info');
      return;
    }

    const remoteDB = JSON.parse(file.content);
    if (!remoteDB || typeof remoteDB !== 'object') {
      updateSyncStatus('error');
      if (!silent) showToast('Gist 資料格式無效', 'error');
      return;
    }

    const localDB = getDB();
    const { merged, stats } = mergeDB(localDB, remoteDB);
    setDB(merged);
    saveDB();

    cfg.lastSync = new Date().toISOString();
    saveSyncConfig(cfg);
    updateSyncStatus('success');

    if (refreshUICallback) refreshUICallback();

    if (!silent) {
      const msg = `已同步：新增 ${stats.added}，更新 ${stats.updated}，共 ${Object.keys(merged).length} 筆`;
      showToast(msg, 'success');
    }
  } catch (err) {
    console.error('[EYNY Tracker] Sync pull failed:', err);
    updateSyncStatus('error');
    if (!silent) showToast('同步下載失敗：' + err.message, 'error');
  } finally {
    syncInProgress = false;
  }
}

// ── Full sync: pull then push ───────────────────────────

export async function syncFull(silent = false) {
  await syncPull(true);
  await syncPush(true);
  if (!silent) showToast('雙向同步完成', 'success');
}

// ── Merge logic (by updatedAt) ──────────────────────────

function mergeDB(local, remote) {
  const merged = { ...local };
  let added = 0;
  let updated = 0;

  for (const id in remote) {
    if (!merged[id]) {
      // New item from remote
      merged[id] = remote[id];
      added++;
    } else {
      // Conflict: keep the one with newer updatedAt
      const localTime = merged[id].updatedAt || '';
      const remoteTime = remote[id].updatedAt || '';
      if (remoteTime > localTime) {
        merged[id] = remote[id];
        updated++;
      }
    }
  }

  return { merged, stats: { added, updated } };
}

// ── Auto sync (debounced, after each save) ──────────────

export const autoSync = debounce(() => {
  const cfg = getSyncConfig();
  if (cfg.autoSync && isConfigured()) {
    syncPush(true).catch(() => {});
  }
}, 3000);

// ── Init: pull on page load ─────────────────────────────

export async function initSync() {
  const cfg = getSyncConfig();
  if (cfg.autoSync && isConfigured()) {
    try {
      await syncPull(true);
    } catch (err) {
      console.warn('[EYNY Tracker] Auto sync pull on init failed:', err);
    }
  }
}

// ── Status indicator ────────────────────────────────────

function updateSyncStatus(status) {
  const el = document.querySelector('.kuro-sync-status');
  if (!el) return;
  el.className = 'kuro-sync-status kuro-sync-' + status;
  const labels = {
    idle: '',
    uploading: '上傳中...',
    downloading: '下載中...',
    success: '已同步',
    error: '同步失敗',
  };
  el.textContent = labels[status] || '';
  if (status === 'success') {
    setTimeout(() => {
      if (el.classList.contains('kuro-sync-success')) {
        el.textContent = '';
        el.className = 'kuro-sync-status';
      }
    }, 3000);
  }
}

// ── Settings dialog ─────────────────────────────────────

export function showSyncSettings() {
  // Remove existing dialog
  document.querySelector('.kuro-sync-dialog')?.remove();

  const cfg = getSyncConfig();
  const overlay = document.createElement('div');
  overlay.className = 'kuro-sync-dialog';

  overlay.innerHTML = `
    <div class="kuro-sync-dialog-content">
      <h3>GitHub Gist 雲端同步設定</h3>
      <div class="kuro-sync-help">
        <p>使用 GitHub Gist 跨裝置同步你的追蹤清單。</p>
        <details>
          <summary>如何取得 Personal Access Token？</summary>
          <ol>
            <li>前往 <a href="https://github.com/settings/tokens?type=beta" target="_blank">GitHub Settings &gt; Fine-grained tokens</a></li>
            <li>點擊 <strong>Generate new token</strong></li>
            <li>Token name 填 <code>EYNY Tracker</code></li>
            <li>Expiration 選你想要的期限</li>
            <li>Repository access 選 <strong>Public Repositories (read-only)</strong></li>
            <li>Permissions 區塊 > Account permissions > <strong>Gists</strong> 設為 <strong>Read and write</strong></li>
            <li>點 Generate token，複製 token</li>
          </ol>
        </details>
      </div>
      <label class="kuro-sync-label">
        GitHub Token
        <input type="password" class="kuro-sync-input kuro-sync-token"
               value="${cfg.token || ''}" placeholder="github_pat_xxxxx 或 ghp_xxxxx">
      </label>
      <label class="kuro-sync-label">
        Gist ID <span class="kuro-mini">（留空將自動建立新 Gist）</span>
        <input type="text" class="kuro-sync-input kuro-sync-gist-id"
               value="${cfg.gistId || ''}" placeholder="留空自動建立">
      </label>
      <label class="kuro-sync-label kuro-sync-checkbox-label">
        <input type="checkbox" class="kuro-sync-auto" ${cfg.autoSync ? 'checked' : ''}>
        自動同步（每次修改後自動上傳，開啟頁面時自動下載）
      </label>
      ${cfg.lastSync ? `<div class="kuro-mini" style="margin-top:4px">上次同步：${cfg.lastSync}</div>` : ''}
      <div class="kuro-sync-dialog-actions"></div>
    </div>
  `;

  const actions = overlay.querySelector('.kuro-sync-dialog-actions');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'kuro-btn';
  closeBtn.textContent = '取消';
  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 200);
  });

  const testBtn = document.createElement('button');
  testBtn.className = 'kuro-btn';
  testBtn.textContent = '測試連線';
  testBtn.addEventListener('click', async () => {
    const token = overlay.querySelector('.kuro-sync-token').value.trim();
    if (!token) { showToast('請輸入 Token', 'error'); return; }
    testBtn.disabled = true;
    testBtn.textContent = '測試中...';
    try {
      const user = await ghRequest('GET', 'https://api.github.com/user', token);
      showToast(`連線成功！帳號：${user.login}`, 'success');
    } catch (err) {
      showToast('連線失敗：' + err.message, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '測試連線';
    }
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'kuro-btn kuro-btn-primary';
  saveBtn.textContent = '儲存設定';
  saveBtn.addEventListener('click', async () => {
    const token = overlay.querySelector('.kuro-sync-token').value.trim();
    let gistId = overlay.querySelector('.kuro-sync-gist-id').value.trim();
    const autoSyncChecked = overlay.querySelector('.kuro-sync-auto').checked;

    if (!token) {
      showToast('請輸入 GitHub Token', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中...';

    try {
      // Validate token
      await ghRequest('GET', 'https://api.github.com/user', token);

      // Create gist if needed
      if (!gistId) {
        showToast('正在建立新的 Gist...', 'info');
        gistId = await createGist(token);
        overlay.querySelector('.kuro-sync-gist-id').value = gistId;
        showToast(`Gist 已建立：${gistId}`, 'success');
      } else {
        // Validate gist exists
        await ghRequest('GET', `https://api.github.com/gists/${gistId}`, token);
      }

      saveSyncConfig({ token, gistId, autoSync: autoSyncChecked, lastSync: cfg.lastSync || '' });
      showToast('同步設定已儲存', 'success');

      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);

      // Do initial sync
      if (autoSyncChecked) {
        await syncFull(false);
      }
    } catch (err) {
      showToast('設定失敗：' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '儲存設定';
    }
  });

  const disconnectBtn = document.createElement('button');
  disconnectBtn.className = 'kuro-btn';
  disconnectBtn.textContent = '中斷連線';
  disconnectBtn.style.color = '#ef4444';
  disconnectBtn.addEventListener('click', () => {
    if (!confirm('確定要中斷雲端同步嗎？本地資料不會被刪除。')) return;
    saveSyncConfig({});
    showToast('已中斷雲端同步', 'info');
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 200);
  });

  actions.appendChild(closeBtn);
  actions.appendChild(testBtn);
  if (cfg.token) actions.appendChild(disconnectBtn);
  actions.appendChild(saveBtn);

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('show'));
  });
}
