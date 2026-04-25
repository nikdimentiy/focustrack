import { fetchCloudSessions, cloudSaveSession } from './cloudSessions.js';
import { fetchCloudTimerState } from './cloudTimer.js';
import { fetchCloudTopics, cloudSaveTopics } from './cloudTopics.js';
import { timerStore } from '../store/timerStore.js';
import { trackerStore } from '../store/trackerStore.js';
import { saveSessions, saveTopics } from './storage.js';
import { calcStatus } from '../shared/utils.js';

let _syncing = false;
let _retryPending = false;
const _subs = new Set();
const notify = s => _subs.forEach(fn => fn(s));

export const onSyncStatus = fn => { _subs.add(fn); return () => _subs.delete(fn); };

window.addEventListener('online', () => {
  if (_retryPending) { _retryPending = false; doSync(); }
});

export async function doSync() {
  if (_syncing) return;
  _syncing = true; notify('syncing');
  try {
    // --- Sessions ---
    const cloud = await fetchCloudSessions();
    const local = timerStore.get().sessions;
    const localMap = new Map(local.map(s => [s.timestamp, s]));
    const cloudMap = new Map(cloud.map(s => [s.timestamp, s]));
    for (const [ts, s] of localMap) { if (!cloudMap.has(ts)) await cloudSaveSession(s); }
    const merged = [...localMap.values()];
    for (const [ts, s] of cloudMap) { if (!localMap.has(ts)) merged.push(s); }
    merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    timerStore.set({ sessions: merged });
    await saveSessions(merged);

    // --- Timer state ---
    const cloudTimer = await fetchCloudTimerState();
    if (cloudTimer?.running && cloudTimer.session_started_at) {
      const cloudTime = new Date(cloudTimer.session_started_at).getTime();
      const s = timerStore.get();
      if (!s.running || cloudTime > (s.sessionStartedAt || 0)) {
        const { applyCloudState } = await import('../timer/timerEngine.js');
        applyCloudState(cloudTimer);
      }
    }

    // --- Topics ---
    const cloudTopics = await fetchCloudTopics();
    if (cloudTopics) {
      const withStatus = cloudTopics.map(t => ({ ...t, status: calcStatus(t.nextRepeat) }));
      trackerStore.set(withStatus);
      await saveTopics(withStatus);
    } else {
      // push local topics to cloud on first login
      const localTopics = trackerStore.get();
      if (localTopics.length) await cloudSaveTopics(localTopics);
    }

    notify('synced');
    setTimeout(() => notify('idle'), 3000);
  } catch (e) {
    console.error('Sync error:', e);
    if (!navigator.onLine) _retryPending = true;
    notify('error');
    setTimeout(() => notify('idle'), 3000);
  } finally { _syncing = false; }
}
