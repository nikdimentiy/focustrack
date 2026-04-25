import './design/tokens.css';
import './design/base.css';
import './design/components.css';

import { timerStore } from './store/timerStore.js';
import { trackerStore } from './store/trackerStore.js';
import { loadTimerState, loadSessions, loadTopics } from './services/storage.js';
import { restoreTimer, startTimer, stopTimer } from './timer/timerEngine.js';
import { calcStatus } from './shared/utils.js';

import { AuthWidget } from './auth/AuthWidget.js';
import { initAuth } from './auth/authState.js';
import { doSync } from './services/syncEngine.js';
import { Nav } from './shared/Nav.js';
import { toast } from './shared/Toast.js';
import { mountFooterWidget, mountInfoButton } from './shared/FooterWidget.js';
import { mountTimerView } from './timer/TimerView.js';
import { mountTrackerView } from './tracker/TrackerView.js';
import { mountAnalyticsView } from './analytics/AnalyticsView.js';

function boot() {
  // Restore persisted state before mounting views
  const savedState    = loadTimerState();
  const savedSessions = loadSessions();
  const savedTopics   = loadTopics().map(t => ({ ...t, status: calcStatus(t.nextRepeat) }));

  timerStore.set({ sessions: savedSessions });
  trackerStore.set(savedTopics);
  restoreTimer(savedState, savedSessions);

  // Mount UI
  mountFooterWidget(document.getElementById('footer-widget'));
  mountInfoButton(document.getElementById('info-btn'));
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
                      document.getElementById('session-edit-modal')?.classList.contains('active');

    if (e.key === 'Escape') {
      document.getElementById('topic-modal')?.classList.remove('active');
      document.getElementById('session-edit-modal')?.classList.remove('active');
      return;
    }
    if (inInput || modalOpen) return;

    if (e.key === '1') { e.preventDefault(); Nav.switchTo('dw'); return; }
    if (e.key === '2') { e.preventDefault(); Nav.switchTo('tr'); return; }
    if (e.key === '3') { e.preventDefault(); Nav.switchTo('an'); return; }

    if (e.key === ' ' && _currentView === 'dw') {
      e.preventDefault();
      timerStore.get().running ? stopTimer() : startTimer();
      return;
    }
  });

  // Init auth — triggers doSync() on login
  initAuth(doSync);
}

boot();
