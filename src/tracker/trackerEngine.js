import { trackerStore } from '../store/trackerStore.js';
import { saveTopics } from '../services/storage.js';
import { cloudSaveTopics } from '../services/cloudTopics.js';
import { calcStatus, fmtDate } from '../shared/utils.js';

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

export function toggleRepeat(index, field) {
  const topics = trackerStore.get().map((t, i) => i === Number(index) ? { ...t, [field]: !t[field] } : t);
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
