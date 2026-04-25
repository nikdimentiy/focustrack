import { sb } from '../config/supabase.js';
import { authState } from '../auth/authState.js';
import { enqueue } from './offlineQueue.js';

export async function cloudSaveTimerState(s, { skipQueue = false } = {}) {
  const uid = authState.getUserId(); if (!uid) return;
  try {
    await sb.from('timer_state').upsert({
      user_id: uid, running: s.running,
      session_started_at: s.sessionStartedAt ? new Date(s.sessionStartedAt).toISOString() : null,
      task: s.task, intensity: s.intensity,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch (e) {
    console.error('cloudSaveTimerState:', e);
    if (skipQueue) throw e;
    await enqueue('saveTimerState', s);
  }
}

export async function fetchCloudTimerState() {
  const uid = authState.getUserId(); if (!uid) return null;
  try {
    const { data } = await sb.from('timer_state').select('*').eq('user_id', uid).single();
    return data ?? null;
  } catch { return null; }
}
