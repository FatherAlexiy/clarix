import { icon } from './icons.js';
import { auth } from '../auth.js';
import { router } from '../router.js';
import { escapeHtml, escapeAttr } from '../utils.js';

// ─── Emotion definitions ──────────────────────────────────────────────────────

const EMOTIONS = [
  { key: 'positive',      label: 'Позитивные',  color: '#16a34a', delay: '0s'    },
  { key: 'negative',      label: 'Негативные',   color: '#dc2626', delay: '0.5s'  },
  { key: 'neutral',       label: 'Нейтральные',  color: '#3b82f6', delay: '1s'    },
  { key: 'philosophical', label: 'Философские',  color: '#9333ea', delay: '1.5s'  },
];

// Persists across re-renders; null = not yet initialized
let _expandedEmotions = null;

function _hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── App shell (authenticated pages) ─────────────────────────────────────────

export function renderShell({ mainHTML = '', isArchive = false } = {}) {
  const user = auth.getUser();

  return `
    <div class="app-shell">
      <header class="app-header">
        <a href="/notes" class="logo">
          ${icon('logo')}
          Clarix
        </a>

        <div class="header-search-wrap">
          ${icon('search')}
          <input
            id="header-search"
            type="search"
            class="header-search-input"
            placeholder="Поиск заметок..."
            autocomplete="off"
            spellcheck="false"
          >
        </div>

        <div class="header-actions">
          <a href="/notes/create" class="btn btn-primary btn-sm">
            ${icon('plus')}
            Создать
          </a>
        </div>
      </header>

      <div class="app-body">
        <aside class="app-sidebar" id="app-sidebar">
          <nav class="sidebar-nav">
            <a href="/notes" class="sidebar-item ${!isArchive ? 'active' : ''}" id="sidebar-all">
              ${icon('notes')}
              Все заметки
            </a>
            <a href="/archive" class="sidebar-item ${isArchive ? 'active' : ''}" id="sidebar-archive">
              ${icon('archive')}
              Архив
            </a>
          </nav>

          <div class="sidebar-divider"></div>

          <div class="sidebar-emotion-tree" id="sidebar-emotion-tree">
            <span class="sidebar-hint">Загрузка...</span>
          </div>

          <div class="sidebar-spacer"></div>

          <div class="sidebar-footer">
            <div class="sidebar-user" title="${escapeAttr(user?.email ?? '')}">
              ${icon('user')}
              <span class="sidebar-user-email">${escapeHtml(user?.email ?? '')}</span>
            </div>
            <button class="sidebar-item sidebar-item-danger" id="sidebar-logout">
              ${icon('logout')}
              Выйти
            </button>
          </div>
        </aside>

        <main class="app-main" id="app-main">
          ${mainHTML}
        </main>
      </div>
    </div>
  `;
}

// ─── Init shell event listeners ───────────────────────────────────────────────

export function initShell() {
  document.getElementById('sidebar-logout')?.addEventListener('click', async () => {
    await auth.logout();
    router.navigate('/login');
  });

  if (location.pathname !== '/notes' && location.pathname !== '/archive') {
    document.getElementById('header-search')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = e.target.value.trim();
        if (q) sessionStorage.setItem('clarix_search', q);
        router.navigate('/notes');
      }
    });
  }
}

// ─── Emotion-tag tree ─────────────────────────────────────────────────────────

export function updateEmotionTagTree(notes, activeTag, onTagClick) {
  const container = document.getElementById('sidebar-emotion-tree');
  if (!container) return;

  const emoData = {};
  EMOTIONS.forEach(e => { emoData[e.key] = { noteSet: new Set(), tagMap: {} }; });

  (notes || []).forEach((note, idx) => {
    const seenKey = new Set();
    (note.tags_with_emotions || []).forEach(({ tag, emotion }) => {
      const d = emoData[emotion];
      if (!d) return;
      d.noteSet.add(note.id);
      const k = `${emotion}\x00${tag}`;
      if (seenKey.has(k)) return;
      seenKey.add(k);
      if (!d.tagMap[tag]) d.tagMap[tag] = { count: 0, firstSeen: idx };
      d.tagMap[tag].count++;
    });
  });

  const groups = EMOTIONS.map(({ key, label, color, delay }) => {
    const d = emoData[key];
    const totalCount = d.noteSet.size;
    const tags = Object.entries(d.tagMap)
      .map(([tag, { count, firstSeen }]) => ({ tag, count, firstSeen }))
      .sort((a, b) => b.count - a.count || a.firstSeen - b.firstSeen);
    return { key, label, color, delay, tags, totalCount };
  });

  if (_expandedEmotions === null) {
    _expandedEmotions = new Set(groups.filter(g => g.tags.length > 0).map(g => g.key));
  }

  container.innerHTML = groups.map(({ key, label, color, delay, tags, totalCount }) => {
    const expanded = _expandedEmotions.has(key);
    const hoverBg  = _hexToRgba(color, 0.12);
    const activeBg = _hexToRgba(color, 0.22);
    return `
      <div class="emo-group">
        <button class="emo-header" data-emotion="${key}">
          <span class="emo-dot" style="background:${color};box-shadow:0 0 6px ${color};animation-delay:${delay}"></span>
          <span class="emo-label">${label}</span>
          <span class="emo-count">(${totalCount})</span>
          <span class="emo-arrow">${expanded ? '▼' : '▶'}</span>
        </button>
        <div class="emo-tags${expanded ? ' expanded' : ''}">
          ${tags.map(({ tag, count }) => `
            <button
              class="emo-tag-btn${tag === activeTag ? ' active' : ''}"
              data-tag="${escapeAttr(tag)}"
              style="--emo-hover-bg:${hoverBg};--emo-active-bg:${activeBg}"
            >
              <span class="emo-tag-name">#${escapeHtml(tag)}</span>
              <span class="emo-tag-count">${count}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.emo-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const emotion = btn.dataset.emotion;
      if (_expandedEmotions.has(emotion)) {
        _expandedEmotions.delete(emotion);
      } else {
        _expandedEmotions.add(emotion);
      }
      const expanded = _expandedEmotions.has(emotion);
      btn.querySelector('.emo-arrow').textContent = expanded ? '▼' : '▶';
      btn.nextElementSibling.classList.toggle('expanded', expanded);
    });
  });

  container.querySelectorAll('.emo-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tag;
      onTagClick(t === activeTag ? null : t);
    });
  });

  const allBtn = document.getElementById('sidebar-all');
  if (allBtn && !document.getElementById('sidebar-archive')?.classList.contains('active')) {
    allBtn.classList.toggle('active', !activeTag);
  }
}
