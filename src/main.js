import './design/fonts.css';
import './design/tokens.css';
import './design/base.css';
import './design/components.css';

import { timerStore } from './store/timerStore.js';
import { trackerStore } from './store/trackerStore.js';
import { loadTimerState, loadSessions, loadTopics } from './services/storage.js';
import { restoreTimer, startTimer, pauseTimer, stopTimer, resetTimer, updateSession, setSessionNote } from './timer/timerEngine.js';
import { calcStatus } from './shared/utils.js';

import { AuthWidget } from './auth/AuthWidget.js';
import { initAuth, authState } from './auth/authState.js';
import { doSync, onSyncStatus } from './services/syncEngine.js';
import { onPendingCount, getPendingCount, drainQueue } from './services/offlineQueue.js';
import { Nav } from './shared/Nav.js';
import { toast } from './shared/Toast.js';
import { mountFooterWidget, mountInfoButton } from './shared/FooterWidget.js';
import { mountSettingsButton } from './shared/SettingsModal.js';
import { mountTimerView } from './timer/TimerView.js';
import { mountTrackerView } from './tracker/TrackerView.js';
import { mountAnalyticsView } from './analytics/AnalyticsView.js';
import { checkReviewReminders } from './services/notifications.js';
import { settings } from './shared/settings.js';
import { registerBackgroundSync } from './services/pushService.js';
import { exportTopics, exportSessionsCSV, exportFullBackup } from './tracker/trackerEngine.js';
import { CommandPalette } from './shared/CommandPalette.js';

