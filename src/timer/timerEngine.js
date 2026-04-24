import { timerStore } from '../store/timerStore.js';
import { saveSessions, saveTimerState } from '../services/storage.js';
import { cloudSaveSession } from '../services/cloudSessions.js';
import { cloudSaveTimerState } from '../services/cloudTimer.js';
import { fmtDate } from '../shared/utils.js';

export const SESSION_TARGET = 3600;
export const ARC_FULL = 408;

let _interval = null;

function persist() {
  const s = timerStore.get();
  saveTimerState({
    running: s.running, elapsedSeconds: s.elapsedSeconds,
    sessionStartedAt: s.sessionStartedAt, task: s.task,
    intensity: s.intensity, lastUpdated: Date.now(),
  });
  cloudSaveTimerState(s);
}

export function startTimer() {
  const s = timerStore.get();
  if (s.running) return;
  const startedAt = s.sessionStartedAt ?? (Date.now() - s.elapsedSeconds * 1000);
  timerStore.set({ running: true, sessionStartedAt: startedAt });
  if (_interval) clearInterval(_interval);
  _interval = setInterval(() => {
    const now = timerStore.get();
    const elapsed = Math.floor((Date.now() - now.sessionStartedAt) / 1000);
    timerStore.set({ elapsedSeconds: elapsed });
    if (elapsed % 5 === 0) persist();
  }, 1000);
  persist();
}

export function stopTimer() {
  const s = timerStore.get();
  if (!s.running && s.elapsedSeconds === 0) return;
  clearInterval(_interval); _interval = null;
  if (s.elapsedSeconds > 0) {
    const mins = Math.max(1, Math.floor(s.elapsedSeconds / 60));
    const sess = {
      task: s.task.trim() || 'Untitled Flow', intensity: s.intensity,
      minutes: mins, date: fmtDate(new Date()),
      timestamp: new Date().toISOString(),
      startedAt: s.sessionStartedAt ? new Date(s.sessionStartedAt).toISOString() : null,
    };
    const sessions = [...s.sessions, sess];
    timerStore.set({ running: false, elapsedSeconds: 0, sessionStartedAt: null, sessions });
    saveSessions(sessions);
    cloudSaveSession(sess);
  } else {
    timerStore.set({ running: false });
  }
  persist();
}

export function resetTimer() {
  clearInterval(_interval); _interval = null;
  timerStore.set({ running: false, elapsedSeconds: 0, sessionStartedAt: null });
  persist();
}

export function setTask(task)          { timerStore.set({ task });       persist(); }
export function setIntensity(intensity){ timerStore.set({ intensity });  persist(); }

export function updateSession(timestamp, patch) {
  const sessions = timerStore.get().sessions.map(s =>
    s.timestamp === timestamp ? { ...s, ...patch } : s
  );
  timerStore.set({ sessions });
  saveSessions(sessions);
}

export function applyCloudState(cloudState) {
  const cloudTime = new Date(cloudState.session_started_at).getTime();
  if (_interval) { clearInterval(_interval); _interval = null; }
  timerStore.set({
    running: false, elapsedSeconds: Math.floor((Date.now() - cloudTime) / 1000),
    sessionStartedAt: cloudTime, task: cloudState.task || '', intensity: cloudState.intensity || 'Focus',
  });
  startTimer();
}

export function restoreTimer(savedState, savedSessions) {
  if (savedSessions?.length) timerStore.set({ sessions: savedSessions });
  if (!savedState) return;
  const patch = { task: savedState.task || '', intensity: savedState.intensity || 'Focus' };
  if (savedState.running && savedState.sessionStartedAt) {
    patch.running = true;
    patch.sessionStartedAt = savedState.sessionStartedAt;
    patch.elapsedSeconds = Math.floor((Date.now() - savedState.sessionStartedAt) / 1000);
  } else {
    patch.elapsedSeconds = savedState.elapsedSeconds || 0;
  }
  timerStore.set(patch);
  if (patch.running) {
    _interval = setInterval(() => {
      const now = timerStore.get();
      timerStore.set({ elapsedSeconds: Math.floor((Date.now() - now.sessionStartedAt) / 1000) });
    }, 1000);
  }
}
