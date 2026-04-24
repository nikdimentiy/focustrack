import { sb } from '../config/supabase.js';
import { authState } from '../auth/authState.js';

export async function cloudSaveTopics(topics) {
  const uid = authState.getUserId(); if (!uid) return;
  try {
    await sb.from('repetition_topics').delete().eq('user_id', uid);
    if (topics.length) {
      await sb.from('repetition_topics').insert(
        topics.map(t => ({
          user_id: uid, topic: t.topic,
          date_learned: t.dateOfLearning, next_repeat: t.nextRepeat,
          repeat_1: !!t.repeat1, repeat_3: !!t.repeat3,
          repeat_7: !!t.repeat7, repeat_21: !!t.repeat21,
          updated_at: new Date().toISOString(),
        }))
      );
    }
  } catch (e) { console.error('cloudSaveTopics:', e); }
}

export async function fetchCloudTopics() {
  const uid = authState.getUserId(); if (!uid) return null;
  try {
    const { data, error } = await sb.from('repetition_topics').select('*').eq('user_id', uid);
    if (error) return null;
    return (data || []).map(r => ({
      topic: r.topic, dateOfLearning: r.date_learned, nextRepeat: r.next_repeat,
      status: 'Pending', repeat1: r.repeat_1, repeat3: r.repeat_3,
      repeat7: r.repeat_7, repeat21: r.repeat_21,
    }));
  } catch { return null; }
}
