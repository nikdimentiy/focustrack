import { addTopic, updateTopic } from './trackerEngine.js';
import { fmtDateInput } from '../shared/utils.js';

let _onClose = null;

export function openModal(topic = null, index = -1) {
  const modal = document.getElementById('topic-modal');
  const title = document.getElementById('modal-title');
  const form  = document.getElementById('topic-form');
  const rowIdx = document.getElementById('row-index');

  form.reset();
  if (topic && index >= 0) {
    title.textContent = 'Edit Topic';
    rowIdx.value = index;
    document.getElementById('topic').value        = topic.topic;
    document.getElementById('date-learned').value = topic.dateOfLearning;
    document.getElementById('next-repeat').value  = topic.nextRepeat;
    document.getElementById('status').value       = topic.status;
  } else {
    title.textContent = 'Add New Topic';
    rowIdx.value = -1;
    document.getElementById('status').value = 'Pending';
    const today    = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('date-learned').value = fmtDateInput(today);
    document.getElementById('next-repeat').value  = fmtDateInput(tomorrow);
  }
  modal.classList.add('active');
}

export function closeModal() {
  const modal = document.getElementById('topic-modal');
  modal.classList.remove('active');
  setTimeout(() => document.getElementById('topic-form')?.reset(), 300);
}

export function mountModal(onSave) {
  const modal  = document.getElementById('topic-modal');
  const form   = document.getElementById('topic-form');
  const cancel = document.getElementById('cancel-btn');

  cancel.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      topic:          document.getElementById('topic').value,
      dateOfLearning: document.getElementById('date-learned').value,
      nextRepeat:     document.getElementById('next-repeat').value,
      status:         document.getElementById('status').value,
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
