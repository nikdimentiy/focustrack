import { authState, signIn, signOut } from './authState.js';
import { purgeCloudData } from '../services/cloudSessions.js';
import { doSync } from '../services/syncEngine.js';
import { toast } from '../shared/Toast.js';
import { clearAll } from '../services/storage.js';
import { timerStore } from '../store/timerStore.js';
import { trackerStore } from '../store/trackerStore.js';
import { resetTimer } from '../timer/timerEngine.js';

export const AuthWidget = {
  _el: null,

  mount(container) {
    this._el = container;
    this._render();
    authState.subscribe(() => this._render());
  },

  _render() {
    const authed = authState.isAuthed();
    const email  = authState.getEmail() ?? '';
    this._el.innerHTML = `
      <div class="cloud-auth-widget">
        <div class="caw-header">
          <div class="caw-dot" id="cawDot" style="${authed ? 'background:var(--neon-green);box-shadow:0 0 6px rgba(57,255,20,0.8)' : ''}"></div>
          <span class="caw-label">Cloud DB</span>
          <span class="caw-status" style="${authed ? 'color:var(--neon-green)' : ''}">${authed ? 'online' : 'offline'}</span>
        </div>
        ${authed ? this._userHTML(email) : this._guestHTML()}
      </div>`;

    if (authed) {
      this._el.querySelector('#btnSync').addEventListener('click', () => doSync());
      this._el.querySelector('#btnSignOut').addEventListener('click', async () => { await signOut(); });
      this._el.querySelector('#btnPurge').addEventListener('click', () => this._purge());
    } else {
      this._el.querySelector('#loginForm').addEventListener('submit', e => this._login(e));
    }
    this._el.querySelector('#btnWipeLocal').addEventListener('click', () => this._wipeLocal());
  },

  _guestHTML() {
    return `
      <form id="loginForm" autocomplete="on">
        <input id="authEmail" class="caw-input" type="email" placeholder="email" autocomplete="username email">
        <input id="authPassword" class="caw-input" type="password" placeholder="password" autocomplete="current-password">
        <button id="btnSignIn" type="submit" class="caw-btn">
          <i class="fas fa-bolt" style="font-size:.6rem;margin-right:4px"></i>access
        </button>
      </form>
      <button id="btnWipeLocal" type="button" class="caw-purge" style="margin-top:8px">
        <i class="fas fa-broom" style="margin-right:4px"></i>wipe local cache
      </button>`;
  },

  _userHTML(email) {
    return `
      <span class="caw-greeting">${email}</span>
      <div style="display:flex;gap:4px;margin-top:4px">
        <button id="btnSync" type="button" class="caw-btn" style="flex:1;margin-top:0">
          <i class="fas fa-sync" style="font-size:.6rem;margin-right:4px"></i>sync
        </button>
        <button id="btnSignOut" type="button" class="caw-signout" style="flex:1">
          <i class="fas fa-sign-out-alt" style="margin-right:4px"></i>exit
        </button>
      </div>
      <button id="btnPurge" type="button" class="caw-purge">
        <i class="fas fa-trash-alt" style="margin-right:4px"></i>purge all data
      </button>
      <button id="btnWipeLocal" type="button" class="caw-purge" style="margin-top:4px">
        <i class="fas fa-broom" style="margin-right:4px"></i>wipe local cache
      </button>`;
  },

  async _login(e) {
    e.preventDefault();
    const email = this._el.querySelector('#authEmail').value.trim();
    const pwd   = this._el.querySelector('#authPassword').value;
    if (!email || !pwd) return;
    const btn = this._el.querySelector('#btnSignIn');
    btn.innerHTML = "<i class='fas fa-spinner fa-spin' style='font-size:.6rem;margin-right:4px'></i>wait...";
    btn.disabled = true;
    try {
      await signIn(email, pwd);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = "<i class='fas fa-bolt' style='font-size:.6rem;margin-right:4px'></i>access";
      const msg = err.message || String(err);
      const code = err.code || '';
      if (code === 'email_not_confirmed' || msg.toLowerCase().includes('email not confirmed')) {
        alert('Email not confirmed.\n\nCheck Supabase → Authentication → Users and confirm your email.');
      } else if (code === 'invalid_credentials' || msg.toLowerCase().includes('invalid login')) {
        alert('Invalid credentials. Check your email/password.');
      } else {
        alert('Auth failed: ' + msg);
      }
    }
  },

  _wipeLocal() {
    if (!confirm('WIPE ALL LOCAL CACHE?\n\nClears all locally stored sessions, topics, and timer state.\nCloud data is not affected.')) return;
    resetTimer();
    clearAll();
    timerStore.set({ running: false, elapsedSeconds: 0, sessionStartedAt: null, task: '', intensity: 'Focus', sessions: [] });
    trackerStore.set([]);
    toast.show('Local cache wiped', 'success');
  },

  async _purge() {
    if (!authState.isAuthed()) { alert('Session expired. Please sign out and sign in again.'); return; }
    if (!confirm('PURGE ALL CLOUD DATA?\n\nPermanently deletes all sessions and timer state.\n\nCannot be undone.')) return;
    const btn = this._el.querySelector('#btnPurge');
    btn.disabled = true;
    btn.innerHTML = "<i class='fas fa-spinner fa-spin' style='font-size:.6rem;margin-right:4px'></i>purging...";
    try {
      await purgeCloudData();
      toast.show('Cloud data purged', 'success');
    } catch (err) {
      toast.show('Purge failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = "<i class='fas fa-trash-alt' style='margin-right:4px'></i>purge all data";
    }
  },
};
