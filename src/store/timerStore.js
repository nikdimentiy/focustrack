let _state = {
  running: false,
  paused: false,
  elapsedSeconds: 0,
  sessionStartedAt: null,
  task: '',
  intensity: 'Focus',
  timerMode: 'deepwork',
  customTarget: 3600,
  sessions: [],
  heatmapRange: '7days',
};

const _subs = new Set();
const snap = () => ({ ..._state, sessions: [..._state.sessions] });

export const timerStore = {
  get: snap,
  subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); },
  set(patch) { _state = { ..._state, ...patch }; _subs.forEach(fn => fn(snap())); },
};
