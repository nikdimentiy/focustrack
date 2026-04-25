import './design/tokens.css';
import './design/base.css';
import './design/components.css';

import { timerStore } from './store/timerStore.js';
import { trackerStore } from './store/trackerStore.js';
import { loadTimerState, loadSessions, loadTopics } from './services/storage.js';
import { restoreTimer, startTimer, pauseTimer } from './timer/timerEngine.js';
import { calcStatus } from './shared/utils.js';

import { AuthWidget } from './auth/AuthWidget.js';
import { initAuth, authState } from './auth/authState.js';
import { doSync, onSyncStatus } from './services/syncEngine.js';
import { Nav } from './shared/Nav.js';
import { toast } from './shared/Toast.js';
import { mountFooterWidget, mountInfoButton } from './shared/FooterWidget.js';
import { mountSettingsButton } from './shared/SettingsModal.js';
import { mountTimerView } from './timer/TimerView.js';
import { mountTrackerView } from './tracker/TrackerView.js';
import { mountAnalyticsView } from './analytics/AnalyticsView.js';
import { checkReviewReminders } from './services/notifications.js';
import { settings } from './shared/settings.js';

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

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    const inInput = tag === 'input' || tag === 'textarea' || tag === 'select';
    const modalOpen = document.getElementById('topic-modal')?.classList.contains('active') ||
                      document.getElementById('session-edit-modal')?.classList.contains('active') ||
                      document.getElementById('settings-modal')?.classList.contains('active');

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
}

function _wireSyncDot() {
  const dot = document.getElementById('sync-dot');
  if (!dot) return;

  let lastStatus = null; // null = no sync attempted yet in this session

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
    const map = {
      syncing: ['nav-sync-dot sync-syncing', 'Syncing…'],
      synced:  ['nav-sync-dot sync-synced',  'Up to date'],
      error:   ['nav-sync-dot sync-error',   'Sync failed'],
    };
    const [cls, title] = map[lastStatus] || ['nav-sync-dot sync-offline', 'Offline'];
    dot.className = cls;
    dot.title = title;
  };

  onSyncStatus(status => {
    if (status === 'idle') return; // keep last known state visible
    lastStatus = status;
    _update();
  });

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

boot();
