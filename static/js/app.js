import { router } from './router.js';
import { auth } from './auth.js';
import { renderLoginPage } from './pages/login.js';
import { renderRegisterPage } from './pages/register.js';
import { renderNotesPage } from './pages/notes.js';
import { renderNoteViewPage } from './pages/note-view.js';
import { renderNoteCreatePage } from './pages/note-create.js';
import { renderNoteEditPage } from './pages/note-edit.js';
import { renderPublicNotePage } from './pages/public-note.js';

document.getElementById('app').innerHTML = `
  <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;gap:.75rem;color:var(--text-muted);font-size:.875rem">
    <div class="spinner"></div>
    Загрузка...
  </div>
`;

async function boot() {
  await auth.init();

  router
    .add('/login', () => {
      auth.isAuthenticated() ? router.navigate('/notes') : renderLoginPage();
    })
    .add('/register', () => {
      auth.isAuthenticated() ? router.navigate('/notes') : renderRegisterPage();
    })
    .add('/notes', renderNotesPage, { requiresAuth: true })
    .add('/notes/create', renderNoteCreatePage, { requiresAuth: true })
    .add('/notes/:id/edit', renderNoteEditPage, { requiresAuth: true })
    .add('/notes/:id', renderNoteViewPage, { requiresAuth: true })
    .add('/public/:token', renderPublicNotePage)
    .notFound(() => {
      router.navigate(auth.isAuthenticated() ? '/notes' : '/login');
    });

  auth.subscribe(user => {
    if (!user && !location.pathname.startsWith('/public')) {
      router.navigate('/login');
    }
  });

  window.addEventListener('clarix:session-expired', () => auth.logout());

  router.start();
}

boot().catch(err => {
  console.error('Boot error:', err);
  document.getElementById('app').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:1rem;padding:2rem;text-align:center">
      <p style="color:var(--error)">Не удалось запустить приложение.</p>
      <p style="color:var(--text-muted);font-size:.875rem">Убедитесь, что сервер запущен на <code>localhost:8000</code></p>
      <button onclick="location.reload()" style="margin-top:.5rem" class="btn btn-secondary">Обновить страницу</button>
    </div>
  `;
});
