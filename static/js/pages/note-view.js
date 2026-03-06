import { api } from '../api.js';
import { router } from '../router.js';
import { wsGlobal } from '../ws-global.js';
import { renderShell, initShell, updateEmotionTagTree } from '../components/shell.js';
import { renderLoader } from '../components/loader.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { formatDate, escapeHtml, escapeAttr, mixWithWhite, initTagGlow, sanitizeCssColor } from '../utils.js';

let _note          = null;
let _fromArchive   = false;
let _currentNoteId = null;   // id заметки, для которой зарегистрирован WS-listener

// ─── Entry point ──────────────────────────────────────────────────────────────

export function renderNoteViewPage({ id }) {
  if (_currentNoteId) { wsGlobal.unlisten(_currentNoteId); _currentNoteId = null; }

  _note        = null;
  _fromArchive = sessionStorage.getItem('clarix_note_origin') === 'archive';

  document.getElementById('app').innerHTML = renderShell({
    isArchive: _fromArchive,
    mainHTML: `<div id="note-container">${renderLoader()}</div>`,
  });

  initShell();
  _loadNote(id);
}

// ─── Load & render ────────────────────────────────────────────────────────────

async function _loadNote(id) {
  const container = document.getElementById('note-container');
  try {
    _note = await api.getNote(id);
    updateEmotionTagTree([_note], null, () => {});
    _renderNote();

    _currentNoteId = id;
    wsGlobal.listen(id, _handleWSMessage);
  } catch (err) {
    container.innerHTML = err.status === 404
      ? _notFound()
      : `<div class="alert alert-error">Ошибка загрузки: ${escapeHtml(err.message)}</div>`;
  }
}

