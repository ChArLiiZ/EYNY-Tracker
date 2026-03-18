import { PANEL_ID } from './constants.js';
import { getDB, getEntry, normalizeEntry, saveDB, upsert, removeEntry, beginBatch, endBatch } from './db.js';
import { extractThreadId, isHgamefree, titleSimilarity } from './utils.js';
import { createButton, applyVisualToHost, setProgressState } from './ui-helpers.js';
import { extractListThumb, fetchThumbForTid } from './thumbnail.js';
import { showToast } from './toast.js';

function guessThumb(container) {
  if (!container) return '';
  if (container.tagName && container.tagName.toLowerCase() === 'tbody') {
    return extractListThumb(container);
  }
  return '';
}

function toggleInlineNote(host, thread) {
  const existing = host.querySelector('.kuro-inline-note');
  if (existing) {
    existing.remove();
    return;
  }

  const current = getEntry(thread.threadId);
  const wrap = document.createElement('div');
  wrap.className = 'kuro-inline-note';

  const textarea = document.createElement('textarea');
  textarea.placeholder = '輸入備註...';
  textarea.value = current?.note || '';

  const saveBtn = createButton('💾', () => {
    upsert(thread.threadId, {
      title: thread.title,
      url: thread.url,
      thumb: thread.thumb || current?.thumb || '',
      status: current?.status || '',
      note: textarea.value,
    });
    showToast('備註已儲存', 'success');
  }, false, true, '儲存備註');

  wrap.appendChild(textarea);
  wrap.appendChild(saveBtn);
  host.appendChild(wrap);
  textarea.focus();
}

function ensureActionsForThread(host, thread, visualContainer, iconOnly = false, includeThumbFetch = false, compact = false) {
  if (!host || !thread.threadId) return;
  if (host.querySelector(':scope > .kuro-actions')) return;

  const wrap = document.createElement('div');
  wrap.className = 'kuro-actions';
  wrap.dataset.threadId = thread.threadId;

  const basePatch = () => ({
    title: thread.title,
    url: thread.url,
    thumb: thread.thumb || guessThumb(visualContainer || host),
    note: getEntry(thread.threadId)?.note || '',
  });

  const statusAction = (status) => () => {
    const existing = getEntry(thread.threadId);
    upsert(thread.threadId, { ...basePatch(), status });
    if (existing && existing.status) {
      showToast(`已更新狀態`, 'success');
    } else {
      showToast('已加入清單', 'success');
    }
  };

  wrap.appendChild(createButton(iconOnly ? '⭐' : '⭐ 待看', statusAction('todo'), false, iconOnly, '待看'));
  wrap.appendChild(createButton(iconOnly ? '👁' : '👁 已看', statusAction('seen'), false, iconOnly, '已看'));
  wrap.appendChild(createButton(iconOnly ? '⬇' : '⬇ 已下載', statusAction('downloaded'), false, iconOnly, '已下載'));
  wrap.appendChild(createButton(iconOnly ? '🚫' : '🚫 略過', statusAction('skipped'), false, iconOnly, '略過'));

  if (!compact) {
    wrap.appendChild(createButton(iconOnly ? '📝' : '📝 備註', () => {
      toggleInlineNote(host, thread);
    }, false, iconOnly, '備註'));

    if (includeThumbFetch) {
      wrap.appendChild(createButton(iconOnly ? '🖼' : '🖼 補抓此篇縮圖', async () => {
        const current = getEntry(thread.threadId) || {};
        setProgressState({ text: '正在補抓此篇縮圖…', percent: 5 });
        const thumb = await fetchThumbForTid(
          thread.threadId,
          `${location.origin}/forum.php?mod=forumdisplay&fid=48`,
          120,
          ({ scanned }) => setProgressState({ text: `正在補抓此篇縮圖… 已掃描 ${scanned} 頁`, percent: Math.min(95, scanned) })
        );
        if (thumb) {
          upsert(thread.threadId, { ...current, ...basePatch(), thumb });
          setProgressState({ text: '已補抓此篇縮圖', percent: 100 });
          setTimeout(() => setProgressState(null), 1500);
          showToast('已補抓此篇縮圖', 'success');
        } else {
          setProgressState(null);
          showToast('找不到列表縮圖，可能沉太後面或無縮圖', 'warning');
        }
      }, false, iconOnly, '補抓此篇縮圖'));
    }

    wrap.appendChild(createButton(iconOnly ? '❌' : '❌ 清除', () => {
      removeEntry(thread.threadId);
      showToast('已從清單中移除', 'info');
    }, false, iconOnly, '清除'));
  }

  host.appendChild(wrap);
}

