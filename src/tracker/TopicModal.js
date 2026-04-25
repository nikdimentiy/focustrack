import { addTopic, updateTopic } from './trackerEngine.js';
import { fmtDateInput, parseLocalDate } from '../shared/utils.js';

export function openModal(topic = null, index = -1) {
  const modal  = document.getElementById('topic-modal');
  const title  = document.getElementById('modal-title');
  const form   = document.getElementById('topic-form');
  const rowIdx = document.getElementById('row-index');

  form.reset();
  const hintText = document.getElementById('sm2-hint-text');
  if (topic && index >= 0) {
    title.textContent = 'Edit Topic';
    rowIdx.value = index;
    document.getElementById('topic').value        = topic.topic;
    document.getElementById('date-learned').value = topic.dateOfLearning;
    document.getElementById('next-repeat').value  = topic.nextRepeat;
    document.getElementById('status').value       = topic.status;
    document.getElementById('topic-tags').value   = (topic.tags || []).join(', ');
    document.getElementById('topic-notes').value  = topic.notes || '';
    const lastReview = (topic.history || []).slice(-1)[0];
    if (hintText) hintText.textContent = lastReview
      ? `SM-2 last scheduled via ${lastReview.quality} recall · ease ${(topic.ease ?? 2.5).toFixed(2)}`
      : 'SM-2 auto-schedules future reviews on each completion';
  } else {
    title.textContent = 'Add New Topic';
    rowIdx.value = -1;
    document.getElementById('status').value = 'Pending';
    const today    = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('date-learned').value = fmtDateInput(today);
    document.getElementById('next-repeat').value  = fmtDateInput(tomorrow);
    document.getElementById('topic-tags').value   = '';
    document.getElementById('topic-notes').value  = '';
    if (hintText) hintText.textContent = 'SM-2 auto-schedules future reviews on each completion';
  }
  modal.classList.add('active');
}

export function closeModal() {
  const modal = document.getElementById('topic-modal');
  modal.classList.remove('active');
  setTimeout(() => document.getElementById('topic-form')?.reset(), 300);
}

export function mountModal(onSave) {
  const modal       = document.getElementById('topic-modal');
  const form        = document.getElementById('topic-form');
  const cancel      = document.getElementById('cancel-btn');
  const dateLearned = document.getElementById('date-learned');
  const nextRepeat  = document.getElementById('next-repeat');
  const hintText    = document.getElementById('sm2-hint-text');

  // Auto-advance nextRepeat when dateOfLearning changes in add mode
  dateLearned?.addEventListener('change', e => {
    if (Number(document.getElementById('row-index').value) < 0) {
      const d = parseLocalDate(e.target.value);
      d.setDate(d.getDate() + 1);
      if (nextRepeat) nextRepeat.value = fmtDateInput(d);
    }
  });

  cancel.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const rawTags = document.getElementById('topic-tags').value;
    const data = {
      topic:          document.getElementById('topic').value.trim(),
      dateOfLearning: document.getElementById('date-learned').value,
      nextRepeat:     document.getElementById('next-repeat').value,
      status:         document.getElementById('status').value,
      tags:           rawTags.split(',').map(t => t.trim()).filter(Boolean),
      notes:          document.getElementById('topic-notes').value.trim(),
    };
    const idx = Number(document.getElementById('row-index').value);
    if (idx >= 0) {
      const existing = window.__trackerTopics?.[idx] ?? {};
      updateTopic(idx, { ...existing, ...data });
    } else {
      addTopic(data);
    }
    onSave?.();
    closeModal();
  });
}
