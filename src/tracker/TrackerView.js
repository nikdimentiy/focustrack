import { trackerStore } from '../store/trackerStore.js';
import { deleteTopic, toggleRepeat, refreshStatuses, exportTopics, importTopics } from './trackerEngine.js';
import { openModal, mountModal } from './TopicModal.js';
import { Nav } from '../shared/Nav.js';
import { setTask, startTimer, stopTimer } from '../timer/timerEngine.js';
import { toast } from '../shared/Toast.js';
import { calcProgress, readableDateLong } from '../shared/utils.js';

export function mountTrackerView(container) {
  container.innerHTML = `
    <div class="container">
      <div class="panel">
        <div class="panel-corner tl"></div><div class="panel-corner tr"></div>
        <div class="panel-corner bl"></div><div class="panel-corner br"></div>
        <div class="app-header">
          <div class="logo">
            <div class="logo-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h1>Spaced <span>Repetition</span> Tracker</h1>
          </div>
          <p class="subtitle">// Master your learning with scientifically optimized intervals</p>
          <div class="date-widget">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span id="date-text">Loading...</span>
          </div>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card"><div class="stat-value" id="total-topics">0</div><div class="stat-label">Total Topics</div></div>
        <div class="stat-card"><div class="stat-value" id="due-today">0</div><div class="stat-label">Due Today</div></div>
        <div class="stat-card"><div class="stat-value" id="overdue-count">0</div><div class="stat-label">Overdue</div></div>
        <div class="stat-card"><div class="stat-value" id="completion-rate">0%</div><div class="stat-label">Completion</div></div>
      </div>

      <div class="controls">
        <button id="add-topic" class="btn btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Add Topic
        </button>
        <button id="update-status" class="btn btn-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Refresh Status
        </button>
        <button id="save-data" class="btn btn-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
          Export JSON
        </button>
        <button id="load-data" class="btn btn-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Import JSON
        </button>
        <button id="wipe-data" class="btn btn-danger">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          Wipe Data
        </button>
        <input type="file" id="file-input" class="file-input" accept=".json" />
      </div>

      <div class="table-container">
        <div class="table-header">
          <div class="table-title">
            <span class="panel-label" style="font-size:.6rem;letter-spacing:.2em;margin-bottom:0;opacity:1">// topics</span>
            Learning Log <span id="avg-completion-widget" class="mini-widget">Avg: 0%</span>
          </div>
          <div class="search-box">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" id="search-input" placeholder="Search topics...">
          </div>
        </div>
        <table id="topics-table">
          <thead><tr>
            <th>Topic</th><th class="started-col">Started</th><th>Next Review</th>
            <th>Status</th><th>Day 1</th><th>Day 3</th><th>Day 7</th><th>Day 21</th><th>Actions</th>
          </tr></thead>
          <tbody id="topics-body"></tbody>
        </table>
        <div class="empty-state" id="empty-state-tr" style="display:none">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          <h3>No topics yet</h3>
          <p>Add your first topic to start tracking your learning journey</p>
        </div>
      </div>
    </div>`;

  document.getElementById('date-text').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  mountModal(() => toast.show('Topic saved', 'success'));

  container.querySelector('#add-topic').addEventListener('click', () => openModal());
  container.querySelector('#update-status').addEventListener('click', () => { refreshStatuses(); toast.show('Status updated', 'success'); });
  container.querySelector('#save-data').addEventListener('click', () => { exportTopics(); toast.show('Data exported', 'success'); });
  container.querySelector('#load-data').addEventListener('click', () => container.querySelector('#file-input').click());
  container.querySelector('#wipe-data').addEventListener('click', () => {
    if (confirm('Wipe ALL local data (timer sessions, topics, all stored data)? Cannot be undone.')) { localStorage.clear(); location.reload(); }
  });
  container.querySelector('#file-input').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try { importTopics(JSON.parse(ev.target.result)); toast.show('Data imported', 'success'); }
      catch { toast.show('Invalid file format', 'error'); }
    };
    reader.readAsText(file); e.target.value = '';
  });
  container.querySelector('#search-input').addEventListener('input', e => _renderTable(e.target.value));

  trackerStore.subscribe(() => _renderTable(container.querySelector('#search-input').value));
  _renderTable('');
}

