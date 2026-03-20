export function nowIso() {
  return new Date().toISOString();
}

export function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

export function extractThreadId(url) {
  const s = String(url);
  // EYNY: thread-12345-1-1.html or ?tid=12345
  const eyny = s.match(/thread-(\d+)-/) || s.match(/[?&]tid=(\d+)/);
  if (eyny) return eyny[1];
  // hgamefree: /any-path/12345.html (one or more path segments before the ID)
  const hgf = s.match(/hgamefree\.info\/.+\/(\d+)\.html/);
  if (hgf) return 'hgf_' + hgf[1];
  return '';
}

export function isHgamefree() {
  return location.hostname === 'hgamefree.info';
}

export function isEyny() {
  return /eyny\.com$/i.test(location.hostname);
}

export function debounce(fn, ms) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export function isoDateOnly(iso) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

/**
 * Compute bigram-based Dice coefficient between two strings.
 * Returns a value between 0 and 1 (1 = identical).
 */
export function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  // Normalize: lowercase, remove common noise (brackets, tags, resolution, etc.)
  const norm = s => s.toLowerCase()
    .replace(/[\[\]【】（）()《》\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sa = norm(a);
  const sb = norm(b);
  if (sa === sb) return 1;
  if (sa.length < 2 || sb.length < 2) return 0;

  const bigrams = (str) => {
    const set = new Map();
    for (let i = 0; i < str.length - 1; i++) {
      const bi = str.slice(i, i + 2);
      set.set(bi, (set.get(bi) || 0) + 1);
    }
    return set;
  };

  const bg1 = bigrams(sa);
  const bg2 = bigrams(sb);
  let intersection = 0;
  for (const [bi, count] of bg1) {
    if (bg2.has(bi)) intersection += Math.min(count, bg2.get(bi));
  }
  return (2 * intersection) / (sa.length - 1 + sb.length - 1);
}