function _handleWSMessage(msg) {
  const container = document.getElementById('note-container');
  if (!container || !_note || _note.id !== msg.note_id) {
    wsGlobal.unlisten(msg.note_id);
    if (_currentNoteId === msg.note_id) _currentNoteId = null;
    wsGlobal.scheduleToast(msg);
    return;
  }
  _note = { ..._note, ai_status: msg.ai_status, summary: msg.summary, tags: msg.tags, tags_with_emotions: msg.tags_with_emotions };
  _renderNote();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function _renderNote() {
  const container = document.getElementById('note-container');
  if (!container || !_note) return;

  const note = _note;
  const tags = note.tags || [];

  container.innerHTML = `
    <div class="page-inner">
      <a href="${_fromArchive ? '/archive' : '/notes'}" class="btn btn-ghost btn-sm mb-3">
        ${icon('back')} Назад
      </a>

      <article>
        <header class="note-view-header">
          <h1 class="note-view-title">${escapeHtml(note.title || 'Без названия')}</h1>
          <div class="note-view-meta">
            <span>${formatDate(note.updated_at || note.created_at)}</span>
            ${note.is_public    ? `<span class="tag">${icon('globe')} Публичная</span>`  : ''}
            ${note.is_archived  ? `<span class="tag tag-archived">${icon('archive')} В архиве</span>` : ''}
          </div>
        </header>

        <div class="note-view-content">${escapeHtml(note.content)}</div>

        ${_renderAIBlock(note, tags)}

        <div class="note-view-actions">
          <a href="/notes/${escapeAttr(note.id)}/edit" class="btn btn-secondary">
            ${icon('edit')} Редактировать
          </a>
          <button id="share-btn" class="btn btn-secondary">
            ${icon('share')} ${note.is_public ? 'Управление ссылкой' : 'Поделиться'}
          </button>

          ${note.is_archived
            ? `<button id="restore-btn" class="btn btn-secondary">
                 ${icon('restore')} Восстановить
               </button>`
            : `<button id="archive-btn" class="btn btn-secondary">
                 ${icon('archive')} В архив
               </button>`
          }

          <button id="delete-btn" class="btn btn-danger">
            ${icon('trash')} Удалить
          </button>
        </div>
      </article>
    </div>

    <div id="modal-root"></div>
  `;

  _initActions();
  initTagGlow();
}

// ─── AI block ─────────────────────────────────────────────────────────────────

function _renderTags(note) {
  const withEmotions = note.tags_with_emotions || [];
  const plain = note.tags || [];
  if (withEmotions.length > 0) {
    return withEmotions.map(item => {
      const safeColor = sanitizeCssColor(item.color);
      const textColor = mixWithWhite(safeColor, 0.7);
      return `<span class="tag tag-glow" data-color="${escapeAttr(safeColor)}"
        style="background-color:${safeColor}25;color:${textColor};border:1px solid ${safeColor}50">#${escapeHtml(item.tag)}</span>`;
    }).join('');
  }
  return plain.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('');
}

function _renderAIBlock(note, tags) {
  if (note.ai_status === 'done' && (note.summary || tags.length > 0)) {
    return `
      <div class="ai-block">
        <div class="ai-block-header">${icon('sparkles')} Insight</div>
        ${note.summary ? `<p class="ai-block-summary">${escapeHtml(note.summary)}</p>` : ''}
        ${tags.length > 0 ? `<div class="ai-block-tags">${_renderTags(note)}</div>` : ''}
      </div>
    `;
  }

  if (note.ai_status === 'pending' || note.ai_status === 'processing') {
    return `
      <div class="ai-block">
        <div class="ai-block-header">${icon('sparkles')} Insight</div>
        <div class="ai-pending-state">
          <div class="spinner ai-spinner"></div>
          <p>Через пару секунд здесь появится Insight…</p>
        </div>
      </div>
    `;
  }

  if (note.ai_status === 'failed') {
    return `
      <div class="ai-block">
        <div class="ai-block-header">${icon('sparkles')} Insight</div>
        <p style="color:var(--error);font-size:.9rem;margin-bottom:.75rem">❌ Ошибка обработки</p>
        <button id="gen-btn" class="btn btn-secondary btn-sm">Повторить</button>
      </div>
    `;
  }

  return '';
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function _initActions() {
  document.getElementById('gen-btn')?.addEventListener('click', _generateSummary);
  document.getElementById('share-btn')?.addEventListener('click', () => _showShareModal());
  document.getElementById('archive-btn')?.addEventListener('click', _archiveNote);
  document.getElementById('restore-btn')?.addEventListener('click', _restoreNote);
  document.getElementById('delete-btn')?.addEventListener('click', _deleteNote);
}

async function _generateSummary() {
  const btn = document.getElementById('gen-btn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Генерация...';

  try {
    _note = await api.generateSummary(_note.id);
    _renderNote();
    toast.success('Саммари сгенерировано');
  } catch (err) {
    if (err.status === 404 || err.status === 405) {
      toast.error('Генерация ИИ ещё не настроена на сервере');
    } else {
      toast.error(err.message || 'Ошибка генерации');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Повторить'; }
  }
}

async function _archiveNote() {
  const btn = document.getElementById('archive-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Архивирование...'; }
  try {
    await api.archiveNote(_note.id);
    wsGlobal.unlisten(_note.id);
    _currentNoteId = null;
    toast.success('Заметка перемещена в архив');
    router.navigate('/notes');
  } catch (err) {
    toast.error(err.message || 'Ошибка архивирования');
    if (btn) { btn.disabled = false; btn.innerHTML = `${icon('archive')} В архив`; }
  }
}

async function _restoreNote() {
  const btn = document.getElementById('restore-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Восстановление...'; }
  try {
    await api.unarchiveNote(_note.id);
    toast.success('Заметка восстановлена');
    _note = { ..._note, is_archived: false, archived_at: null };
    _fromArchive = false;
    _renderNote();
    document.getElementById('sidebar-all')?.classList.add('active');
    document.getElementById('sidebar-archive')?.classList.remove('active');
  } catch (err) {
    toast.error(err.message || 'Ошибка восстановления');
    if (btn) { btn.disabled = false; btn.innerHTML = `${icon('restore')} Восстановить`; }
  }
}

async function _deleteNote() {
  if (!confirm(`Удалить заметку «${_note.title}»?`)) return;
  try {
    await api.deleteNote(_note.id);
    wsGlobal.unlisten(_note.id);
    _currentNoteId = null;
    toast.success('Заметка удалена');
    router.navigate(_fromArchive ? '/archive' : '/notes');
  } catch (err) {
    toast.error(err.message || 'Ошибка удаления');
  }
}

// ─── Share modal ─────────────────────────────────────────────────────────────

function _showShareModal() {
  const root    = document.getElementById('modal-root');
  if (!root) return;
  const note    = _note;
  const isPublic = note.is_public;
  const pubUrl  = `${location.origin}/public/${note.public_token}`;

  root.innerHTML = `
    <div class="modal-overlay" id="share-modal">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Поделиться заметкой">
        <div class="modal-header">
          <h3 class="modal-title">Поделиться заметкой</h3>
          <button class="btn btn-ghost btn-icon" id="modal-close" aria-label="Закрыть">
            ${icon('x')}
          </button>
        </div>

        <div class="modal-body">
          ${isPublic ? `
            <p>Заметка доступна по публичной ссылке:</p>
            <div class="share-link-row">
              <input type="text" class="share-link-input" id="pub-url" value="${escapeAttr(pubUrl)}" readonly>
              <button class="btn btn-secondary btn-sm" id="copy-btn" aria-label="Скопировать">
                ${icon('copy')}
              </button>
            </div>
          ` : `
            <p>Создайте публичную ссылку, чтобы поделиться этой заметкой без необходимости авторизации.</p>
          `}
        </div>

        <div class="modal-footer">
          ${isPublic
            ? `<button class="btn btn-danger" id="unshare-btn">Убрать доступ</button>`
            : `<button class="btn btn-primary" id="make-public-btn">Создать ссылку</button>`
          }
        </div>
      </div>
    </div>
  `;

  const close = () => { root.innerHTML = ''; };
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('share-modal').addEventListener('click', e => { if (e.target.id === 'share-modal') close(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });

  document.getElementById('copy-btn')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(pubUrl);
    const btn = document.getElementById('copy-btn');
    if (btn) { btn.innerHTML = icon('check'); setTimeout(() => { btn.innerHTML = icon('copy'); }, 2000); }
    toast.success('Ссылка скопирована');
  });

  document.getElementById('make-public-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('make-public-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Создание...'; }
    try {
      _note = await api.shareNote(_note.id);
      close(); _renderNote();
      toast.success('Публичная ссылка создана');
    } catch (err) {
      toast.error(err.message || 'Ошибка');
      if (btn) { btn.disabled = false; btn.textContent = 'Создать ссылку'; }
    }
  });

  document.getElementById('unshare-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('unshare-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Удаление...'; }
    try {
      _note = await api.unshareNote(_note.id);
      close(); _renderNote();
      toast.info('Публичный доступ закрыт');
    } catch (err) {
      toast.error(err.message || 'Ошибка');
      if (btn) { btn.disabled = false; btn.textContent = 'Убрать доступ'; }
    }
  });
}

// ─── 404 ─────────────────────────────────────────────────────────────────────

function _notFound() {
  return `
    <div class="empty-state">
      <span class="empty-state-icon">${icon('file', 'icon-xl')}</span>
      <h3 class="empty-state-title">Заметка не найдена</h3>
      <p class="empty-state-text">Возможно, она была удалена</p>
      <a href="/notes" class="btn btn-primary">К заметкам</a>
    </div>
  `;
}