async function boot() {
  // Restore persisted state before mounting views
  const savedState    = await loadTimerState();
  const savedSessions = await loadSessions();
  const savedTopics   = (await loadTopics()).map(t => ({ ...t, status: calcStatus(t.nextRepeat) }));

  timerStore.set({ sessions: savedSessions });
  trackerStore.set(savedTopics);
  restoreTimer(savedState, savedSessions);

  // Mount UI
  mountFooterWidget(document.getElementById('footer-widget'));
  mountInfoButton(document.getElementById('info-btn'));
  mountSettingsButton(document.getElementById('settings-btn'));
  toast.mount(document.getElementById('toast-container'));
  AuthWidget.mount(document.getElementById('auth-widget'));

  let _currentView = 'dw';
  Nav.onSwitch(v => { _currentView = v; });
  Nav.mount(document.getElementById('nav'));

  mountTimerView(document.getElementById('dw-view'));
  mountTrackerView(document.getElementById('tr-view'));
  mountAnalyticsView(document.getElementById('an-view'));
  _mountNoteModal();

  // Command palette
  const palette = new CommandPalette();
  palette.register([
    { label: 'Go to Timer',           group: 'Navigate', shortcut: '1',     action: () => Nav.switchTo('dw') },
    { label: 'Go to Tracker',         group: 'Navigate', shortcut: '2',     action: () => Nav.switchTo('tr') },
    { label: 'Go to Analytics',       group: 'Navigate', shortcut: '3',     action: () => Nav.switchTo('an') },
    { label: 'Start Timer',           group: 'Timer',    shortcut: 'Ctrl+Shift+S', action: () => { Nav.switchTo('dw'); startTimer(); } },
    { label: 'Pause Timer',           group: 'Timer',    shortcut: 'Ctrl+Shift+H', action: () => { Nav.switchTo('dw'); pauseTimer(); } },
    { label: 'Stop Timer',            group: 'Timer',    shortcut: 'Ctrl+Shift+P', action: () => { Nav.switchTo('dw'); stopTimer(); } },
    { label: 'Reset Timer',           group: 'Timer',    shortcut: 'Ctrl+Shift+R', action: () => { Nav.switchTo('dw'); resetTimer(); } },
    { label: 'Add Topic',             group: 'Tracker',  shortcut: 'Ctrl+Shift+T', action: () => { Nav.switchTo('tr'); document.getElementById('add-topic')?.click(); } },
    { label: 'Log Note',              group: 'Timer',    shortcut: 'Ctrl+Shift+N', action: () => _openNoteModal() },
    { label: 'Export Topics (JSON)',  group: 'Tracker',  shortcut: 'Ctrl+Alt+J',   action: () => exportTopics() },
    { label: 'Export Sessions (CSV)', group: 'Tracker',  shortcut: 'Ctrl+Alt+C',   action: () => exportSessionsCSV() },
    { label: 'Export Full Backup',    group: 'Tracker',  shortcut: 'Ctrl+Alt+B',   action: () => exportFullBackup() },
    { label: 'Open Shortcuts',        group: 'App',      shortcut: 'Ctrl+K',       action: () => palette.open() },
    { label: 'Open Settings',         group: 'App',      shortcut: ',',            action: () => document.getElementById('settings-open')?.click() },
    { label: 'Open Help',             group: 'App',      shortcut: '?',            action: () => document.getElementById('info-open')?.click() },
  ]);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    const inInput = tag === 'input' || tag === 'textarea' || tag === 'select';
    const modalOpen = document.getElementById('topic-modal')?.classList.contains('active') ||
                      document.getElementById('session-edit-modal')?.classList.contains('active') ||
                      document.getElementById('settings-modal')?.classList.contains('active') ||
                      document.getElementById('confirm-modal')?.classList.contains('active');

    // Cmd+K / Ctrl+K — toggle palette (works from anywhere, including inputs)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      palette.isOpen() ? palette.close() : palette.open();
      return;
    }

    // Ctrl+Shift+* timer & tracker shortcuts (work everywhere, including inputs)
    if (e.ctrlKey && e.shiftKey && !e.altKey) {
      switch (e.key.toUpperCase()) {
        case 'S': e.preventDefault(); Nav.switchTo('dw'); startTimer(); return;
        case 'H': e.preventDefault(); Nav.switchTo('dw'); pauseTimer(); return;
        case 'P': e.preventDefault(); Nav.switchTo('dw'); stopTimer(); return;
        case 'R': e.preventDefault(); Nav.switchTo('dw'); resetTimer(); return;
        case 'T': e.preventDefault(); Nav.switchTo('tr'); document.getElementById('add-topic')?.click(); return;
        case 'N': e.preventDefault(); _openNoteModal(); return;
      }
    }

    // Ctrl+Alt+* export shortcuts (work everywhere, including inputs)
    if (e.ctrlKey && e.altKey && !e.shiftKey) {
      switch (e.key.toUpperCase()) {
        case 'J': e.preventDefault(); exportTopics(); return;
        case 'C': e.preventDefault(); exportSessionsCSV(); return;
        case 'B': e.preventDefault(); exportFullBackup(); return;
      }
    }

    if (e.key === 'Escape') {
      document.getElementById('topic-modal')?.classList.remove('active');
      document.getElementById('session-edit-modal')?.classList.remove('active');
      document.getElementById('settings-modal')?.classList.remove('active');
      document.getElementById('info-modal')?.classList.remove('active');
      return;
    }
    if (inInput || modalOpen) return;

    if (e.key === '1') { e.preventDefault(); Nav.switchTo('dw'); return; }
    if (e.key === '2') { e.preventDefault(); Nav.switchTo('tr'); return; }
    if (e.key === '3') { e.preventDefault(); Nav.switchTo('an'); return; }

    if (e.key === '?' || e.key === '/') {
      e.preventDefault();
      document.getElementById('info-open')?.click();
      return;
    }

    if (e.key === ' ' && _currentView === 'dw') {
      e.preventDefault();
      timerStore.get().running ? pauseTimer() : startTimer();
      return;
    }
  });

  // Review reminders — check once on load (after a short delay so status is calculated)
  setTimeout(() => {
    const s = settings.get();
    checkReviewReminders(trackerStore.get(), s.notifyReviews);
    // Re-register periodic sync in case the SW was updated and lost the registration
    if (s.pushEnabled && 'Notification' in window && Notification.permission === 'granted') {
      registerBackgroundSync();
    }
  }, 3000);

  // Re-check reminders when tracker data changes (e.g. after sync)
  trackerStore.subscribe(topics => {
    const s = settings.get();
    if (s.notifyReviews) checkReviewReminders(topics, true);
  });

  // Init auth — triggers doSync() on login
  initAuth(doSync);

  _wireSyncDot();
  _mountCloudBanner();
  _mountOfflineBar();
  _handleURLAction();
}

