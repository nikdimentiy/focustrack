import { db } from './storage.js';
import { authState } from '../auth/authState.js';

const _subs = new Set();

async function _notify() {
  const count = await db.pendingOps.count();
  _subs.forEach(fn => fn(count));
}

export const onPendingCount = fn => { _subs.add(fn); return () => _subs.delete(fn); };
export const getPendingCount = () => db.pendingOps.count();

export async function enqueue(type, payload) {
  // saveTopics and saveTimerState are idempotent full-replacement ops — keep only the latest
  if (type === 'saveTopics' || type === 'saveTimerState') {
    await db.pendingOps.where('type').equals(type).delete();
  }
  await db.pendingOps.add({ type, payload, createdAt: Date.now() });
  _notify();
}

export async function drainQueue() {
  if (!navigator.onLine || !authState.getUserId()) return 0;

  const ops = await db.pendingOps.orderBy('id').toArray();
  if (!ops.length) return 0;

  const { cloudSaveTopics }     = await import('./cloudTopics.js');
  const { cloudSaveSession }    = await import('./cloudSessions.js');
  const { cloudSaveTimerState } = await import('./cloudTimer.js');

  let drained = 0;
  for (const op of ops) {
    try {
      if      (op.type === 'saveTopics')     await cloudSaveTopics(op.payload,     { skipQueue: true });
      else if (op.type === 'saveSession')    await cloudSaveSession(op.payload,    { skipQueue: true });
      else if (op.type === 'saveTimerState') await cloudSaveTimerState(op.payload, { skipQueue: true });
      await db.pendingOps.delete(op.id);
      drained++;
    } catch {
      break; // stop on first failure — retry next online event
    }
  }

  _notify();
  return drained;
}
