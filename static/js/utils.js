export function formatDate(iso) {
  const date = new Date(iso);
  const now  = new Date();
  const diff = now - date;

  if (diff < 60_000)        return 'Только что';
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)} мин. назад`;
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)} ч. назад`;
  if (diff < 604_800_000)   return `${Math.floor(diff / 86_400_000)} дн. назад`;

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

export function escapeAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

export function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len).trimEnd() + '…' : str;
}

export function mixWithWhite(hex, ratio) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r + (255 - r) * ratio)}, ${Math.round(g + (255 - g) * ratio)}, ${Math.round(b + (255 - b) * ratio)})`;
}

// 8 compass directions around the tag perimeter
const _DIRS = [
  [0, -1], [0.7, -0.7], [1, 0], [0.7, 0.7],
  [0, 1],  [-0.7, 0.7], [-1, 0], [-0.7, -0.7],
];

export function initTagGlow() {
  document.querySelectorAll('.tag-glow[data-color]').forEach((el, i) => {
    const hex = el.dataset.color;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const seed = i * 2.3999632 + Math.random() * 0.4;

    const oscs = _DIRS.map(([dx, dy], j) => ({
      dx, dy,
      f1:    0.38 + Math.abs(Math.sin(seed + j))       * 0.28,
      f2:    0.65 + Math.abs(Math.cos(seed + j * 1.4)) * 0.32,
      phase: seed  + j * 0.7854, // 45° steps
    }));

    const t0 = performance.now() - seed * 900;

    function frame(now) {
      if (!el.isConnected) return;
      const t = (now - t0) / 1000;

      const shadows = oscs.map(({ dx, dy, f1, f2, phase }) => {
        const v = Math.sin(t * f1 + phase) * Math.cos(t * f2 + phase * 0.6);
        const intensity = (v + 1) / 2;             // 0..1
        const blur   = 3  + intensity * 8;          // 3..11 px
        const spread = intensity * 1.2;             // 0..1.2 px
        const alpha  = 0.04 + intensity * 0.32;     // subtle
        const ox     = dx * (0.5 + intensity * 2);
        const oy     = dy * (0.5 + intensity * 2);
        return `${ox.toFixed(1)}px ${oy.toFixed(1)}px ${blur.toFixed(1)}px ${spread.toFixed(1)}px rgba(${r},${g},${b},${alpha.toFixed(2)})`;
      });

      el.style.boxShadow = shadows.join(',');
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  });
}