function _renderTable(search = '') {
  const topics   = trackerStore.get();
  const filtered = topics.filter(t => t.topic.toLowerCase().includes(search.toLowerCase()));
  const body     = document.getElementById('topics-body');
  const table    = document.getElementById('topics-table');
  const empty    = document.getElementById('empty-state-tr');
  if (!body) return;

  window.__trackerTopics = topics;

  if (!topics.length) {
    table.style.display = 'none'; empty.style.display = '';
    _updateTrackerStats(topics); return;
  }
  table.style.display = ''; empty.style.display = 'none';

  if (!filtered.length && search) {
    body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:3rem;color:var(--text-dim);font-family:var(--font-mono);font-size:.7rem;letter-spacing:.1em">No topics found matching "${search}"</td></tr>`;
    _updateTrackerStats(topics); return;
  }

  body.innerHTML = filtered.map(topic => {
    const i   = topics.indexOf(topic);
    const pct = calcProgress(topic);
    const sc  = topic.status.toLowerCase();
    return `<tr>
      <td><div class="topic-cell">
        <div class="topic-icon">${i + 1}</div>
        <div class="topic-info"><div class="topic-name">${topic.topic}</div><div class="topic-meta">${pct}% complete</div></div>
      </div></td>
      <td class="started-col">${readableDateLong(topic.dateOfLearning)}</td>
      <td>${readableDateLong(topic.nextRepeat)}</td>
      <td><span class="status-badge status-${sc}">${topic.status}</span></td>
      <td><div class="checkbox-wrapper"><input type="checkbox" class="custom-checkbox" data-i="${i}" data-f="repeat1" ${topic.repeat1 ? 'checked' : ''}></div></td>
      <td><div class="checkbox-wrapper"><input type="checkbox" class="custom-checkbox" data-i="${i}" data-f="repeat3" ${topic.repeat3 ? 'checked' : ''}></div></td>
      <td><div class="checkbox-wrapper"><input type="checkbox" class="custom-checkbox" data-i="${i}" data-f="repeat7" ${topic.repeat7 ? 'checked' : ''}></div></td>
      <td><div class="checkbox-wrapper"><input type="checkbox" class="custom-checkbox" data-i="${i}" data-f="repeat21" ${topic.repeat21 ? 'checked' : ''}></div></td>
      <td><div class="actions">
        <button class="action-btn focus-btn" data-i="${i}" title="Focus session">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </button>
        <button class="action-btn edit-btn" data-i="${i}" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button class="action-btn delete" data-i="${i}" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div></td>
    </tr>`;
  }).join('');

  body.querySelectorAll('.custom-checkbox').forEach(cb =>
    cb.addEventListener('change', e => toggleRepeat(Number(e.target.dataset.i), e.target.dataset.f))
  );
  body.querySelectorAll('.edit-btn').forEach(btn =>
    btn.addEventListener('click', e => { const i = Number(e.currentTarget.dataset.i); openModal(topics[i], i); })
  );
  body.querySelectorAll('.delete').forEach(btn =>
    btn.addEventListener('click', e => {
      if (confirm('Delete this topic?')) { deleteTopic(Number(e.currentTarget.dataset.i)); toast.show('Topic deleted', 'success'); }
    })
  );
  body.querySelectorAll('.focus-btn').forEach(btn =>
    btn.addEventListener('click', e => {
      const topic = topics[Number(e.currentTarget.dataset.i)];
      stopTimer?.();
      setTask(topic.topic);
      Nav.switchTo('dw');
      setTimeout(() => startTimer(), 100);
    })
  );

  _updateTrackerStats(topics);
}

function _updateTrackerStats(topics) {
  let completed = 0, total = topics.length * 4, progressSum = 0;
  topics.forEach(t => {
    if (t.repeat1) completed++; if (t.repeat3) completed++;
    if (t.repeat7) completed++; if (t.repeat21) completed++;
    progressSum += calcProgress(t);
  });
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const avg  = total > 0 ? Math.round(progressSum / topics.length) : 0;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('total-topics',   topics.length);
  set('due-today',      topics.filter(t => t.status === 'Today').length);
  set('overdue-count',  topics.filter(t => t.status === 'Overdue').length);
  set('completion-rate', rate + '%');
  set('avg-completion-widget', `Avg: ${avg}%`);
}