function _handleURLAction() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  const view   = params.get('view');

  if (view && ['dw', 'tr', 'an'].includes(view)) Nav.switchTo(view);

  if (action === 'start-timer') {
    Nav.switchTo('dw');
    startTimer();
  } else if (action === 'add-topic') {
    Nav.switchTo('tr');
    setTimeout(() => document.getElementById('add-topic')?.click(), 80);
  }

  if (action || view) {
    const url = new URL(window.location.href);
    url.searchParams.delete('action');
    url.searchParams.delete('view');
    window.history.replaceState({}, '', url.pathname + (url.search.length > 1 ? url.search : ''));
  }
}

function _wireSyncDot() {
  const dot = document.getElementById('sync-dot');
  if (!dot) return;

  let lastStatus = null;
  let _pendingCount = 0;

  const _update = () => {
    if (!authState.isAuthed()) {
      dot.className = 'nav-sync-dot sync-offline';
      dot.title = 'Not signed in';
      return;
    }
    if (lastStatus === null) {
      dot.className = 'nav-sync-dot sync-offline';
      dot.title = 'Awaiting sync…';
      return;
    }
    const pending = _pendingCount > 0 ? ` · ${_pendingCount} pending` : '';
    const map = {
      syncing: ['nav-sync-dot sync-syncing', `Syncing…${pending}`],
      synced:  ['nav-sync-dot sync-synced',  _pendingCount > 0 ? `${_pendingCount} changes queued` : 'Up to date'],
      error:   ['nav-sync-dot sync-error',   `Sync failed${pending}`],
    };
    const [cls, title] = map[lastStatus] || ['nav-sync-dot sync-offline', `Offline${pending}`];
    dot.className = cls;
    dot.title = title;
  };

  onSyncStatus(status => {
    if (status === 'idle') return;
    lastStatus = status;
    _update();
  });

  onPendingCount(count => { _pendingCount = count; _update(); });
  getPendingCount().then(count => { _pendingCount = count; _update(); });

  authState.subscribe(_update);
  _update();
}

function _mountCloudBanner() {
  const el = document.getElementById('cloud-banner');
  if (!el) return;

  let dismissed = sessionStorage.getItem('cloud-banner-dismissed') === '1';

  el.innerHTML = `
    <div class="cb-inner">
      <svg class="cb-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>
      </svg>
      <span class="cb-text">Data saved locally only — <button class="cb-link" id="cb-signin">sign in</button> to sync to the cloud.</span>
      <button class="cb-dismiss" id="cb-dismiss" aria-label="Dismiss">×</button>
    </div>`;

  el.querySelector('#cb-dismiss').addEventListener('click', () => {
    dismissed = true;
    sessionStorage.setItem('cloud-banner-dismissed', '1');
    el.classList.remove('cb-visible');
  });

  el.querySelector('#cb-signin').addEventListener('click', () => {
    const widget = document.querySelector('.cloud-auth-widget');
    if (widget) {
      widget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      widget.classList.add('cb-highlight');
      setTimeout(() => widget.classList.remove('cb-highlight'), 1200);
    }
  });

  const _update = () => {
    if (!dismissed && !authState.isAuthed()) {
      el.classList.add('cb-visible');
    } else {
      el.classList.remove('cb-visible');
    }
  };

  authState.subscribe(_update);
  _update();
}

