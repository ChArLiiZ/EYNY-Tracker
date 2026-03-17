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
  const m = String(url).match(/thread-(\d+)-/) || String(url).match(/[?&]tid=(\d+)/);
  return m ? m[1] : '';
}
