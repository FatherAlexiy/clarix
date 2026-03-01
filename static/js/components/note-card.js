import { formatDate, escapeHtml, escapeAttr, truncate, mixWithWhite } from '../utils.js';

const AI = {
  processing: { label: '⏳ Обрабатывается', cls: 'ai-processing' },
  pending:    { label: '⏳ Ожидает ИИ',     cls: 'ai-pending' },
  failed:     { label: '❌ Ошибка ИИ',      cls: 'ai-failed' },
};

function _cardTags(note) {
  const withEmotions = (note.tags_with_emotions || []).slice(0, 3);
  const plain = (note.tags || []).slice(0, 3);
  if (withEmotions.length > 0) {
    return withEmotions.map(item => {
      const textColor = mixWithWhite(item.color, 0.7);
      return `<span class="tag tag-glow" data-color="${item.color}"
        style="background-color:${item.color}25;color:${textColor};border:1px solid ${item.color}50">#${escapeHtml(item.tag)}</span>`;
    }).join('');
  }
  return plain.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('');
}

export function renderNoteCard(note) {
  const preview = truncate(note.content, 130);
  const tags    = (note.tags || []).slice(0, 3);
  const ai      = AI[note.ai_status] ?? null;
  const date    = formatDate(note.updated_at || note.created_at);

  return `
    <article
      class="card card-hover note-card"
      data-id="${escapeAttr(note.id)}"
      tabindex="0"
      role="button"
      aria-label="${escapeAttr(note.title || 'Без названия')}"
    >
      <div class="note-card-body">
        <h3 class="note-card-title">${escapeHtml(note.title || 'Без названия')}</h3>

        <p class="note-card-preview">${
          preview
            ? escapeHtml(preview)
            : '<em style="color:var(--text-muted)">Пустая заметка</em>'
        }</p>

        ${tags.length > 0 ? `
          <div class="note-card-tags">
            ${_cardTags(note)}
          </div>
        ` : ''}

        <div class="note-card-footer">
          ${ai ? `<span class="ai-badge ${ai.cls}">${ai.label}</span>` : ''}
          <span class="note-card-date">${date}</span>
        </div>
      </div>
    </article>
  `;
}
