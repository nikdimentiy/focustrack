const K = {
  TIMER:    'deepWorkTimerState',
  SESSIONS: 'deepWorkSessions',
  TOPICS:   'spacedRepetitionData',
};

const parse = key => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; } };

export const loadTimerState  = () => parse(K.TIMER);
export const loadSessions    = () => parse(K.SESSIONS) ?? [];
export const loadTopics      = () => parse(K.TOPICS) ?? [];

export const saveTimerState  = v => localStorage.setItem(K.TIMER,    JSON.stringify(v));
export const saveSessions    = v => localStorage.setItem(K.SESSIONS, JSON.stringify(v));
export const saveTopics      = v => localStorage.setItem(K.TOPICS,   JSON.stringify(v));

export const clearAll = () => localStorage.clear();
