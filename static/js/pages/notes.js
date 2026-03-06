import { api } from '../api.js';
import { router } from '../router.js';
import { wsGlobal } from '../ws-global.js';
import { renderShell, initShell, updateEmotionTagTree } from '../components/shell.js';
import { renderNoteCard } from '../components/note-card.js';
import { renderLoader } from '../components/loader.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { debounce, escapeHtml, initTagGlow } from '../utils.js';

// ─── Page state ───────────────────────────────────────────────────────────────

let _allNotes    = [];
let _activeTag   = null;
let _search      = '';
let _totalCount  = 0;
let _loading     = false;
let _pollInterval = null;

// ─── Entry point ──────────────────────────────────────────────────────────────

export function renderNotesPage() {
  sessionStorage.removeItem('clarix_note_origin');
  _stopPolling();
  _allNotes  = [];
  _activeTag = null;
  _search    = '';

  wsGlobal.offAnyUpdate(_handleWSUpdate);
  wsGlobal.onAnyUpdate(_handleWSUpdate);

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
    updateEmotionTagTree(_allNotes, _activeTag, _onTagClick);
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

// ─── Archive action ───────────────────────────────────────────────────────────

async function _archiveNote(id) {
  const container = document.getElementById('notes-container');
  const cardEl    = container?.querySelector(`.note-card[data-id="${id}"]`);

  try {
    await api.archiveNote(id);
    toast.success('Заметка перемещена в архив');

    if (cardEl) {
      cardEl.classList.add('note-card--archiving');
      cardEl.addEventListener('animationend', () => {
        _allNotes = _allNotes.filter(n => n.id !== id);
        _render();
        updateEmotionTagTree(_allNotes, _activeTag, _onTagClick);
      }, { once: true });
    } else {
      _allNotes = _allNotes.filter(n => n.id !== id);
      _render();
      updateEmotionTagTree(_allNotes, _activeTag, _onTagClick);
    }
  } catch (err) {
    toast.error('Не удалось архивировать: ' + err.message);
  }
}

// ─── Render notes grid ────────────────────────────────────────────────────────

function _render() {
  const container = document.getElementById('notes-container');
  const heading   = document.getElementById('page-heading');
  const countEl   = document.getElementById('notes-count');
  if (!container || !heading || !countEl) return;

  const notes = _activeTag
    ? _allNotes.filter(n => (n.tags || []).includes(_activeTag))
    : _allNotes;

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

  container.querySelectorAll('.note-card').forEach(card => {
    const open = () => router.navigate(`/notes/${card.dataset.id}`);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });

  container.querySelectorAll('.note-card-archive-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _archiveNote(btn.dataset.id); });
  });

  container.querySelectorAll('.note-card-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); router.navigate(`/notes/${btn.dataset.id}/edit`); });
  });

  const hasPending = _allNotes.some(n => n.ai_status === 'pending' || n.ai_status === 'processing');
  if (hasPending) _startPolling();
  else _stopPolling();
}

// ─── AI status polling ────────────────────────────────────────────────────────

function _startPolling() {
  if (_pollInterval) return;
  _pollInterval = setInterval(_pollPendingNotes, 3000);
}

function _stopPolling() {
  clearInterval(_pollInterval);
  _pollInterval = null;
}

async function _pollPendingNotes() {
  if (!document.getElementById('notes-container')) {
    _stopPolling();
    return;
  }
  const pending = _allNotes.filter(n => n.ai_status === 'pending' || n.ai_status === 'processing');
  if (!pending.length) { _stopPolling(); return; }

  let changed = false;
  await Promise.all(pending.map(async n => {
    try {
      const fresh = await api.getNote(n.id);
      const idx = _allNotes.findIndex(x => x.id === fresh.id);
      if (idx !== -1 && fresh.ai_status !== _allNotes[idx].ai_status) {
        _allNotes[idx] = { ..._allNotes[idx], ...fresh };
        changed = true;
      }
    } catch (_) {}
  }));

  if (changed) {
    _render();
    updateEmotionTagTree(_allNotes, _activeTag, _onTagClick);
  }
}

// ─── Tag click ────────────────────────────────────────────────────────────────

function _onTagClick(tag) {
  _activeTag = tag;
  _render();
  updateEmotionTagTree(_allNotes, _activeTag, _onTagClick);
}

// ─── Live WS update ──────────────────────────────────────────────────────────

function _handleWSUpdate(msg) {
  if (!document.getElementById('notes-container')) {
    wsGlobal.offAnyUpdate(_handleWSUpdate);
    return;
  }
  const idx = _allNotes.findIndex(n => n.id === msg.note_id);
  if (idx === -1) return;
  _allNotes[idx] = {
    ..._allNotes[idx],
    ai_status:         msg.ai_status,
    summary:           msg.summary,
    tags:              msg.tags,
    tags_with_emotions: msg.tags_with_emotions,
  };
  _render();
  updateEmotionTagTree(_allNotes, _activeTag, _onTagClick);
}
