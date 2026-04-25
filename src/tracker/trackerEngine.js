import { trackerStore } from '../store/trackerStore.js';
import { timerStore } from '../store/timerStore.js';
import { saveTopics } from '../services/storage.js';
import { cloudSaveTopics } from '../services/cloudTopics.js';
import { calcStatus, fmtDate, adjustEase, computeNextRepeat } from '../shared/utils.js';

function persist(topics) { saveTopics(topics); cloudSaveTopics(topics); }

export function addTopic(data) {
  const topics = [...trackerStore.get(), { ...data, repeat1: true, repeat3: false, repeat7: false, repeat21: false, status: calcStatus(data.nextRepeat) }];
  trackerStore.set(topics); persist(topics);
}

export function updateTopic(index, data) {
  const topics = trackerStore.get().map((t, i) => i === Number(index) ? { ...t, ...data, status: calcStatus(data.nextRepeat) } : t);
  trackerStore.set(topics); persist(topics);
}

export function deleteTopic(index) {
  const topics = trackerStore.get().filter((_, i) => i !== Number(index));
  trackerStore.set(topics); persist(topics);
}

export function undeleteTopic(topic, atIndex) {
  const topics = [...trackerStore.get()];
  topics.splice(Math.min(atIndex, topics.length), 0, { ...topic });
  trackerStore.set(topics); persist(topics);
}

export function toggleRepeat(index, field, quality = 'good') {
  const topics  = trackerStore.get();
  const topic   = topics[Number(index)];
  const wasOff  = !topic[field];
  let   updated = { ...topic, [field]: !topic[field] };
  if (wasOff) {
    const today      = fmtDate(new Date());
    const ease       = adjustEase(topic.ease ?? 2.5, quality);
    const nextRepeat = computeNextRepeat(field, ease, quality, today);
    const history    = [...(topic.history ?? []), { date: today, field, quality, ease }];
    updated = { ...updated, ease, nextRepeat, status: calcStatus(nextRepeat), history };
  }
  const newTopics = topics.map((t, i) => i === Number(index) ? updated : t);
  trackerStore.set(newTopics); persist(newTopics);
}

export function reorderTopics(fromIdx, toIdx) {
  if (fromIdx === toIdx) return;
  const topics = [...trackerStore.get()];
  const [item] = topics.splice(fromIdx, 1);
  topics.splice(toIdx, 0, item);
  trackerStore.set(topics); persist(topics);
}

export function refreshStatuses() {
  const topics = trackerStore.get().map(t => ({ ...t, status: calcStatus(t.nextRepeat) }));
  trackerStore.set(topics); persist(topics);
}

export function importTopics(raw) {
  if (!Array.isArray(raw)) throw new Error('Invalid format');
  const topics = raw.map(t => ({ ...t, status: calcStatus(t.nextRepeat) }));
  trackerStore.set(topics); persist(topics);
}

export function exportTopics() {
  const blob = new Blob([JSON.stringify(trackerStore.get(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `spaced-repetition-${fmtDate(new Date())}.json` });
  a.click(); URL.revokeObjectURL(url);
}

export function exportSessionsCSV() {
  const sessions = timerStore.get().sessions || [];
  const rows = sessions.map(s => [
    s.date,
    `"${(s.task || '').replace(/"/g, '""')}"`,
    s.minutes,
    s.intensity || 'Focus',
  ]);
  const csv = ['Date,Task,Minutes,Intensity', ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `sessions-${fmtDate(new Date())}.csv` });
  a.click(); URL.revokeObjectURL(url);
}

export function exportFullBackup() {
  const backup = {
    exportedAt: new Date().toISOString(),
    topics: trackerStore.get(),
    sessions: timerStore.get().sessions || [],
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `focustrack-backup-${fmtDate(new Date())}.json` });
  a.click(); URL.revokeObjectURL(url);
}
