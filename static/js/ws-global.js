import { toast } from './components/toast.js';

function _truncate(str, max = 32) {
  return str.length > max ? str.slice(0, max).trimEnd() + '…' : str;
}

/**
 * note-view.js регистрирует/снимает listener для конкретной заметки:
 *   wsGlobal.listen(noteId, callback)   — пока пользователь на странице заметки
 *   wsGlobal.unlisten(noteId)           — при уходе со страницы
 *
 * notes.js / archive.js подписываются на все обновления для live-обновления карточек:
 *   wsGlobal.onAnyUpdate(callback)
 *   wsGlobal.offAnyUpdate(callback)
 *
 * Toast показывается один раз — только когда приходит сообщение с тегами
 * (финальный шаг AI-обработки). Сообщение от generate_summary игнорируется.
 */
class GlobalWSManager {
  constructor() {
    this._ws            = null;
    this._listeners     = new Map();   // noteId - callback(msg)
    this._pageListeners = new Set();   // page-level listeners (notes.js)
    this._reconnTimer   = null;
    this._delay         = 2000;
    this._enabled       = false;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  connect() {
    this._enabled = true;
    this._open();
  }

  disconnect() {
    this._enabled = false;
    clearTimeout(this._reconnTimer);
    this._listeners.clear();
    this._pageListeners.clear();
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.close();
      this._ws = null;
    }
  }

  listen(noteId, callback) {
    this._listeners.set(noteId, callback);
  }

  unlisten(noteId) {
    this._listeners.delete(noteId);
  }

  onAnyUpdate(callback) {
    this._pageListeners.add(callback);
  }

  offAnyUpdate(callback) {
    this._pageListeners.delete(callback);
  }

  scheduleToast(msg) {
    if (msg.ai_status !== 'done') return;
    if (!Array.isArray(msg.tags) || msg.tags.length === 0) return;
    const name = msg.note_title ? `«${_truncate(msg.note_title)}» — готово!` : 'Заметка готова!';
    toast.success(`✨ ${name}`, 6000);
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  _open() {
    if (!this._enabled) return;
    if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) return;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url   = `${proto}//${location.host}/ws/notes/`;
    this._ws    = new WebSocket(url);

    this._ws.onopen = () => {
      console.log('[WS] connected');
      this._delay = 2000;
    };

    this._ws.onmessage = ({ data }) => {
      try { this._handle(JSON.parse(data)); } catch { /* ignore */ }
    };

    this._ws.onerror = () => {};

    this._ws.onclose = () => {
      if (!this._enabled) return;
      console.warn(`[WS] closed — reconnect in ${this._delay}ms`);
      this._reconnTimer = setTimeout(() => this._open(), this._delay);
      this._delay = Math.min(this._delay * 2, 30_000);
    };
  }

  _handle(msg) {
    if (msg.type !== 'note_updated') return;

    for (const cb of this._pageListeners) cb(msg);

    const cb = this._listeners.get(msg.note_id);
    if (cb) {
      cb(msg);
      return;
    }

    this.scheduleToast(msg);
  }
}

export const wsGlobal = new GlobalWSManager();
