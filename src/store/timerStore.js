let _state = {
  running: false,
  paused: false,
  elapsedSeconds: 0,
  sessionStartedAt: null,
  task: '',
  intensity: 'Focus',
  tags: [],
  timerMode: 'deepwork',
  customTarget: 3600,
  sessions: [],
  heatmapRange: '7days',
  pomodoroPhase: 'work',
  pomodoroWorkMins: 25,
  pomodoroBreakMins: 5,
  autoBreak: false,
  tickSound: false,
};

const _subs = new Set();
const snap = () => ({ ..._state, sessions: [..._state.sessions] });

export const timerStore = {
  get: snap,
  subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); },
  set(patch) { _state = { ..._state, ...patch }; _subs.forEach(fn => fn(snap())); },
};
