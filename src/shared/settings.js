const DEFAULTS = {
  dailyGoalMins:  90,
  weeklyGoalMins: 300,
  notifyReviews:  true,
};

const _KEY = 'focustrack-settings';

function _load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(_KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

let _current = _load();
const _subs = new Set();

export const settings = {
  get: () => ({ ..._current }),
  set(patch) {
    _current = { ..._current, ...patch };
    localStorage.setItem(_KEY, JSON.stringify(_current));
    _subs.forEach(fn => fn({ ..._current }));
  },
  subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); },
};
