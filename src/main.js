import './design/tokens.css';
import './design/base.css';
import './design/components.css';

import { timerStore } from './store/timerStore.js';
import { trackerStore } from './store/trackerStore.js';
import { loadTimerState, loadSessions, loadTopics } from './services/storage.js';
import { restoreTimer } from './timer/timerEngine.js';
import { calcStatus } from './shared/utils.js';

import { AuthWidget } from './auth/AuthWidget.js';
import { initAuth } from './auth/authState.js';
import { doSync } from './services/syncEngine.js';
import { Nav } from './shared/Nav.js';
import { toast } from './shared/Toast.js';
import { mountTimerView } from './timer/TimerView.js';
import { mountTrackerView } from './tracker/TrackerView.js';

function boot() {
  // Restore persisted state before mounting views
  const savedState    = loadTimerState();
  const savedSessions = loadSessions();
  const savedTopics   = loadTopics().map(t => ({ ...t, status: calcStatus(t.nextRepeat) }));

  timerStore.set({ sessions: savedSessions });
  trackerStore.set(savedTopics);
  restoreTimer(savedState, savedSessions);

  // Mount UI
  toast.mount(document.getElementById('toast-container'));
  AuthWidget.mount(document.getElementById('auth-widget'));
  Nav.mount(document.getElementById('nav'));
  mountTimerView(document.getElementById('dw-view'));
  mountTrackerView(document.getElementById('tr-view'));

  // Init auth — triggers doSync() on login
  initAuth(doSync);
}

boot();
