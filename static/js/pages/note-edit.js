import { api } from '../api.js';
import { router } from '../router.js';
import { renderShell, initShell } from '../components/shell.js';
import { renderLoader } from '../components/loader.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { escapeHtml, escapeAttr } from '../utils.js';

export function renderNoteEditPage({ id }) {
  document.getElementById('app').innerHTML = renderShell({
    mainHTML: `<div id="edit-container" class="page-inner">${renderLoader()}</div>`
  });

  initShell();
  _loadAndRender(id);
}

async function _loadAndRender(id) {
  const container = document.getElementById('edit-container');
  try {
    const note = await api.getNote(id);
    _renderForm(note);
  } catch (err) {
    container.innerHTML = err.status === 404
      ? `
        <div class="empty-state">
          <span class="empty-state-icon">${icon('file', 'icon-xl')}</span>
          <h3 class="empty-state-title">Заметка не найдена</h3>
          <a href="/notes" class="btn btn-primary">К заметкам</a>
        </div>
      `
      : `<div class="alert alert-error">Ошибка загрузки: ${escapeHtml(err.message)}</div>`;
  }
}

function _renderForm(note) {
  const container = document.getElementById('edit-container');
  container.innerHTML = `
    <div class="note-form-header">
      <a href="/notes/${escapeAttr(note.id)}" class="btn btn-ghost btn-sm">
        ${icon('back')} Назад
      </a>
      <h2>Редактирование</h2>
    </div>

    <form id="note-form" class="note-form" novalidate>
      <div id="form-error" class="alert alert-error hidden"></div>

      <div class="form-group">
        <label class="form-label" for="title">Заголовок</label>
        <input
          id="title"
          type="text"
          class="form-input"
          value="${escapeAttr(note.title || '')}"
          placeholder="Название заметки"
          required
          autofocus
        >
      </div>

      <div class="form-group">
        <label class="form-label" for="content">Содержание</label>
        <textarea
          id="content"
          class="form-textarea"
          placeholder="Начните писать..."
          style="min-height: 340px;"
          required
        >${escapeHtml(note.content || '')}</textarea>
      </div>

      <div class="note-form-actions">
        <button type="submit" class="btn btn-primary" id="submit-btn">
          ${icon('check')} Сохранить
        </button>
        <a href="/notes/${escapeAttr(note.id)}" class="btn btn-secondary">Отмена</a>
      </div>
    </form>
  `;

  const form      = document.getElementById('note-form');
  const errorEl   = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const title   = document.getElementById('title').value.trim();
    const content = document.getElementById('content').value.trim();

    if (!title)   { showError('Введите заголовок'); return; }
    if (!content) { showError('Содержание не может быть пустым'); return; }

    setLoading(true);
    errorEl.classList.add('hidden');

    try {
      await api.updateNote(note.id, { title, content });
      toast.success('Заметка сохранена');
      router.navigate(`/notes/${note.id}`);
    } catch (err) {
      showError(err.message || 'Ошибка сохранения');
      setLoading(false);
    }
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.innerHTML = on ? 'Сохранение...' : `${icon('check')} Сохранить`;
  }
}