function _mountOfflineBar() {
  const bar = document.createElement('div');
  bar.id = 'offline-bar';
  bar.className = 'offline-bar';
  bar.innerHTML = `
    <div class="ob-inner">
      <svg class="ob-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M6.343 6.343a8 8 0 000 11.314M12 12h.01"/>
      </svg>
      <span class="ob-text" id="ob-text"></span>
      <button class="ob-retry" id="ob-retry">Retry now</button>
    </div>`;
  document.body.appendChild(bar);

  const textEl  = bar.querySelector('#ob-text');
  const retryEl = bar.querySelector('#ob-retry');
  let _pending = 0;
  let _retrying = false;

  const _render = () => {
    if (_pending === 0) { bar.classList.remove('ob-visible'); return; }
    const isOnline = navigator.onLine;
    textEl.textContent = isOnline
      ? `Sync error — ${_pending} change${_pending > 1 ? 's' : ''} pending`
      : `Offline — ${_pending} change${_pending > 1 ? 's' : ''} queued for sync`;
    retryEl.style.display = isOnline ? '' : 'none';
    bar.classList.add('ob-visible');
  };

  retryEl.addEventListener('click', async () => {
    if (_retrying) return;
    _retrying = true;
    retryEl.textContent = 'Retrying…';
    retryEl.disabled = true;
    try { await drainQueue(); } finally {
      _retrying = false;
      retryEl.textContent = 'Retry now';
      retryEl.disabled = false;
    }
  });

  onPendingCount(count => { _pending = count; _render(); });
  getPendingCount().then(count => { _pending = count; _render(); });

  window.addEventListener('online',  _render);
  window.addEventListener('offline', _render);
}

function _mountNoteModal() {
  const el = document.createElement('div');
  el.id = 'note-modal';
  el.innerHTML = `
    <div class="note-box">
      <div class="modal-corner tl"></div><div class="modal-corner tr"></div>
      <div class="modal-corner bl"></div><div class="modal-corner br"></div>
      <div class="note-title">Log Note</div>
      <div class="note-sub" id="note-sub"></div>
      <input class="note-input" id="note-input" type="text" placeholder="Note for this session…" maxlength="200" autocomplete="off" />
      <div class="note-actions">
        <button class="btn btn-start" id="note-save">Save Note</button>
        <button class="btn btn-reset" id="note-cancel">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  const close = () => el.classList.remove('active');
  document.getElementById('note-cancel').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('active')) { e.stopPropagation(); close(); } });
}

function _openNoteModal() {
  const modal  = document.getElementById('note-modal');
  const input  = document.getElementById('note-input');
  const sub    = document.getElementById('note-sub');
  const saveBtn = document.getElementById('note-save');
  const s = timerStore.get();

  input.value = '';

  if (s.running || s.paused) {
    sub.textContent = `Session: ${s.task?.trim() || 'Untitled Flow'}`;
  } else if (s.sessions?.length) {
    const last = [...s.sessions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    sub.textContent = `Last session: ${last.task || 'Untitled Flow'}`;
  } else {
    sub.textContent = 'No session found';
  }

  modal.classList.add('active');
  requestAnimationFrame(() => input.focus());

  const close = () => modal.classList.remove('active');

  const _save = () => {
    const note = input.value.trim();
    if (!note) { close(); return; }
    const cur = timerStore.get();
    if (cur.running || cur.paused) {
      setSessionNote(note);
      toast.show('Note saved — will attach when session ends', 'success');
    } else if (cur.sessions?.length) {
      const last = [...cur.sessions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      updateSession(last.timestamp, { note });
      toast.show('Note added to last session', 'success');
    } else {
      toast.show('No session to attach note to', 'error');
    }
    close();
  };

  saveBtn.onclick = _save;
  input.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); _save(); } };
}

boot();
