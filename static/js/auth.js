import { api } from './api.js';

class Auth {
  constructor() {
    this.user = null;
    this.ready = false;
    this._listeners = [];
  }

  async init() {
    if (!api.hasSession()) { this.ready = true; return; }
    try {
      this.user = await api.getMe();
    } catch {
      api.clearTokens();
      this.user = null;
    }
    this.ready = true;
    this._notify();
  }

  isAuthenticated() { return !!this.user; }
  getUser()         { return this.user; }

  async login(email, password) {
    this.user = await api.login(email, password);
    this._notify();
  }

  async register(email, password) {
    this.user = await api.register(email, password);
    this._notify();
  }

  async logout() {
    await api.logout();
    this.user = null;
    this._notify();
  }

  subscribe(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  }

  _notify() { this._listeners.forEach(fn => fn(this.user)); }
}

export const auth = new Auth();

window._auth = auth;
