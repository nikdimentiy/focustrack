import { timerStore } from '../store/timerStore.js';
import { startTimer, stopTimer, resetTimer, setTask, setIntensity, SESSION_TARGET, ARC_FULL } from './timerEngine.js';
import { onSyncStatus } from '../services/syncEngine.js';
import { fmtTime, readableDate, fmtDate, byDate, calcStreak, calcMaxStreak, heatDays, weekStart } from '../shared/utils.js';

const WEEKLY_TARGET = 300;

export function mountTimerView(container) {
  container.innerHTML = `
    <div class="app">
      <div class="panel">
        <div class="panel-corner tl"></div><div class="panel-corner tr"></div>
        <div class="panel-corner bl"></div><div class="panel-corner br"></div>
        <div class="panel-label">// current session</div>
        <div class="panel-title">Deep Work Timer</div>
        <div class="session-body">
          <div class="session-left">
            <div>
              <div class="task-kicker">Active mission</div>
              <div class="task-name" id="taskDisplay">Untitled <em>Flow</em></div>
            </div>
            <div class="setup-row">
              <div class="field">
                <label for="taskInput">Mission label</label>
                <input id="taskInput" type="text" placeholder="What are you working on?" />
              </div>
              <div class="field">
                <label for="intensitySelect">Intensity</label>
                <select id="intensitySelect">
                  <option value="Low">🌿 Low</option>
                  <option value="Focus" selected>🔥 Focus</option>
                  <option value="Ultra">⚡ Ultra</option>
                </select>
              </div>
            </div>
            <div class="stats-grid">
              <div class="stat"><div class="stat-label">Deep Min</div><div class="stat-value" id="todayMinutes">0</div><div class="stat-sub">Today total</div></div>
              <div class="stat"><div class="stat-label">Sessions</div><div class="stat-value" id="todaySessions">0</div><div class="stat-sub">Completed today</div></div>
              <div class="stat"><div class="stat-label">Best Block</div><div class="stat-value" id="bestBlock">0</div><div class="stat-sub">Longest (min)</div></div>
              <div class="stat"><div class="stat-label">Streak</div><div class="stat-value" id="streakDays">0</div><div class="stat-sub">Day streak</div></div>
            </div>
          </div>
          <div class="session-right">
            <div class="arc-wrap">
              <svg class="arc-svg" viewBox="0 0 160 160">
                <g id="arcTicks"></g>
                <circle fill="none" stroke="rgba(0,245,255,0.06)" stroke-width="0.8" cx="80" cy="80" r="50"/>
                <circle class="arc-track" cx="80" cy="80" r="65"/>
                <circle class="arc-fill" id="arcFill" cx="80" cy="80" r="65"/>
              </svg>
              <div class="arc-center">
                <div class="timer-pct" id="timerPct">0%</div>
                <div class="timer-digits" id="timerEl">00:00:00</div>
                <div class="timer-sub">elapsed</div>
              </div>
            </div>
            <div class="btn-col">
              <button class="btn btn-start" id="startBtn">▶&ensp;Start Session</button>
              <div class="btn-pair" id="btnPair">
                <button class="btn btn-stop" id="stopBtn"><i class="fas fa-stop-circle"></i>&ensp;Stop</button>
                <button class="btn btn-reset" id="resetBtn"><i class="fas fa-undo-alt"></i>&ensp;Reset</button>
              </div>
              <div id="dwCloudChip" class="dw-cloud-chip" style="display:none">
                <span class="dw-cloud-dot" id="dwCloudDot"></span>
                <span id="dwCloudLabel">cloud sync</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-corner tl"></div><div class="panel-corner tr"></div>
        <div class="panel-corner bl"></div><div class="panel-corner br"></div>
        <div class="panel-label">// weekly goal · five2five</div>
        <div class="panel-title">300-Min Target</div>
        <div class="goal-body">
          <div class="goal-progress">
            <div class="goal-nums">
              <strong id="weeklyAchieved">0 min achieved</strong>
              <span id="weeklyLeft">300 min left</span>
            </div>
            <div class="track"><div class="fill" id="weeklyProgress"></div></div>
            <div class="goal-meta-row">
              <span><b id="weeklySessions">0</b> sessions this week</span>
              <span>All-time best: <b id="allTimeRecord">0 min</b></span>
              <span>Max streak: <b id="maxStreak">0 days</b></span>
            </div>
          </div>
          <div class="goal-divider"></div>
          <div class="goal-kpis">
            <div class="goal-kpi"><div class="goal-kpi-val" id="kpiWeeklySess">0</div><div class="goal-kpi-lbl">This week</div></div>
            <div class="goal-kpi"><div class="goal-kpi-val" id="kpiStreak">0</div><div class="goal-kpi-lbl">Day streak</div></div>
            <div class="goal-kpi"><div class="goal-kpi-val" id="kpiAllTime">0</div><div class="goal-kpi-lbl">Best (min)</div></div>
          </div>
        </div>
      </div>

      <div class="body-grid">
        <div class="panel">
          <div class="panel-corner tl"></div><div class="panel-corner tr"></div>
          <div class="panel-corner bl"></div><div class="panel-corner br"></div>
          <div class="panel-head">
            <div><div class="panel-label">// consistency</div><div class="panel-title">Heatmap</div></div>
            <div class="range-toggle">
              <button class="active" data-range="7days">Last 7d</button>
              <button data-range="week">This week</button>
            </div>
          </div>
          <div class="heatmap-grid" id="heatmap"></div>
          <div class="heatmap-caption" id="bestDay">No data yet</div>
        </div>
        <div class="panel">
          <div class="panel-corner tl"></div><div class="panel-corner tr"></div>
          <div class="panel-corner bl"></div><div class="panel-corner br"></div>
          <div class="panel-head"><div><div class="panel-label">// log</div><div class="panel-title">Completed Sessions</div></div></div>
          <ul class="session-list" id="sessionList"></ul>
          <div class="empty-msg" id="emptyDW">No sessions yet — start your first block.</div>
        </div>
      </div>
    </div>`;

  _buildTicks();

  const arcFill   = container.querySelector('#arcFill');
  const timerEl   = container.querySelector('#timerEl');
  const timerPct  = container.querySelector('#timerPct');
  const startBtn  = container.querySelector('#startBtn');
  const stopBtn   = container.querySelector('#stopBtn');
  const resetBtn  = container.querySelector('#resetBtn');
  const btnPair   = container.querySelector('#btnPair');
  const taskInput = container.querySelector('#taskInput');
  const taskDisp  = container.querySelector('#taskDisplay');
  const intensity = container.querySelector('#intensitySelect');

  startBtn.addEventListener('click', startTimer);
  stopBtn.addEventListener('click', stopTimer);
  resetBtn.addEventListener('click', resetTimer);
  taskInput.addEventListener('input', e => { setTask(e.target.value); _updateTaskDisplay(taskDisp, e.target.value); });
  intensity.addEventListener('change', e => setIntensity(e.target.value));

  container.querySelectorAll('.range-toggle button').forEach(btn =>
    btn.addEventListener('click', () => {
      container.querySelectorAll('.range-toggle button').forEach(b => b.classList.toggle('active', b === btn));
      timerStore.set({ heatmapRange: btn.dataset.range });
    })
  );

  const syncBtns = (running) => {
    startBtn.style.display = running ? 'none' : '';
    btnPair.style.display  = running ? 'flex' : 'none';
  };

  timerStore.subscribe(s => {
    timerEl.textContent = fmtTime(s.elapsedSeconds);
    const pct = Math.min(s.elapsedSeconds / SESSION_TARGET, 1);
    arcFill.style.strokeDashoffset = ARC_FULL - ARC_FULL * pct;
    timerPct.textContent = Math.round(pct * 100) + '%';
    syncBtns(s.running);
    _updateStats(s);
  });

  onSyncStatus(status => _updateChip(container, status));

  const s = timerStore.get();
  taskInput.value = s.task;
  intensity.value = s.intensity;
  _updateTaskDisplay(taskDisp, s.task);
  syncBtns(s.running);
  timerEl.textContent = fmtTime(s.elapsedSeconds);
  timerPct.textContent = Math.round(Math.min(s.elapsedSeconds / SESSION_TARGET, 1) * 100) + '%';
  arcFill.style.strokeDashoffset = ARC_FULL - ARC_FULL * Math.min(s.elapsedSeconds / SESSION_TARGET, 1);
  _updateStats(s);
}

