import { formatDate, escapeHtml, escapeAttr, truncate, mixWithWhite, sanitizeCssColor } from '../utils.js';
import { icon } from './icons.js';

const AI = {
  processing: { label: '<span class="ai-badge-dot"></span>AI обрабатывает…', cls: 'ai-active' },
  pending:    { label: '<span class="ai-badge-dot"></span>AI обрабатывает…', cls: 'ai-active' },
  failed:     { label: '✕ Ошибка AI',                                        cls: 'ai-failed' },
};

function _cardTags(note) {
  const withEmotions = (note.tags_with_emotions || []).slice(0, 3);
  const plain = (note.tags || []).slice(0, 3);
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

export function renderNoteCard(note, { isArchived = false } = {}) {
  const preview = truncate(note.content, 130);
  const tags    = (note.tags || []).slice(0, 3);
  const ai      = AI[note.ai_status] ?? null;
  const date    = formatDate(note.updated_at || note.created_at);

  const actions = isArchived
    ? `<div class="note-card-actions note-card-actions--visible">
        <button class="note-card-action-btn note-card-unarchive-btn" data-id="${escapeAttr(note.id)}" title="Восстановить">
          ${icon('restore')}
        </button>
        <button class="note-card-action-btn note-card-delete-btn" data-id="${escapeAttr(note.id)}" title="Удалить навсегда">
          ${icon('trash')}
        </button>
      </div>`
    : `<div class="note-card-actions">
        <button class="note-card-action-btn note-card-archive-btn" data-id="${escapeAttr(note.id)}" title="В архив">
          ${icon('archive')}
        </button>
        <button class="note-card-action-btn note-card-edit-btn" data-id="${escapeAttr(note.id)}" title="Редактировать">
          ${icon('edit')}
        </button>
      </div>`;

  return `
    <article
      class="card card-hover note-card${isArchived ? ' note-card--archived' : ''}"
      data-id="${escapeAttr(note.id)}"
      tabindex="0"
      role="button"
      aria-label="${escapeAttr(note.title || 'Без названия')}"
    >
      ${actions}
      <div class="note-card-body">
        <h3 class="note-card-title">${escapeHtml(note.title || 'Без названия')}</h3>

        <p class="note-card-preview">${
          preview
            ? escapeHtml(preview)
            : '<em style="color:var(--text-muted)">Пустая заметка</em>'
        }</p>

        ${(tags.length > 0 || ai) ? `
          <div class="note-card-tags">
            ${tags.length > 0 ? _cardTags(note) : ''}
            ${ai ? `<span class="ai-badge ${ai.cls}">${ai.label}</span>` : ''}
          </div>
        ` : ''}

        <div class="note-card-footer">
          <span class="note-card-date">${date}</span>
        </div>
      </div>
    </article>
  `;
}
