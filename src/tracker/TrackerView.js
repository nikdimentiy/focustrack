import { trackerStore } from '../store/trackerStore.js';
import { deleteTopic, undeleteTopic, toggleRepeat, reorderTopics, refreshStatuses, exportTopics, importTopics } from './trackerEngine.js';
import { openModal, mountModal } from './TopicModal.js';
import { Nav } from '../shared/Nav.js';
import { setTask, startTimer, stopTimer } from '../timer/timerEngine.js';
import { toast } from '../shared/Toast.js';
import { clearAll } from '../services/storage.js';
import { calcProgress, readableDateLong } from '../shared/utils.js';

const _esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let _activeTag    = null;
let _activeStatus = null;
let _qpicker      = null;
let _qpCallback   = null;
let _dragSrcIdx   = -1;

function _srStrength(ease) {
  const e = ease ?? 2.5;
  if (e < 1.6) return '<span class="sr-badge sr-weak">Weak</span>';
  if (e < 2.2) return '<span class="sr-badge sr-growing">Growing</span>';
  return '<span class="sr-badge sr-strong">Strong</span>';
}

const _svg = {
  focus: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
  edit:  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
  del:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
};

// ── Quality picker ────────────────────────────────────────────────────────────

function _showQP(anchor, callback) {
  if (!_qpicker) { callback('good'); return; }
  _qpCallback = callback;
  const rect = anchor.getBoundingClientRect();
  let top  = rect.bottom + 6;
  let left = rect.left - 70;
  if (left < 4) left = 4;
  if (left + 130 > window.innerWidth) left = window.innerWidth - 134;
  if (top + 166 > window.innerHeight) top = rect.top - 172;
  _qpicker.style.top  = top  + 'px';
  _qpicker.style.left = left + 'px';
  _qpicker.classList.add('visible');
  requestAnimationFrame(() => document.addEventListener('click', _onDocClick));
}

function _closeQP() {
  _qpicker?.classList.remove('visible');
  document.removeEventListener('click', _onDocClick);
}

function _onDocClick(e) {
  if (_qpicker && !_qpicker.contains(e.target)) _closeQP();
}

// ── DnD ──────────────────────────────────────────────────────────────────────

function _wireDnD(body) {
  let _over = null;
  body.querySelectorAll('tr[draggable="true"]').forEach(row => {
    row.addEventListener('dragstart', e => {
      _dragSrcIdx = Number(row.dataset.dragIdx);
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.classList.add('dragging'), 0);
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      if (_over) { _over.classList.remove('drag-over'); _over = null; }
      _dragSrcIdx = -1;
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (_over !== row) {
        if (_over) _over.classList.remove('drag-over');
        _over = row;
        row.classList.add('drag-over');
      }
    });
    row.addEventListener('drop', e => {
      e.preventDefault();
      const targetIdx = Number(row.dataset.dragIdx);
      row.classList.remove('drag-over');
      _over = null;
      if (_dragSrcIdx >= 0 && _dragSrcIdx !== targetIdx) reorderTopics(_dragSrcIdx, targetIdx);
      _dragSrcIdx = -1;
    });
  });
}

// ── Touch DnD ─────────────────────────────────────────────────────────────────

function _wireTouchDnD(body) {
  let _srcIdx = -1, _srcRow = null;

  const _rowAt = (x, y) => document.elementFromPoint(x, y)?.closest('tr[data-drag-idx]');

  body.querySelectorAll('.drag-handle:not(.drag-disabled)').forEach(handle => {
    const row = handle.closest('tr[data-drag-idx]');
    if (!row) return;

    handle.addEventListener('touchstart', e => {
      e.preventDefault();
      _srcIdx = Number(row.dataset.dragIdx);
      _srcRow = row;
      row.classList.add('dragging');
    }, { passive: false });

    handle.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      body.querySelectorAll('tr[data-drag-idx]').forEach(r => r.classList.remove('drag-over'));
      const target = _rowAt(t.clientX, t.clientY);
      if (target && target !== _srcRow) target.classList.add('drag-over');
    }, { passive: false });

    handle.addEventListener('touchend', e => {
      const t = e.changedTouches[0];
      body.querySelectorAll('tr[data-drag-idx]').forEach(r => r.classList.remove('drag-over', 'dragging'));
      const target = _rowAt(t.clientX, t.clientY);
      if (target && _srcIdx >= 0) {
        const targetIdx = Number(target.dataset.dragIdx);
        if (targetIdx !== _srcIdx) reorderTopics(_srcIdx, targetIdx);
      }
      _srcIdx = -1; _srcRow = null;
    }, { passive: false });
  });
}

