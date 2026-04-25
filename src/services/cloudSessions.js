import { sb } from '../config/supabase.js';
import { authState } from '../auth/authState.js';
import { enqueue } from './offlineQueue.js';

export async function cloudSaveSession(sess, { skipQueue = false } = {}) {
  const uid = authState.getUserId(); if (!uid) return;
  try {
    await sb.from('dw_sessions').insert({
      user_id: uid, task: sess.task, intensity: sess.intensity,
      minutes: sess.minutes, date: sess.date,
      timestamp: sess.timestamp, started_at: sess.startedAt,
    });
  } catch (e) {
    console.error('cloudSaveSession:', e);
    if (skipQueue) throw e;
    await enqueue('saveSession', sess);
  }
}

export async function fetchCloudSessions() {
  const uid = authState.getUserId(); if (!uid) return [];
  try {
    const { data, error } = await sb.from('dw_sessions').select('*').eq('user_id', uid);
    if (error) throw error;
    return (data || []).map(r => ({
      task: r.task, intensity: r.intensity, minutes: r.minutes,
      date: r.date, timestamp: r.timestamp, startedAt: r.started_at,
    }));
  } catch (e) { console.error('fetchCloudSessions:', e); return []; }
}

export async function purgeCloudData() {
  const uid = authState.getUserId();
  if (!uid) throw new Error('Not authenticated');
  const { error: e1 } = await sb.from('dw_sessions').delete().eq('user_id', uid);
  if (e1) throw e1;
  const { error: e2 } = await sb.from('timer_state').delete().eq('user_id', uid);
  if (e2) throw e2;
}
