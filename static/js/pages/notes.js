import { api } from '../api.js';
import { router } from '../router.js';
import { renderShell, initShell, updateSidebarTags, initEmotionFilter } from '../components/shell.js';
import { renderNoteCard } from '../components/note-card.js';
import { renderLoader } from '../components/loader.js';
import { icon } from '../components/icons.js';
import { debounce, escapeHtml, initTagGlow } from '../utils.js';

// ─── Page state ───────────────────────────────────────────────────────────────

let _allNotes      = [];
let _activeTag     = null;
let _activeEmotion = null;
let _search        = '';
let _totalCount    = 0;
let _loading       = false;

// ─── Entry point ──────────────────────────────────────────────────────────────

export function renderNotesPage() {
  _allNotes      = [];
  _activeTag     = null;
  _activeEmotion = null;
  _search        = '';

  document.getElementById('app').innerHTML = renderShell({
    mainHTML: `
      <div class="notes-page-header">
        <h2 id="page-heading">Мои заметки</h2>
        <span id="notes-count" class="notes-count" style="display:none"></span>
      </div>
      <div id="notes-container">${renderLoader()}</div>
    `
  });

  initShell();
  _initSearch();
  _loadNotes();
}

// ─── Search ───────────────────────────────────────────────────────────────────

function _initSearch() {
  const input = document.getElementById('header-search');
  if (!input) return;

  // Restore pending search from other pages
  const pending = sessionStorage.getItem('clarix_search');
  if (pending) { input.value = pending; _search = pending; sessionStorage.removeItem('clarix_search'); }

  const debouncedSearch = debounce(q => {
    _search = q;
    _activeTag = null;
    _loadNotes();
  }, 350);

  input.addEventListener('input', e => debouncedSearch(e.target.value.trim()));

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { input.value = ''; _search = ''; _loadNotes(); }
  });
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function _loadNotes() {
  if (_loading) return;
  _loading = true;

  const container = document.getElementById('notes-container');
  if (!container) return;

  container.innerHTML = renderLoader();

  try {
    const data = await api.getNotes({ search: _search });
    _allNotes   = Array.isArray(data) ? data : (data.results ?? []);
    _totalCount = typeof data.count === 'number' ? data.count : _allNotes.length;

    _render();
    updateSidebarTags(_allNotes, _activeTag, _onTagClick);
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-error">
        Не удалось загрузить заметки: ${escapeHtml(err.message)}
      </div>
    `;
  } finally {
    _loading = false;
  }
}

// ─── Render notes grid ────────────────────────────────────────────────────────

function _render() {
  const container = document.getElementById('notes-container');
  const heading   = document.getElementById('page-heading');
  const countEl   = document.getElementById('notes-count');
  if (!container || !heading || !countEl) return;

  const notes = _allNotes.filter(n => {
    const tagOk     = !_activeTag     || (n.tags || []).includes(_activeTag);
    const emotionOk = !_activeEmotion || (n.tags_with_emotions || []).some(t => t.emotion === _activeEmotion);
    return tagOk && emotionOk;
  });

  if (_activeTag) {
    heading.textContent = `#${_activeTag}`;
  } else if (_search) {
    heading.textContent = `Поиск: "${_search}"`;
  } else {
    heading.textContent = 'Мои заметки';
  }

  const displayed = notes.length;
  const suffix    = _totalCount > displayed ? ` из ${_totalCount}` : '';
  countEl.textContent = `${displayed}${suffix} заметок`;
  countEl.style.display = '';

  if (notes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">${icon('notes', 'icon-xl')}</span>
        <h3 class="empty-state-title">
          ${_search || _activeTag ? 'Ничего не найдено' : 'Нет заметок'}
        </h3>
        <p class="empty-state-text">
          ${_search
            ? 'Попробуйте изменить запрос'
            : _activeTag
              ? `Нет заметок с тегом #${escapeHtml(_activeTag)}`
              : 'Создайте свою первую заметку'}
        </p>
        ${!_search && !_activeTag ? `
          <a href="/notes/create" class="btn btn-primary">
            ${icon('plus')} Создать заметку
          </a>
        ` : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="notes-grid">
      ${notes.map(n => renderNoteCard(n)).join('')}
    </div>
  `;

  initTagGlow();
  initEmotionFilter(_activeEmotion, _onEmotionClick);

  container.querySelectorAll('.note-card').forEach(card => {
    const open = () => router.navigate(`/notes/${card.dataset.id}`);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

// ─── Tag / emotion click ──────────────────────────────────────────────────────

function _onTagClick(tag) {
  _activeTag = tag;
  _render();
  updateSidebarTags(_allNotes, _activeTag, _onTagClick);
}

function _onEmotionClick(emotion) {
  _activeEmotion = emotion;
  _render();
}
