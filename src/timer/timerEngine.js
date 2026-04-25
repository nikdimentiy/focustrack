import { timerStore } from '../store/timerStore.js';
import { saveSessions, saveTimerState } from '../services/storage.js';
import { cloudSaveSession } from '../services/cloudSessions.js';
import { cloudSaveTimerState } from '../services/cloudTimer.js';
import { sendNotification, tickBeep } from '../services/notifications.js';
import { fmtDate } from '../shared/utils.js';

export const ARC_FULL = 408;

const _MODE_TARGETS = { deepwork: 5400 };

export function getTarget(state) {
  if (state.pomodoroPhase === 'break') return (state.pomodoroBreakMins || 5) * 60;
  if (state.timerMode === 'pomodoro') return (state.pomodoroWorkMins || 25) * 60;
  return _MODE_TARGETS[state.timerMode] ?? (state.customTarget || 3600);
}

let _interval = null;
const _completeSubs   = new Set();
const _breakStartSubs = new Set();
export const onSessionComplete = fn => { _completeSubs.add(fn);   return () => _completeSubs.delete(fn); };
export const onBreakStart      = fn => { _breakStartSubs.add(fn); return () => _breakStartSubs.delete(fn); };

function persist() {
  const s = timerStore.get();
  saveTimerState({
    running: s.running, paused: s.paused,
    elapsedSeconds: s.elapsedSeconds, sessionStartedAt: s.sessionStartedAt,
    task: s.task, intensity: s.intensity, tags: s.tags ?? [],
    timerMode: s.timerMode, customTarget: s.customTarget,
    pomodoroPhase: s.pomodoroPhase, pomodoroWorkMins: s.pomodoroWorkMins,
    pomodoroBreakMins: s.pomodoroBreakMins, autoBreak: s.autoBreak, tickSound: s.tickSound,
    lastUpdated: Date.now(),
  });
  cloudSaveTimerState(s);
}

function _buildSession(s) {
  return {
    task: s.task.trim() || 'Untitled Flow', intensity: s.intensity,
    tags: s.tags?.length ? [...s.tags] : [],
    minutes: Math.max(1, Math.floor(s.elapsedSeconds / 60)),
    date: fmtDate(new Date()), timestamp: new Date().toISOString(),
    startedAt: s.sessionStartedAt ? new Date(s.sessionStartedAt).toISOString() : null,
  };
}

function _completeBreak() {
  clearInterval(_interval); _interval = null;
  const s = timerStore.get();
  timerStore.set({ running: false, paused: false, elapsedSeconds: 0, sessionStartedAt: null, pomodoroPhase: 'work' });
  persist();
  sendNotification('Break complete!', 'Ready for the next session?');
  _completeSubs.forEach(fn => fn({ mode: 'break-end', minutes: s.pomodoroBreakMins || 5, task: s.task }));
}

function _completeSession() {
  clearInterval(_interval); _interval = null;
  const s = timerStore.get();
  const sess = _buildSession(s);
  const sessions = [...s.sessions, sess];
  const goBreak = s.autoBreak && s.timerMode === 'pomodoro';

  timerStore.set({
    running: false, paused: false, elapsedSeconds: 0, sessionStartedAt: null,
    sessions, pomodoroPhase: goBreak ? 'break' : 'work',
  });
  saveSessions(sessions);
  cloudSaveSession(sess);
  persist();

  const label = s.timerMode === 'pomodoro' ? 'Pomodoro' : s.timerMode === 'deepwork' ? 'Deep Work' : 'Custom';
  sendNotification(`${label} complete!`, `${sess.minutes} min · ${sess.task}`);

  if (goBreak) {
    _breakStartSubs.forEach(fn => fn({ breakMins: s.pomodoroBreakMins || 5 }));
    setTimeout(() => startTimer(), 100);
  } else {
    _completeSubs.forEach(fn => fn({ mode: s.timerMode, minutes: sess.minutes, task: sess.task }));
  }
}

function _tick() {
  const now = timerStore.get();
  const elapsed = Math.floor((Date.now() - now.sessionStartedAt) / 1000);
  timerStore.set({ elapsedSeconds: elapsed });
  if (now.tickSound && elapsed > 0) tickBeep();
  if (elapsed % 5 === 0) persist();
  const target = getTarget(now);
  if (target > 0 && elapsed >= target) {
    if (now.pomodoroPhase === 'break') _completeBreak();
    else _completeSession();
  }
}

