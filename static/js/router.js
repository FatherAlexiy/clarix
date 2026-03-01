class Router {
  constructor() {
    this.routes = [];
    this._notFound = null;

    window.addEventListener('popstate', () => this._handle());

    document.addEventListener('click', e => {
      const a = e.target.closest('a[href]');
      if (!a || a.dataset.external !== undefined) return;
      const url = new URL(a.href, location.origin);
      if (url.origin !== location.origin) return;
      e.preventDefault();
      this.navigate(url.pathname);
    });
  }

  add(pattern, handler, opts = {}) {
    const names = [];
    const regex = new RegExp(
      '^' + pattern.replace(/:([^/]+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$'
    );
    this.routes.push({ regex, names, handler, auth: opts.requiresAuth ?? false });
    return this;
  }

  notFound(fn) { this._notFound = fn; return this; }

  navigate(path) {
    history.pushState(null, '', path);
    this._handle();
  }

  _handle() {
    const path = location.pathname;
    for (const route of this.routes) {
      const m = path.match(route.regex);
      if (!m) continue;
      const params = {};
      route.names.forEach((n, i) => { params[n] = m[i + 1]; });
      if (route.auth && !window._auth?.isAuthenticated()) {
        this.navigate('/login');
        return;
      }
      route.handler(params);
      return;
    }
    this._notFound?.();
  }

  start() { this._handle(); }
}

export const router = new Router();
