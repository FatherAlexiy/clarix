import { auth } from '../auth.js';
import { router } from '../router.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';

export function renderLoginPage() {
  document.getElementById('app').innerHTML = `
    <div class="auth-shell">
      <header class="auth-header">
        <a href="/login" class="logo">
          ${icon('logo')}
          Clarix
        </a>
      </header>

      <main class="auth-main">
        <div class="auth-card card">
          <div class="auth-card-body">
            <h1 class="auth-card-title">Вход</h1>
            <p class="auth-card-subtitle">Войдите в свой аккаунт</p>

            <form id="login-form" class="auth-form" novalidate>
              <div id="form-error" class="alert alert-error hidden"></div>

              <div class="form-group">
                <label class="form-label" for="email">Email</label>
                <input
                  id="email"
                  type="email"
                  class="form-input"
                  placeholder="you@example.com"
                  autocomplete="email"
                  required
                >
              </div>

              <div class="form-group">
                <label class="form-label" for="password">Пароль</label>
                <input
                  id="password"
                  type="password"
                  class="form-input"
                  placeholder="Введите пароль"
                  autocomplete="current-password"
                  required
                >
              </div>

              <button type="submit" class="btn btn-primary btn-lg w-full" id="submit-btn">
                Войти
              </button>
            </form>

            <div class="auth-footer">
              Нет аккаунта? <a href="/register">Зарегистрироваться</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;

  const form      = document.getElementById('login-form');
  const errorEl   = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) { showError('Заполните все поля'); return; }

    setLoading(true);
    errorEl.classList.add('hidden');

    try {
      await auth.login(email, password);
      router.navigate('/notes');
    } catch (err) {
      showError(err.message || 'Ошибка входа');
      setLoading(false);
    }
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.textContent = on ? 'Вход...' : 'Войти';
  }
}