export function startTimer() {
  const s = timerStore.get();
  if (s.running) return;
  const startedAt = s.sessionStartedAt ?? (Date.now() - s.elapsedSeconds * 1000);
  timerStore.set({ running: true, paused: false, sessionStartedAt: startedAt });
  if (_interval) clearInterval(_interval);
  _interval = setInterval(_tick, 1000);
  persist();
}

export function pauseTimer() {
  const s = timerStore.get();
  if (!s.running) return;
  clearInterval(_interval); _interval = null;
  timerStore.set({ running: false, paused: true, sessionStartedAt: null });
  persist();
}

export function stopTimer() {
  const s = timerStore.get();
  if (!s.running && !s.paused && s.elapsedSeconds === 0) return;
  clearInterval(_interval); _interval = null;
  if (s.elapsedSeconds > 0 && s.pomodoroPhase !== 'break') {
    const sess = _buildSession(s);
    const sessions = [...s.sessions, sess];
    timerStore.set({ running: false, paused: false, elapsedSeconds: 0, sessionStartedAt: null, sessions, pomodoroPhase: 'work' });
    saveSessions(sessions);
    cloudSaveSession(sess);
  } else {
    timerStore.set({ running: false, paused: false, elapsedSeconds: 0, sessionStartedAt: null, pomodoroPhase: 'work' });
  }
  persist();
}

export function resetTimer() {
  clearInterval(_interval); _interval = null;
  timerStore.set({ running: false, paused: false, elapsedSeconds: 0, sessionStartedAt: null, pomodoroPhase: 'work' });
  persist();
}

export function setTask(task)           { timerStore.set({ task });            persist(); }
export function setIntensity(intensity) { timerStore.set({ intensity });       persist(); }
export function setTags(tags)           { timerStore.set({ tags });            persist(); }

export function setTimerMode(mode, customTarget) {
  const patch = { timerMode: mode, pomodoroPhase: 'work' };
  if (mode === 'custom' && customTarget) patch.customTarget = customTarget;
  timerStore.set(patch);
  persist();
}

export function setAutoBreak(v)          { timerStore.set({ autoBreak: v });        persist(); }
export function setPomodoroWorkMins(m)   { timerStore.set({ pomodoroWorkMins: m });  persist(); }
export function setPomodoroBreakMins(m)  { timerStore.set({ pomodoroBreakMins: m }); persist(); }
export function setTickSound(v)          { timerStore.set({ tickSound: v });         persist(); }

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
    running: false, paused: false,
    elapsedSeconds: Math.floor((Date.now() - cloudTime) / 1000),
    sessionStartedAt: cloudTime, task: cloudState.task || '', intensity: cloudState.intensity || 'Focus',
  });
  startTimer();
}

export function restoreTimer(savedState, savedSessions) {
  if (savedSessions?.length) timerStore.set({ sessions: savedSessions });
  if (!savedState) return;
  const patch = {
    task: savedState.task || '', intensity: savedState.intensity || 'Focus',
    tags: savedState.tags || [],
    timerMode: savedState.timerMode || 'deepwork',
    customTarget: savedState.customTarget || 3600,
    pomodoroPhase: savedState.pomodoroPhase || 'work',
    pomodoroWorkMins: savedState.pomodoroWorkMins || 25,
    pomodoroBreakMins: savedState.pomodoroBreakMins || 5,
    autoBreak: savedState.autoBreak || false,
    tickSound: savedState.tickSound || false,
  };
  if (savedState.running && savedState.sessionStartedAt) {
    patch.running = true;
    patch.sessionStartedAt = savedState.sessionStartedAt;
    patch.elapsedSeconds = Math.floor((Date.now() - savedState.sessionStartedAt) / 1000);
  } else if (savedState.paused && savedState.elapsedSeconds > 0) {
    patch.paused = true;
    patch.elapsedSeconds = savedState.elapsedSeconds;
  } else {
    patch.elapsedSeconds = savedState.elapsedSeconds || 0;
  }
  timerStore.set(patch);
  if (patch.running) {
    _interval = setInterval(_tick, 1000);
  }
}
