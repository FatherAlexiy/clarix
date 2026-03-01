import { api } from '../api.js';
import { router } from '../router.js';
import { renderShell, initShell } from '../components/shell.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { escapeHtml } from '../utils.js';

export function renderNoteCreatePage() {
  document.getElementById('app').innerHTML = renderShell({
    mainHTML: `
      <div class="page-inner">
        <div class="note-form-header">
          <a href="/notes" class="btn btn-ghost btn-sm">
            ${icon('back')} Назад
          </a>
          <h2>Новая заметка</h2>
        </div>

        <form id="note-form" class="note-form" novalidate>
          <div id="form-error" class="alert alert-error hidden"></div>

          <div class="form-group">
            <label class="form-label" for="title">Заголовок</label>
            <input
              id="title"
              type="text"
              class="form-input"
              placeholder="Название заметки"
              autofocus
              required
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
            ></textarea>
          </div>

          <div class="note-form-actions">
            <button type="submit" class="btn btn-primary" id="submit-btn">
              ${icon('plus')} Создать заметку
            </button>
            <a href="/notes" class="btn btn-secondary">Отмена</a>
          </div>
        </form>
      </div>
    `
  });

  initShell();

  const form      = document.getElementById('note-form');
  const errorEl   = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const title   = document.getElementById('title').value.trim();
    const content = document.getElementById('content').value.trim();

    if (!title)   { showError('Введите заголовок'); return; }
    if (!content) { showError('Напишите содержание заметки'); return; }

    setLoading(true);
    errorEl.classList.add('hidden');

    try {
      const note = await api.createNote(title, content);
      toast.success('Заметка создана');
      router.navigate(`/notes/${note.id}`);
    } catch (err) {
      showError(err.message || 'Ошибка создания');
      setLoading(false);
    }
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.innerHTML = on
      ? 'Создание...'
      : `${icon('plus')} Создать заметку`;
  }
}
