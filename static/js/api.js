import { API_BASE } from './config.js';

// ─── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// ─── API client ───────────────────────────────────────────────────────────────

class ApiClient {
  constructor() {
    this._refreshPromise = null;
  }

  hasSession()    { return !!localStorage.getItem('clarix_session'); }
  _markSession()  { localStorage.setItem('clarix_session', '1'); }
  clearTokens()   { localStorage.removeItem('clarix_session'); }

  async _doRefresh() {
    const res = await fetch(`${API_BASE}/api/auth/refresh/`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      this.clearTokens();
      window.dispatchEvent(new CustomEvent('clarix:session-expired'));
      throw new ApiError('Сессия истекла. Войдите снова.', 401);
    }
  }

  async _tryRefresh() {
    if (!this._refreshPromise) {
      this._refreshPromise = this._doRefresh().finally(() => {
        this._refreshPromise = null;
      });
    }
    return this._refreshPromise;
  }
  
  async request(method, path, body, isRetry = false) {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== null && body !== undefined) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, opts);
    } catch {
      throw new ApiError('Нет соединения с сервером', 0);
    }

    if (res.status === 401 && !isRetry) {
      await this._tryRefresh();
      return this.request(method, path, body, true);
    }

    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) data = await res.json();

    if (!res.ok) {
      throw new ApiError(this._extractError(data, res.status), res.status, data);
    }

    return data;
  }

  _extractError(data, status) {
    if (!data) return `Ошибка ${status}`;
    if (data.detail) return data.detail;
    if (data.non_field_errors) return data.non_field_errors[0];
    const key = Object.keys(data)[0];
    if (key) {
      const val = data[key];
      return Array.isArray(val) ? `${key}: ${val[0]}` : String(val);
    }
    return `Ошибка ${status}`;
  }

  get(path)         { return this.request('GET',    path, null); }
  post(path, body)  { return this.request('POST',   path, body); }
  patch(path, body) { return this.request('PATCH',  path, body); }
  del(path)         { return this.request('DELETE', path, null); }

  async login(email, password) {
    await this.post('/api/auth/login/', { email, password });
    this._markSession();
    return this.get('/api/auth/me/');
  }

  async register(email, password) {
    await this.post('/api/auth/register/', { email, password });
    return this.login(email, password);
  }

  getMe() { return this.get('/api/auth/me/'); }

  async logout() {
    try { await this.post('/api/auth/logout/', {}); } catch { /* ignore */ }
    this.clearTokens();
  }

  getNotes({ search = '', page = 1, archived = false } = {}) {
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (page > 1) qs.set('page', String(page));
    if (archived) qs.set('archived', 'true');
    const q = qs.toString();
    return this.get(`/api/notes/${q ? '?' + q : ''}`);
  }

  searchNotes(q)               { return this.get(`/api/notes/search/?q=${encodeURIComponent(q)}`); }
  getNote(id)                  { return this.get(`/api/notes/${id}/`); }
  createNote(title, content)   { return this.post('/api/notes/', { title, content }); }
  updateNote(id, data)         { return this.patch(`/api/notes/${id}/`, data); }
  deleteNote(id)               { return this.del(`/api/notes/${id}/`); }
  archiveNote(id)              { return this.post(`/api/notes/${id}/archive/`, {}); }
  unarchiveNote(id)            { return this.post(`/api/notes/${id}/unarchive/`, {}); }
  generateSummary(id)          { return this.post(`/api/notes/${id}/generate_summary/`, {}); }
  shareNote(id)                { return this.patch(`/api/notes/${id}/`, { is_public: true }); }
  unshareNote(id)              { return this.patch(`/api/notes/${id}/`, { is_public: false }); }
  getPublicNote(token)         { return this.get(`/api/notes/public/${token}/`); }
}

export const api = new ApiClient();
