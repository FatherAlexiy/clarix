import { api } from '../api.js';
import { router } from '../router.js';
import { renderShell, initShell, updateEmotionTagTree } from '../components/shell.js';
import { renderNoteCard } from '../components/note-card.js';
import { renderLoader } from '../components/loader.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { debounce, escapeHtml, initTagGlow } from '../utils.js';

// ─── Page state ───────────────────────────────────────────────────────────────

let _notes     = [];
let _activeTag = null;
let _search    = '';
let _loading   = false;

// ─── Entry point ──────────────────────────────────────────────────────────────

export function renderArchivePage() {
  _notes     = [];
  _activeTag = null;
  _search    = '';

  document.getElementById('app').innerHTML = renderShell({
    isArchive: true,
    mainHTML: `
      <div class="notes-page-header">
        <h2 id="page-heading">Архив</h2>
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
    const data = await api.getNotes({ archived: true, search: _search });
    _notes = Array.isArray(data) ? data : (data.results ?? []);
    _render();
    updateEmotionTagTree(_notes, _activeTag, _onTagClick);
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-error">
        Не удалось загрузить архив: ${escapeHtml(err.message)}
      </div>
    `;
  } finally {
    _loading = false;
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function _unarchiveNote(id) {
  const container = document.getElementById('notes-container');
  const cardEl = container?.querySelector(`.note-card[data-id="${id}"]`);

  try {
    await api.unarchiveNote(id);
    toast.success('Заметка восстановлена');

    if (cardEl) {
      cardEl.classList.add('note-card--archiving');
      cardEl.addEventListener('animationend', () => {
        _notes = _notes.filter(n => n.id !== id);
        _render();
        updateEmotionTagTree(_notes, _activeTag, _onTagClick);
      }, { once: true });
    } else {
      _notes = _notes.filter(n => n.id !== id);
      _render();
      updateEmotionTagTree(_notes, _activeTag, _onTagClick);
    }
  } catch (err) {
    toast.error('Не удалось восстановить: ' + err.message);
  }
}

async function _deleteNote(id) {
  if (!confirm('Удалить заметку навсегда? Это действие нельзя отменить.')) return;

  const container = document.getElementById('notes-container');
  const cardEl = container?.querySelector(`.note-card[data-id="${id}"]`);

  try {
    await api.deleteNote(id);
    toast.success('Заметка удалена навсегда');

    if (cardEl) {
      cardEl.classList.add('note-card--archiving');
      cardEl.addEventListener('animationend', () => {
        _notes = _notes.filter(n => n.id !== id);
        _render();
        updateEmotionTagTree(_notes, _activeTag, _onTagClick);
      }, { once: true });
    } else {
      _notes = _notes.filter(n => n.id !== id);
      _render();
      updateEmotionTagTree(_notes, _activeTag, _onTagClick);
    }
  } catch (err) {
    toast.error('Не удалось удалить: ' + err.message);
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function _render() {
  const container = document.getElementById('notes-container');
  const heading   = document.getElementById('page-heading');
  const countEl   = document.getElementById('notes-count');
  if (!container) return;

  const notes = _activeTag
    ? _notes.filter(n => (n.tags || []).includes(_activeTag))
    : _notes;

  if (heading) {
    if (_activeTag) {
      heading.textContent = `#${_activeTag}`;
    } else if (_search) {
      heading.textContent = `Поиск в архиве: "${_search}"`;
    } else {
      heading.textContent = 'Архив';
    }
  }

  if (countEl) {
    countEl.textContent = `${notes.length} заметок`;
    countEl.style.display = '';
  }

  if (notes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">${icon('archive', 'icon-xl')}</span>
        <h3 class="empty-state-title">
          ${_search || _activeTag ? 'Ничего не найдено' : 'Архив пуст'}
        </h3>
        <p class="empty-state-text">
          ${_search
            ? 'Попробуйте изменить запрос'
            : _activeTag
              ? `Нет заметок с тегом #${escapeHtml(_activeTag)}`
              : 'Заметки, перемещённые в архив, появятся здесь'}
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="notes-grid">
      ${notes.map(n => renderNoteCard(n, { isArchived: true })).join('')}
    </div>
  `;

  initTagGlow();

  container.querySelectorAll('.note-card').forEach(card => {
    const open = () => {
      sessionStorage.setItem('clarix_note_origin', 'archive');
      router.navigate(`/notes/${card.dataset.id}`);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });

  container.querySelectorAll('.note-card-unarchive-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _unarchiveNote(btn.dataset.id); });
  });

  container.querySelectorAll('.note-card-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _deleteNote(btn.dataset.id); });
  });
}

// ─── Tag click ────────────────────────────────────────────────────────────────

function _onTagClick(tag) {
  _activeTag = tag;
  _render();
  updateEmotionTagTree(_notes, _activeTag, _onTagClick);
}