// ── Mount ─────────────────────────────────────────────────────────────────────

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
        <div class="status-filter-row" id="status-filter-row">
          <span class="sf-lbl">// filter</span>
          <button class="sf-pill active" data-status="">All</button>
          <button class="sf-pill sf-today" data-status="Today">Today</button>
          <button class="sf-pill sf-overdue" data-status="Overdue">Overdue</button>
          <button class="sf-pill sf-pending" data-status="Pending">Pending</button>
        </div>
        <div class="tag-filter-bar" id="tag-filter-bar" style="display:none"></div>
        <table id="topics-table">
          <thead><tr>
            <th class="drag-col"></th>
            <th>Topic</th><th class="started-col">Started</th><th>Next Review</th>
            <th>Status</th><th>Day 1</th><th>Day 3</th><th>Day 7</th><th>Day 21</th><th>Actions</th>
          </tr></thead>
          <tbody id="topics-body"></tbody>
        </table>
        <div class="topics-cards" id="topics-cards"></div>
        <div class="empty-state" id="empty-state-tr" style="display:none">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          <h3>No topics yet</h3>
          <p>Add your first topic to start tracking your learning journey</p>
        </div>
      </div>
    </div>`;

  const _now = new Date();
  document.getElementById('date-text').innerHTML =
    `${_now.toLocaleDateString(undefined, { weekday: 'long' })}, <span class="date-day">${_now.toLocaleDateString(undefined, { month: 'long' })} ${_now.getDate()}</span>, ${_now.getFullYear()}`;

  // Quality picker singleton
  if (!document.getElementById('quality-picker')) {
    _qpicker = document.createElement('div');
    _qpicker.id = 'quality-picker';
    _qpicker.className = 'quality-picker';
    _qpicker.innerHTML = `
      <div class="qp-label">// recall</div>
      <button class="qp-btn qp-again" data-q="again">Again</button>
      <button class="qp-btn qp-hard"  data-q="hard">Hard</button>
      <button class="qp-btn qp-good"  data-q="good">Good</button>
      <button class="qp-btn qp-easy"  data-q="easy">Easy</button>`;
    document.body.appendChild(_qpicker);
    _qpicker.querySelectorAll('.qp-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const quality = btn.dataset.q;
        _closeQP();
        _qpCallback?.(quality);
        _qpCallback = null;
      })
    );
  } else {
    _qpicker = document.getElementById('quality-picker');
  }

  mountModal(() => toast.show('Topic saved', 'success'));

  container.querySelector('#add-topic').addEventListener('click', () => openModal());
  container.querySelector('#update-status').addEventListener('click', () => { refreshStatuses(); toast.show('Status updated', 'success'); });
  container.querySelector('#save-data').addEventListener('click', () => { exportTopics(); toast.show('Data exported', 'success'); });
  container.querySelector('#load-data').addEventListener('click', () => container.querySelector('#file-input').click());
  container.querySelector('#wipe-data').addEventListener('click', async () => {
    if (confirm('Wipe ALL local data (timer sessions, topics, all stored data)? Cannot be undone.')) {
      await clearAll();
      location.reload();
    }
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

  container.querySelector('#status-filter-row').querySelectorAll('.sf-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      _activeStatus = pill.dataset.status || null;
      container.querySelector('#status-filter-row').querySelectorAll('.sf-pill')
        .forEach(p => p.classList.toggle('active', p === pill));
      _renderTable(container.querySelector('#search-input')?.value || '');
    });
  });

  trackerStore.subscribe(() => _renderTable(container.querySelector('#search-input').value));
  _renderTable('');
}

function _renderTagBar(topics) {
  const bar = document.getElementById('tag-filter-bar');
  if (!bar) return;
  const allTags = [...new Set(topics.flatMap(t => t.tags || []))].sort();
  if (!allTags.length) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  const tagCounts = {};
  topics.forEach(t => (t.tags || []).forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }));
  bar.innerHTML = [
    `<button class="tag-filter-pill${!_activeTag ? ' active' : ''}" data-tag="">All <span class="tag-count">${topics.length}</span></button>`,
    ...allTags.map(tag => `<button class="tag-filter-pill${_activeTag === tag ? ' active' : ''}" data-tag="${_esc(tag)}">${_esc(tag)} <span class="tag-count">${tagCounts[tag]}</span></button>`),
  ].join('');
  bar.querySelectorAll('.tag-filter-pill').forEach(btn =>
    btn.addEventListener('click', () => {
      _activeTag = btn.dataset.tag || null;
      _renderTable(document.getElementById('search-input')?.value || '');
    })
  );
}

function _renderTable(search = '') {
  const topics = trackerStore.get();
  const body   = document.getElementById('topics-body');
  const table  = document.getElementById('topics-table');
  const empty  = document.getElementById('empty-state-tr');
  const cards  = document.getElementById('topics-cards');
  if (!body) return;

  window.__trackerTopics = topics;
  _renderTagBar(topics);

  const filtered = topics.filter(t =>
    (!_activeTag    || (t.tags || []).includes(_activeTag)) &&
    (!_activeStatus || t.status === _activeStatus) &&
    t.topic.toLowerCase().includes(search.toLowerCase())
  );

  if (!topics.length) {
    table.style.display = 'none';
    if (cards) cards.innerHTML = '';
    empty.style.display = '';
    _updateTrackerStats(topics);
    return;
  }
  table.style.display = '';
  empty.style.display = 'none';

  if (!filtered.length) {
    const msg = _activeStatus
      ? `No ${_activeStatus.toLowerCase()} topics${search ? ` matching "${_esc(search)}"` : ''}${_activeTag ? ` tagged "${_esc(_activeTag)}"` : ''}`
      : _activeTag && search
        ? `No topics tagged "${_esc(_activeTag)}" matching "${_esc(search)}"`
        : _activeTag
          ? `No topics with tag "${_esc(_activeTag)}"`
          : `No topics found matching "${_esc(search)}"`;
    body.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:3rem;color:var(--text-dim);font-family:var(--font-mono);font-size:.7rem;letter-spacing:.1em">${msg}</td></tr>`;
    if (cards) cards.innerHTML = '';
    _updateTrackerStats(topics);
    return;
  }

  const canDrag = !_activeTag && !search;

  // ── Desktop table rows ──
  body.innerHTML = filtered.map(topic => {
    const i         = topics.indexOf(topic);
    const pct       = calcProgress(topic);
    const sc        = topic.status.toLowerCase();
    const notesHtml = topic.notes ? `<div class="topic-notes-preview" title="${_esc(topic.notes)}">${_esc(topic.notes)}</div>` : '';
    const tagsHtml  = (topic.tags || []).map(tag => `<span class="tag-chip">${_esc(tag)}</span>`).join('');
    return `<tr data-drag-idx="${i}" ${canDrag ? 'draggable="true"' : ''}>
      <td class="drag-handle${canDrag ? '' : ' drag-disabled'}">${canDrag ? '⠿' : ''}</td>
      <td><div class="topic-cell">
        <div class="topic-icon">${i + 1}</div>
        <div class="topic-info">
          <div class="topic-name">${topic.topic}</div>
          <div class="topic-meta">${pct}% complete ${_srStrength(topic.ease)}</div>
          ${notesHtml}
          ${tagsHtml ? `<div class="topic-tags">${tagsHtml}</div>` : ''}
        </div>
      </div></td>
      <td class="started-col">${readableDateLong(topic.dateOfLearning)}</td>
      <td>${readableDateLong(topic.nextRepeat)}</td>
      <td><span class="status-badge status-${sc}">${topic.status}</span></td>
      <td><div class="checkbox-wrapper"><input type="checkbox" class="custom-checkbox" data-i="${i}" data-f="repeat1" ${topic.repeat1 ? 'checked' : ''}></div></td>
      <td><div class="checkbox-wrapper"><input type="checkbox" class="custom-checkbox" data-i="${i}" data-f="repeat3" ${topic.repeat3 ? 'checked' : ''}></div></td>
      <td><div class="checkbox-wrapper"><input type="checkbox" class="custom-checkbox" data-i="${i}" data-f="repeat7" ${topic.repeat7 ? 'checked' : ''}></div></td>
      <td><div class="checkbox-wrapper"><input type="checkbox" class="custom-checkbox" data-i="${i}" data-f="repeat21" ${topic.repeat21 ? 'checked' : ''}></div></td>
      <td><div class="actions">
        <button class="action-btn focus-btn" data-i="${i}" title="Focus session">${_svg.focus}</button>
        <button class="action-btn edit-btn"  data-i="${i}" title="Edit">${_svg.edit}</button>
        <button class="action-btn delete"    data-i="${i}" title="Delete">${_svg.del}</button>
      </div></td>
    </tr>`;
  }).join('');

  if (canDrag) { _wireDnD(body); _wireTouchDnD(body); }

  // ── Mobile cards ──
  if (cards) {
    cards.innerHTML = filtered.map(topic => {
      const i        = topics.indexOf(topic);
      const pct      = calcProgress(topic);
      const sc       = topic.status.toLowerCase();
      const tagsHtml = (topic.tags || []).map(tag => `<span class="tag-chip">${_esc(tag)}</span>`).join('');
      return `<div class="topic-card">
        <div class="topic-card-header">
          <div class="topic-card-num">${i + 1}</div>
          <div class="topic-card-title">${_esc(topic.topic)}</div>
          <span class="status-badge status-${sc}">${topic.status}</span>
          ${_srStrength(topic.ease)}
        </div>
        ${tagsHtml ? `<div class="topic-card-tags">${tagsHtml}</div>` : ''}
        ${topic.notes ? `<div class="topic-card-notes">${_esc(topic.notes)}</div>` : ''}
        <div class="topic-card-meta">
          <span>Started ${readableDateLong(topic.dateOfLearning)}</span>
          <span>Review ${readableDateLong(topic.nextRepeat)}</span>
        </div>
        <div class="card-progress-wrap">
          <div class="card-progress-bar"><div class="card-progress-fill" style="width:${pct}%"></div></div>
          <div class="card-checks">
            <label class="card-check-label"><input type="checkbox" class="custom-checkbox" data-i="${i}" data-f="repeat1" ${topic.repeat1 ? 'checked' : ''}>D1</label>
            <label class="card-check-label"><input type="checkbox" class="custom-checkbox" data-i="${i}" data-f="repeat3" ${topic.repeat3 ? 'checked' : ''}>D3</label>
            <label class="card-check-label"><input type="checkbox" class="custom-checkbox" data-i="${i}" data-f="repeat7" ${topic.repeat7 ? 'checked' : ''}>D7</label>
            <label class="card-check-label"><input type="checkbox" class="custom-checkbox" data-i="${i}" data-f="repeat21" ${topic.repeat21 ? 'checked' : ''}>D21</label>
          </div>
          <span class="card-pct">${pct}%</span>
        </div>
        <div class="topic-card-actions">
          <button class="action-btn focus-btn" data-i="${i}" title="Focus">${_svg.focus}</button>
          <button class="action-btn edit-btn"  data-i="${i}" title="Edit">${_svg.edit}</button>
          <button class="action-btn delete"    data-i="${i}" title="Delete">${_svg.del}</button>
        </div>
      </div>`;
    }).join('');
    _wireEvents(cards, topics);
  }

  _wireEvents(body, topics);
  _updateTrackerStats(topics);
}

