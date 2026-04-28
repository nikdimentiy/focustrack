import { fetchCloudSessions, cloudSaveSession } from './cloudSessions.js';
import { fetchCloudTimerState } from './cloudTimer.js';
import { fetchCloudTopics, cloudSaveTopics } from './cloudTopics.js';
import { timerStore } from '../store/timerStore.js';
import { trackerStore } from '../store/trackerStore.js';
import { saveSessions, saveTopics } from './storage.js';
import { calcStatus } from '../shared/utils.js';
import { drainQueue } from './offlineQueue.js';

let _syncing = false;
const _subs = new Set();
const notify = s => _subs.forEach(fn => fn(s));

export const onSyncStatus = fn => { _subs.add(fn); return () => _subs.delete(fn); };

window.addEventListener('online', async () => {
  await drainQueue();
  doSync();
});

function _topicKey(t) { return `${t.topic}||${t.dateOfLearning || t.dateLearned || ''}`; }

function _detectTopicConflict(local, cloud) {
  if (!local.length) return null;
  const localKeys = new Set(local.map(_topicKey));
  const cloudKeys = new Set(cloud.map(_topicKey));
  const onlyLocal = local.filter(t => !cloudKeys.has(_topicKey(t)));
  const onlyCloud = cloud.filter(t => !localKeys.has(_topicKey(t)));
  if (onlyLocal.length > 0 && onlyCloud.length > 0) {
    return { onlyLocal: onlyLocal.length, onlyCloud: onlyCloud.length };
  }
  return null;
}

function _notifyConflict(conflict, localTopics, cloudTopics) {
  if (document.getElementById('sync-conflict-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'sync-conflict-banner';
  banner.className = 'sync-conflict-banner';
  banner.innerHTML = `
    <div class="scb-inner">
      <svg class="scb-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      <span class="scb-text">
        Sync conflict: <b>${conflict.onlyLocal}</b> local topic${conflict.onlyLocal > 1 ? 's' : ''} not on cloud,
        <b>${conflict.onlyCloud}</b> cloud topic${conflict.onlyCloud > 1 ? 's' : ''} not local.
        Keep which version?
      </span>
      <button class="scb-btn scb-local" id="scb-keep-local">Keep Local</button>
      <button class="scb-btn scb-cloud" id="scb-keep-cloud">Use Cloud</button>
      <button class="scb-dismiss" id="scb-dismiss" aria-label="Dismiss">×</button>
    </div>`;
  document.body.appendChild(banner);

  const remove = () => banner.remove();
  document.getElementById('scb-dismiss').addEventListener('click', remove);
  document.getElementById('scb-keep-local').addEventListener('click', async () => {
    cloudSaveTopics(localTopics);
    remove();
  });
  document.getElementById('scb-keep-cloud').addEventListener('click', async () => {
    trackerStore.set(cloudTopics);
    await saveTopics(cloudTopics);
    remove();
  });

  setTimeout(remove, 30000);
}

export async function doSync() {
  if (_syncing) return;
  _syncing = true; notify('syncing');
  try {
    // Flush any ops that were queued while offline before pulling cloud state
    await drainQueue();

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
      const localTopics = trackerStore.get();
      const withStatus = cloudTopics.map(t => ({ ...t, status: calcStatus(t.nextRepeat) }));
      const conflict = _detectTopicConflict(localTopics, cloudTopics);
      if (conflict) {
        _notifyConflict(conflict, localTopics, withStatus);
      } else {
        trackerStore.set(withStatus);
        await saveTopics(withStatus);
      }
    } else {
      const localTopics = trackerStore.get();
      if (localTopics.length) await cloudSaveTopics(localTopics);
    }

    notify('synced');
    setTimeout(() => notify('idle'), 3000);
  } catch (e) {
    console.error('Sync error:', e);
    notify('error');
    setTimeout(() => notify('idle'), 3000);
  } finally { _syncing = false; }
}
