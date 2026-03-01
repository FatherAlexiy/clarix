class ToastManager {
  _root() {
    let el = document.getElementById('toast-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-root';
      document.body.appendChild(el);
    }
    return el;
  }

  show(message, type = 'info', duration = 3500) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    this._root().appendChild(el);

    requestAnimationFrame(() => el.classList.add('toast-show'));

    setTimeout(() => {
      el.classList.remove('toast-show');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, duration);
  }

  success(msg, dur)  { this.show(msg, 'success', dur); }
  error(msg)         { this.show(msg, 'error', 5000); }
  info(msg, dur)     { this.show(msg, 'info', dur); }
}

export const toast = new ToastManager();