function _wireEvents(root, topics) {
  root.querySelectorAll('.custom-checkbox').forEach(cb => {
    cb.addEventListener('click', e => {
      const idx    = Number(e.target.dataset.i);
      const field  = e.target.dataset.f;
      const wasOff = !topics[idx]?.[field];
      if (wasOff) {
        e.preventDefault();
        _showQP(e.target, quality => {
          toggleRepeat(idx, field, quality);
          const updated = trackerStore.get()[idx];
          if (updated) {
            const easeVal   = updated.ease ?? 2.5;
            const strength  = easeVal < 1.6 ? 'Weak' : easeVal < 2.2 ? 'Growing' : 'Strong';
            const label     = quality.charAt(0).toUpperCase() + quality.slice(1);
            toast.show(`${label} · Next: ${readableDateLong(updated.nextRepeat)} · SR: ${strength}`, 'success');
          }
        });
      } else {
        toggleRepeat(idx, field, 'good');
      }
    });
  });
  root.querySelectorAll('.edit-btn').forEach(btn =>
    btn.addEventListener('click', e => { const i = Number(e.currentTarget.dataset.i); openModal(topics[i], i); })
  );
  root.querySelectorAll('.delete').forEach(btn =>
    btn.addEventListener('click', e => {
      const idx   = Number(e.currentTarget.dataset.i);
      const topic = { ...topics[idx] };
      deleteTopic(idx);
      toast.showUndo(`"${topic.topic}" deleted`, () => undeleteTopic(topic, idx));
    })
  );
  root.querySelectorAll('.focus-btn').forEach(btn =>
    btn.addEventListener('click', e => {
      const topic = topics[Number(e.currentTarget.dataset.i)];
      stopTimer?.();
      setTask(topic.topic);
      Nav.switchTo('dw');
      setTimeout(() => startTimer(), 100);
    })
  );
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
  set('total-topics',    topics.length);
  set('due-today',       topics.filter(t => t.status === 'Today').length);
  set('overdue-count',   topics.filter(t => t.status === 'Overdue').length);
  set('completion-rate', rate + '%');
  set('avg-completion-widget', `Avg: ${avg}%`);
}
