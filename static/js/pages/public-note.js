import { api } from '../api.js';
import { renderLoader } from '../components/loader.js';
import { icon } from '../components/icons.js';
import { formatDate, escapeHtml } from '../utils.js';

export function renderPublicNotePage({ token }) {
  document.getElementById('app').innerHTML = `
    <div class="public-shell">
      <div class="public-banner">
        ${icon('globe')} Публичная заметка · только чтение
      </div>

      <header class="public-header">
        <a href="/login" class="logo">
          ${icon('logo')}
          Clarix
        </a>
      </header>

      <div class="public-content" id="public-container">
        ${renderLoader()}
      </div>
    </div>
  `;

  _loadNote(token);
}

async function _loadNote(token) {
  const container = document.getElementById('public-container');
  try {
    const note = await api.getPublicNote(token);
    const tags = note.tags || [];

    container.innerHTML = `
      <article>
        <header class="note-view-header">
          <h1 class="note-view-title">${escapeHtml(note.title || 'Без названия')}</h1>
          <div class="note-view-meta">
            <span>${formatDate(note.updated_at || note.created_at)}</span>
          </div>
        </header>

        <div class="note-view-content">${escapeHtml(note.content)}</div>

        ${note.summary || tags.length > 0 ? `
          <div class="ai-block">
            <div class="ai-block-header">${icon('sparkles')} Insight</div>
            ${note.summary ? `<p class="ai-block-summary">${escapeHtml(note.summary)}</p>` : ''}
            ${tags.length > 0 ? `
              <div class="ai-block-tags">
                ${tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div style="margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); text-align: center;">
          <p style="margin-bottom: 1rem;">Создавайте собственные AI-заметки в Clarix</p>
          <a href="/register" class="btn btn-primary">Попробовать бесплатно</a>
        </div>
      </article>
    `;
  } catch (err) {
    container.innerHTML = err.status === 404
      ? `
        <div class="empty-state">
          <span class="empty-state-icon">${icon('file', 'icon-xl')}</span>
          <h3 class="empty-state-title">Заметка не найдена</h3>
          <p class="empty-state-text">Возможно, ссылка устарела или доступ был закрыт</p>
          <a href="/login" class="btn btn-primary">Войти в Clarix</a>
        </div>
      `
      : `<div class="alert alert-error">Ошибка загрузки: ${escapeHtml(err.message)}</div>`;
  }
}