function _buildTicks() {
  const g = document.getElementById('arcTicks');
  if (!g) return;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2, major = i % 5 === 0, r1 = major ? 69 : 72, r2 = 77;
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', (80 + r1 * Math.cos(a)).toFixed(2)); ln.setAttribute('y1', (80 + r1 * Math.sin(a)).toFixed(2));
    ln.setAttribute('x2', (80 + r2 * Math.cos(a)).toFixed(2)); ln.setAttribute('y2', (80 + r2 * Math.sin(a)).toFixed(2));
    ln.setAttribute('stroke', `rgba(0,245,255,${major ? 0.38 : 0.14})`);
    ln.setAttribute('stroke-width', major ? '1.5' : '0.8'); ln.setAttribute('stroke-linecap', 'round');
    g.appendChild(ln);
  }
}

function _updateTaskDisplay(el, val) {
  if (!val.trim()) { el.innerHTML = 'Untitled <em>Flow</em>'; return; }
  const words = val.trim().split(' '); const last = words.pop();
  el.innerHTML = words.length ? `${words.join(' ')} <em>${last}</em>` : `${last} <em>&nbsp;</em>`;
}

function _updateStats(s) {
  const { sessions } = s;
  const today = fmtDate(new Date());
  const todaySess = sessions.filter(x => x.date === today);
  const todayMin  = todaySess.reduce((a, x) => a + x.minutes, 0);
  const bestBlock = todaySess.reduce((m, x) => Math.max(m, x.minutes), 0);
  const sw = weekStart();
  const weeklySess = sessions.filter(x => new Date(x.date + 'T00:00:00') >= sw);
  const weeklyMin  = weeklySess.reduce((a, x) => a + x.minutes, 0);
  const pct = Math.min(weeklyMin / WEEKLY_TARGET * 100, 100);
  const allTime = sessions.reduce((m, x) => Math.max(m, x.minutes), 0);
  const streak  = calcStreak(sessions), mstreak = calcMaxStreak(sessions);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('todayMinutes', todayMin); set('todaySessions', todaySess.length);
  set('bestBlock', bestBlock);   set('streakDays', streak);
  set('weeklyAchieved', `${weeklyMin} min achieved`); set('weeklyLeft', `${Math.max(WEEKLY_TARGET - weeklyMin, 0)} min left`);
  set('weeklySessions', weeklySess.length); set('allTimeRecord', `${allTime} min`);
  set('maxStreak', `${mstreak} days`);
  set('kpiWeeklySess', weeklySess.length); set('kpiStreak', streak); set('kpiAllTime', allTime);
  const fp = document.getElementById('weeklyProgress'); if (fp) fp.style.width = `${pct}%`;

  _renderHeatmap(sessions, s.heatmapRange);
  _renderSessions(sessions);
}

