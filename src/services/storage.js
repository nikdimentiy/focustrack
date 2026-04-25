import Dexie from 'dexie';

const db = new Dexie('FocusTrackDB');
db.version(1).stores({ kv: 'key' });

const K = {
  TIMER:    'deepWorkTimerState',
  SESSIONS: 'deepWorkSessions',
  TOPICS:   'spacedRepetitionData',
};

const get = async key => { const row = await db.kv.get(key); return row?.value ?? null; };
const put = (key, value) => db.kv.put({ key, value });

export const loadTimerState  = () => get(K.TIMER);
export const loadSessions    = async () => (await get(K.SESSIONS)) ?? [];
export const loadTopics      = async () => (await get(K.TOPICS)) ?? [];

export const saveTimerState  = v => put(K.TIMER,    v);
export const saveSessions    = v => put(K.SESSIONS, v);
export const saveTopics      = v => put(K.TOPICS,   v);

export const clearAll = () => db.kv.clear();
