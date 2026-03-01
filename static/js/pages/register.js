import { auth } from '../auth.js';
import { router } from '../router.js';
import { icon } from '../components/icons.js';

export function renderRegisterPage() {
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
            <h1 class="auth-card-title">Регистрация</h1>
            <p class="auth-card-subtitle">Создайте новый аккаунт</p>

            <form id="reg-form" class="auth-form" novalidate>
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
                  placeholder="Минимум 8 символов"
                  autocomplete="new-password"
                  required
                  minlength="8"
                >
              </div>

              <div class="form-group">
                <label class="form-label" for="confirm">Подтвердите пароль</label>
                <input
                  id="confirm"
                  type="password"
                  class="form-input"
                  placeholder="Повторите пароль"
                  autocomplete="new-password"
                  required
                >
              </div>

              <button type="submit" class="btn btn-primary btn-lg w-full" id="submit-btn">
                Создать аккаунт
              </button>
            </form>

            <div class="auth-footer">
              Уже есть аккаунт? <a href="/login">Войти</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;

  const form      = document.getElementById('reg-form');
  const errorEl   = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm  = document.getElementById('confirm').value;

    if (!email || !password || !confirm) { showError('Заполните все поля'); return; }
    if (password.length < 8)             { showError('Пароль должен быть не менее 8 символов'); return; }
    if (password !== confirm)            { showError('Пароли не совпадают'); return; }

    setLoading(true);
    errorEl.classList.add('hidden');

    try {
      await auth.register(email, password);
      router.navigate('/notes');
    } catch (err) {
      showError(err.message || 'Ошибка регистрации');
      setLoading(false);
    }
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.textContent = on ? 'Создание...' : 'Создать аккаунт';
  }
}