function _renderHeatmap(sessions, range) {
  const el = document.getElementById('heatmap'); if (!el) return;
  const map  = byDate(sessions);
  const days = heatDays(range).map(d => ({ k: fmtDate(d), label: d.toLocaleDateString(undefined, { weekday: 'short' }), min: map[fmtDate(d)] || 0 }));
  let best = { k: null, min: 0 };
  el.innerHTML = days.map(d => {
    const lv = d.min === 0 ? 0 : d.min < 30 ? 1 : d.min < 60 ? 2 : d.min < 120 ? 3 : 4;
    if (d.min > best.min) best = d;
    return `<div class="heat-cell l${lv}" title="${d.label}: ${d.min} min"><span>${d.label.toUpperCase()}</span><b>${d.min}</b></div>`;
  }).join('');
  const cap = document.getElementById('bestDay');
  if (cap) cap.textContent = best.min > 0 ? `Best day: ${readableDate(best.k)} · ${best.min} min` : 'No data yet';
}

function _renderSessions(sessions) {
  const list = document.getElementById('sessionList'); if (!list) return;
  const empty = document.getElementById('emptyDW');
  if (!sessions.length) { list.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';
  list.innerHTML = sessions.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(s => `
    <li class="session-item">
      <div class="session-row"><span class="session-task">${s.task}</span><span class="session-dur">${s.minutes} min</span></div>
      <div class="session-meta">${s.intensity} · ${readableDate(s.date)} · ${new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </li>`).join('');
}

function _updateChip(container, status) {
  const chip  = container.querySelector('#dwCloudChip');
  const dot   = container.querySelector('#dwCloudDot');
  const label = container.querySelector('#dwCloudLabel');
  if (!chip) return;
  if (status === 'idle') { chip.style.display = 'none'; return; }
  chip.style.display = 'flex';
  chip.className = `dw-cloud-chip ${status}`;
  label.textContent = status === 'syncing' ? 'saving...' : status === 'synced' ? 'synced' : 'sync error';
}
