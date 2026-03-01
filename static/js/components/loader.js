export function renderLoader(text = 'Загрузка...') {
  return `<div class="loader"><div class="spinner"></div><span>${text}</span></div>`;
}