function checkSimilarTitles(host, threadId, title) {
  // Only for untracked items
  if (getEntry(threadId)) return;
  if (host.querySelector('.kuro-similar-hint')) return;

  const db = getDB();
  let bestMatch = null;
  let bestScore = 0;
  for (const id in db) {
    if (id === threadId) continue;
    const entry = db[id];
    if (!entry.title) continue;
    const score = titleSimilarity(title, entry.title);
    if (score >= 0.5 && score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (bestMatch) {
    const hint = document.createElement('div');
    hint.className = 'kuro-similar-hint';
    const pct = Math.round(bestScore * 100);
    const statusText = bestMatch.status ? ` [${bestMatch.status}]` : '';
    hint.textContent = `⚠ 相似 ${pct}%：${bestMatch.title}${statusText}`;
    hint.title = `相似度 ${pct}%\n${bestMatch.title}`;
    host.appendChild(hint);
  }
}

function collectPageThreads() {
  const threads = [];
  document.querySelectorAll('tbody[id^="normalthread_"]').forEach(tb => {
    const a = tb.querySelector('a.s.xst, a.xst');
    if (!a) return;
    const threadId = extractThreadId(a.href) || tb.id.replace(/^\D+_/, '');
    if (!threadId) return;
    threads.push({
      threadId,
      title: a.textContent.trim(),
      url: a.href,
      thumb: extractListThumb(tb),
      host: a.parentElement || tb,
      tb,
    });
  });
  return threads;
}

function ensureSkipAllButton(threads) {
  if (document.querySelector('.kuro-skip-all-wrap')) return;

  const pagers = document.querySelectorAll('.pg, .pgt, #fd_page_bottom');
  let anchor = pagers[pagers.length - 1];
  if (!anchor) {
    const threadList = document.getElementById('threadlisttableid') || document.querySelector('#moderate');
    if (threadList) anchor = threadList;
    else return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'kuro-skip-all-wrap';
  wrap.style.cssText = 'display:flex;justify-content:flex-end;padding:8px 0;gap:8px';

  const btn = createButton('🚫 略過本頁未分類', () => {
    const untracked = threads.filter(t => !getEntry(t.threadId));
    if (!untracked.length) {
      showToast('本頁所有文章都已分類', 'info');
      return;
    }
    const skippedIds = untracked.map(t => t.threadId);
    beginBatch();
    untracked.forEach(t => {
      upsert(t.threadId, {
        title: t.title,
        url: t.url,
        thumb: t.thumb,
        note: '',
        status: 'skipped',
      });
    });
    endBatch();
    showToast(`已將 ${untracked.length} 篇未分類文章設為略過`, 'success', 5000, {
      label: '復原',
      onClick: () => {
        beginBatch();
        skippedIds.forEach(id => removeEntry(id));
        endBatch();
      },
    });
  });

  wrap.appendChild(btn);
  anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
}

export function scanListPage() {
  const threads = collectPageThreads();

  threads.forEach(({ threadId, title, url, thumb, host, tb }) => {
    const thread = { threadId, title, url, thumb };

    const old = getEntry(threadId);
    if (old && thread.thumb && !old.thumb) {
      const db = getDB();
      db[threadId] = normalizeEntry(threadId, { ...old, ...thread });
      saveDB();
    }

    ensureActionsForThread(host, thread, tb, true);
    applyVisualToHost(host, threadId);
    checkSimilarTitles(host, threadId, title);
  });

  if (threads.length > 0) {
    ensureSkipAllButton(threads);
  }
}

export function scanSearchPage() {
  if (!/search\.php\?/.test(location.href)) return;

  const links = Array.from(document.querySelectorAll('a.xst, a.s.xst, a[href*="mod=viewthread"]'))
    .filter(a => {
      const href = a.getAttribute('href') || '';
      const text = (a.textContent || '').trim();
      return text && /mod=viewthread|thread-\d+-/i.test(href);
    });

  links.forEach(a => {
    const threadId = extractThreadId(a.href);
    if (!threadId) return;
    if (a.closest && a.closest(`#${PANEL_ID}`)) return;

    let host = a.closest('th');
    if (!host) host = a.parentElement;
    if (!host) return;

    const row = a.closest('tr') || host;
    const thread = {
      threadId,
      title: a.textContent.trim(),
      url: a.href,
      thumb: extractListThumb(row),
    };

    const old = getEntry(threadId);
    if (old && thread.thumb && !old.thumb) {
      const db = getDB();
      db[threadId] = normalizeEntry(threadId, { ...old, ...thread });
      saveDB();
    }

    ensureActionsForThread(host, thread, row, true);
    applyVisualToHost(host, threadId);
    checkSimilarTitles(host, threadId, a.textContent.trim());
  });
}

export function scanThreadPage() {
  const titleEl = document.querySelector('#thread_subject') || document.querySelector('h1');
  if (!titleEl) return;
  const threadId = extractThreadId(location.href);
  if (!threadId) return;
  const thread = {
    threadId,
    title: titleEl.textContent.trim(),
    url: location.href,
    thumb: getEntry(threadId)?.thumb || '',
  };

  const host = titleEl.parentElement || titleEl;
  ensureActionsForThread(host, thread, null, false, true);
  applyVisualToHost(host, threadId);

  // Keyboard shortcut hint (#8)
  if (!host.querySelector('.kuro-kbd-bar')) {
    const hint = document.createElement('div');
    hint.className = 'kuro-kbd-bar';
    hint.innerHTML = '快捷鍵：<kbd>1</kbd> 待看　<kbd>2</kbd> 已看　<kbd>3</kbd> 已下載　<kbd>4</kbd> 略過　<kbd>0</kbd> 清除';
    host.appendChild(hint);
  }
}

/* ============================================================
   hgamefree.info support
   ============================================================ */

function collectHgamePosts() {
  const posts = [];
  // GridLove theme: article.gridlove-post or article[id^="post-"]
  const articles = document.querySelectorAll('article[class*="gridlove-post"], article[id^="post-"]');
  articles.forEach(article => {
    // Skip if inside our panel
    if (article.closest && article.closest(`#${PANEL_ID}`)) return;
    const a = article.querySelector('.entry-title a, h2 a, h3 a');
    if (!a) return;
    const threadId = extractThreadId(a.href);
    if (!threadId) return;
    // Thumbnail
    const img = article.querySelector('.entry-image img, .entry-media img, img');
    const thumb = img ? (img.dataset.src || img.src || '') : '';
    posts.push({
      threadId,
      title: a.textContent.trim(),
      url: a.href,
      thumb,
      host: article,
    });
  });
  return posts;
}

export function scanHgameListPage() {
  if (!isHgamefree()) return;
  const posts = collectHgamePosts();

  posts.forEach(({ threadId, title, url, thumb, host }) => {
    const thread = { threadId, title, url, thumb };

    const old = getEntry(threadId);
    if (old && thread.thumb && !old.thumb) {
      const db = getDB();
      db[threadId] = normalizeEntry(threadId, { ...old, ...thread });
      saveDB();
    }

    ensureActionsForThread(host, thread, null, true);
    applyVisualToHost(host, threadId);
    checkSimilarTitles(host, threadId, title);
  });

  if (posts.length > 0) {
    ensureHgameSkipAllButton(posts);
  }
}

function ensureHgameSkipAllButton(posts) {
  if (document.querySelector('.kuro-skip-all-wrap')) return;

  // Find pagination or main content area
  const pager = document.querySelector('.gridlove-pagination, .pagination, nav.navigation');
  const main = document.querySelector('main, .gridlove-posts, #content, .site-content');
  const anchor = pager || main;
  if (!anchor) return;

  const wrap = document.createElement('div');
  wrap.className = 'kuro-skip-all-wrap';
  wrap.style.cssText = 'display:flex;justify-content:flex-end;padding:12px 0;gap:8px';

  const btn = createButton('🚫 略過本頁未分類', () => {
    const untracked = posts.filter(t => !getEntry(t.threadId));
    if (!untracked.length) {
      showToast('本頁所有文章都已分類', 'info');
      return;
    }
    const skippedIds = untracked.map(t => t.threadId);
    beginBatch();
    untracked.forEach(t => {
      upsert(t.threadId, {
        title: t.title,
        url: t.url,
        thumb: t.thumb,
        note: '',
        status: 'skipped',
      });
    });
    endBatch();
    showToast(`已將 ${untracked.length} 篇未分類文章設為略過`, 'success', 5000, {
      label: '復原',
      onClick: () => {
        beginBatch();
        skippedIds.forEach(id => removeEntry(id));
        endBatch();
      },
    });
  });

  wrap.appendChild(btn);
  if (pager) {
    pager.parentNode.insertBefore(wrap, pager);
  } else if (anchor) {
    anchor.appendChild(wrap);
  }
}

export function scanHgamePostPage() {
  if (!isHgamefree()) return;
  // Only on single post pages
  const threadId = extractThreadId(location.href);
  if (!threadId) return;

  // Only on single post pages (WordPress adds 'single-post' or 'single' body class)
  // Also accept if the URL matches a post pattern and there's an h1.entry-title
  const isSinglePost = document.body.classList.contains('single-post')
    || document.body.classList.contains('single')
    || /\/\d+\.html$/.test(location.pathname);
  if (!isSinglePost) return;

  // Single post: entry-title is the main title
  const titleEl = document.querySelector('h1.entry-title, .entry-title, h1');
  if (!titleEl) return;

  // Get featured image
  const img = document.querySelector('.entry-content img, .entry-media img, .wp-post-image, article img');
  const thumb = getEntry(threadId)?.thumb || (img ? (img.dataset.src || img.src || '') : '');

  const thread = {
    threadId,
    title: titleEl.textContent.trim(),
    url: location.href,
    thumb,
  };

  const host = titleEl.parentElement || titleEl;
  ensureActionsForThread(host, thread, null, false);
  applyVisualToHost(host, threadId);

  // Keyboard shortcut hint
  if (!host.querySelector('.kuro-kbd-bar')) {
    const hint = document.createElement('div');
    hint.className = 'kuro-kbd-bar';
    hint.innerHTML = '快捷鍵：<kbd>1</kbd> 待看　<kbd>2</kbd> 已看　<kbd>3</kbd> 已下載　<kbd>4</kbd> 略過　<kbd>0</kbd> 清除';
    host.appendChild(hint);
  }

  // Scan sidebar popular posts (30天內熱門文章)
  scanHgameSidebar();
}

function scanHgameSidebar() {
  // Scan sidebar/widget areas outside the main article content
  // Try multiple common WordPress sidebar selectors
  const containers = document.querySelectorAll('aside, .sidebar, #secondary, .widget-area, .widget, [id*="popular"], [class*="popular"], [class*="widget"]');
  if (!containers.length) return;

  // Collect all links from all sidebar containers
  const seen = new Set();
  containers.forEach(container => {
    // Skip if inside our panel or inside the main article content
    if (container.closest && container.closest(`#${PANEL_ID}`)) return;

    // Get all links — use broad selector since hrefs may be relative
    const links = container.querySelectorAll('a[href]');
    links.forEach(a => {
      // Use the resolved absolute href for extractThreadId
      const tid = extractThreadId(a.href);
      if (!tid) return;
      // Skip duplicates
      if (seen.has(tid)) return;
      seen.add(tid);

      // Skip the current page's own link
      if (tid === extractThreadId(location.href)) return;

      // Find the containing li or widget item
      let host = a.closest('li') || a.parentElement;
      if (!host) return;
      // Skip if inside our panel
      if (host.closest && host.closest(`#${PANEL_ID}`)) return;

      const title = a.textContent.trim() || a.getAttribute('title') || '';
      if (!title) return;

      // Try to find a thumbnail in the sidebar item
      const img = host.querySelector('img');
      const thumb = getEntry(tid)?.thumb || (img ? (img.dataset.src || img.src || '') : '');

      const thread = {
        threadId: tid,
        title,
        url: a.href,
        thumb,
      };

      // ensureActionsForThread has its own duplicate guard
      ensureActionsForThread(host, thread, null, true, false, true);
      // Always run applyVisual so status changes reflect immediately
      applyVisualToHost(host, tid);
    });
  });
}
