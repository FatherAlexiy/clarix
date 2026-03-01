import { icon, icons } from './icons.js';
import { auth } from '../auth.js';
import { router } from '../router.js';
import { escapeHtml, escapeAttr } from '../utils.js';

// ─── App shell (authenticated pages) ────────────────────────────────────────

export function renderShell({ mainHTML = '', activeTag = null } = {}) {
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
            <a href="/notes" class="sidebar-item ${!activeTag ? 'active' : ''}" id="sidebar-all">
              ${icon('notes')}
              Все заметки
            </a>
          </nav>

          <div class="sidebar-divider"></div>

          <div class="sidebar-section">
            <p class="sidebar-section-label">${icon('tag')} Теги</p>
            <div class="sidebar-tags-list" id="sidebar-tags">
              <span class="sidebar-hint">Загрузка...</span>
            </div>
          </div>

          <div class="sidebar-divider"></div>

          <div class="sidebar-section">
            <p class="sidebar-section-label">Эмоции</p>
            <div class="sidebar-emotion-list" id="sidebar-emotions">
              <button class="emotion-filter-btn" data-emotion="positive">🟢 Позитивные</button>
              <button class="emotion-filter-btn" data-emotion="negative">🔴 Негативные</button>
              <button class="emotion-filter-btn" data-emotion="neutral">🔵 Нейтральные</button>
              <button class="emotion-filter-btn" data-emotion="philosophical">🟣 Философские</button>
            </div>
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

// ─── Init shell event listeners ──────────────────────────────────────────────

export function initShell() {
  document.getElementById('sidebar-logout')?.addEventListener('click', async () => {
    await auth.logout();
    router.navigate('/login');
  });

  if (location.pathname !== '/notes') {
    document.getElementById('header-search')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = e.target.value.trim();
        if (q) sessionStorage.setItem('clarix_search', q);
        router.navigate('/notes');
      }
    });
  }
}

// ─── Update emotion filter ───────────────────────────────────────────────────

export function initEmotionFilter(activeEmotion, onEmotionClick) {
  const container = document.getElementById('sidebar-emotions');
  if (!container) return;

  container.querySelectorAll('.emotion-filter-btn').forEach(btn => {
    const emotion = btn.dataset.emotion;
    btn.classList.toggle('active', emotion === activeEmotion);
    btn.onclick = () => onEmotionClick(emotion === activeEmotion ? null : emotion);
  });
}

// ─── Update sidebar tags list ────────────────────────────────────────────────

export function updateSidebarTags(notes, activeTag, onTagClick) {
  const container = document.getElementById('sidebar-tags');
  if (!container) return;

  const tags = [...new Set((notes || []).flatMap(n => n.tags || []))].sort();

  if (tags.length === 0) {
    container.innerHTML = '<span class="sidebar-hint">Пусто</span>';
    return;
  }

  container.innerHTML = tags.map(tag => `
    <button
      class="sidebar-tag-btn ${tag === activeTag ? 'active' : ''}"
      data-tag="${escapeAttr(tag)}"
    >#${escapeHtml(tag)}</button>
  `).join('');

  container.querySelectorAll('.sidebar-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tag;
      onTagClick(t === activeTag ? null : t);
    });
  });

  const allBtn = document.getElementById('sidebar-all');
  if (allBtn) allBtn.classList.toggle('active', !activeTag);
}
