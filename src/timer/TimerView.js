import { timerStore } from '../store/timerStore.js';
import { startTimer, stopTimer, pauseTimer, resetTimer, setTask, setIntensity, setTags, setTimerMode, updateSession, onSessionComplete, onBreakStart, getTarget, ARC_FULL, setAutoBreak, setPomodoroWorkMins, setPomodoroBreakMins, setTickSound } from './timerEngine.js';
import { onSyncStatus } from '../services/syncEngine.js';
import { unlockAudio, requestNotifyPermission } from '../services/notifications.js';
import { fmtTime, readableDate, fmtDate, byDate, calcStreak, calcMaxStreak, heatDays, weekStart, parseLocalDate } from '../shared/utils.js';
import { toast } from '../shared/Toast.js';
import { settings } from '../shared/settings.js';

const _esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let _editOriginal = null;

const _MODE_CFG = {
  pomodoro: { label: 'Pomodoro', dur: '25 min', break: 'Take a 5-minute break!' },
  deepwork: { label: 'Deep Work', dur: '90 min', break: 'Take a well-earned break.' },
  custom:   { label: 'Custom',   dur: null,     break: 'Good work — rest up.' },
};

export function mountTimerView(container) {
  container.innerHTML = `
    <div class="app">
      <div class="panel">
        <div class="panel-corner tl"></div><div class="panel-corner tr"></div>
        <div class="panel-corner bl"></div><div class="panel-corner br"></div>
        <div class="panel-label"><span class="sym">// </span>current session</div>
        <div class="panel-title">Deep Work Timer</div>
        <div class="session-body">
          <div class="session-left">
            <div class="task-block">
              <div class="task-kicker">Active mission</div>
              <div class="task-name" id="taskDisplay">Untitled <em>Flow</em></div>
            </div>
            <div class="setup-row">
              <div class="field task-field">
                <label for="taskInput">Mission label</label>
                <input id="taskInput" type="text" placeholder="What are you working on?" autocomplete="off" />
                <div id="recentTasksDrop" class="recent-tasks-drop"></div>
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
            <div class="setup-row tag-row">
              <div class="field task-field">
                <label for="tagInput">Tags <span class="field-kicker">comma-separated</span></label>
                <input id="tagInput" type="text" placeholder="e.g. Reading, Study, Personal" autocomplete="off" />
                <div id="recentTagsDrop" class="recent-tasks-drop"></div>
              </div>
            </div>
            <div class="mode-row" id="modeRow">
              <button class="mode-btn" data-mode="pomodoro">
                <span class="mode-name">Pomodoro</span>
                <span class="mode-dur" id="pomodoroDurLabel">25 min</span>
              </button>
              <button class="mode-btn active" data-mode="deepwork">
                <span class="mode-name">Deep Work</span>
                <span class="mode-dur">90 min</span>
              </button>
              <button class="mode-btn" data-mode="custom">
                <span class="mode-name">Custom</span>
                <span class="mode-dur" id="customDurLabel">60 min</span>
              </button>
            </div>
            <div class="pomo-config-row" id="pomoConfigRow" style="display:none">
              <div class="pomo-presets">
                <button class="pomo-preset" id="preset2505" data-work="25" data-break="5">25/5</button>
                <button class="pomo-preset" id="preset5010" data-work="50" data-break="10">50/10</button>
              </div>
              <div class="pomo-inputs">
                <span class="pomo-lbl">Work</span>
                <input type="number" id="pomoWorkMins" min="5" max="120" value="25">
                <span class="pomo-lbl">min · Break</span>
                <input type="number" id="pomoBreakMins" min="1" max="30" value="5">
                <span class="pomo-lbl">min</span>
              </div>
              <label class="pomo-auto-label">
                <input type="checkbox" id="autoBreakToggle"> Auto-break
              </label>
            </div>
            <div class="custom-minutes-row" id="customRow" style="display:none">
              <label for="customMinutes">Duration</label>
              <input type="number" id="customMinutes" min="5" max="480" value="60" />
              <span>min</span>
            </div>
            <div class="stats-grid">
              <div class="stat"><div class="stat-label">Deep Min</div><div class="stat-value" id="todayMinutes">0</div><div class="stat-sub">Today total</div></div>
              <div class="stat"><div class="stat-label">Sessions</div><div class="stat-value" id="todaySessions">0</div><div class="stat-sub">Completed today</div></div>
              <div class="stat"><div class="stat-label">Best Block</div><div class="stat-value" id="bestBlock">0</div><div class="stat-sub">Longest (min)</div></div>
              <div class="stat"><div class="stat-label">Streak</div><div class="stat-value" id="streakDays">0</div><div class="stat-sub">Day streak</div></div>
            </div>
          </div>
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
            <div class="timer-sub" id="timerSub">elapsed</div>
            <div class="phase-badge" id="phaseBadge"></div>
          </div>
        </div>
        <div class="btn-col">
          <button class="btn btn-start" id="startBtn">▶&ensp;Start Session</button>
          <div class="btn-pair" id="btnPair" style="display:none">
            <button class="btn btn-pause" id="pauseResumeBtn"><i class="fas fa-pause"></i>&ensp;Pause</button>
            <button class="btn btn-stop"  id="stopBtn"><i class="fas fa-stop-circle"></i>&ensp;Stop</button>
          </div>
          <button class="btn btn-reset" id="resetBtn" style="display:none"><i class="fas fa-undo-alt"></i>&ensp;Reset</button>
          <label class="tick-toggle-label">
            <input type="checkbox" id="tickSoundToggle"> <span>🔊 Tick sound</span>
          </label>
          <div id="dwCloudChip" class="dw-cloud-chip" style="display:none">
            <span class="dw-cloud-dot" id="dwCloudDot"></span>
            <span id="dwCloudLabel">cloud sync</span>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-corner tl"></div><div class="panel-corner tr"></div>
        <div class="panel-corner bl"></div><div class="panel-corner br"></div>
        <div class="panel-label"><span class="sym">// </span>weekly goal</div>
        <div class="panel-title" id="weeklyGoalTitle">300-Min Target</div>
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
            <div><div class="panel-label"><span class="sym">// </span>consistency</div><div class="panel-title">Heatmap</div></div>
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
          <div class="panel-head"><div><div class="panel-label"><span class="sym">// </span>log</div><div class="panel-title">Completed Sessions</div></div></div>
          <ul class="session-list" id="sessionList"></ul>
          <div class="empty-msg" id="emptyDW">No sessions yet — start your first block.</div>
        </div>
      </div>

      <div id="reflect-overlay" class="reflect-overlay">
        <div class="reflect-box">
          <div class="reflect-check">✓</div>
          <div class="reflect-title">How was your focus?</div>
          <div class="reflect-sub" id="reflectSub"></div>
          <div class="reflect-ratings">
            <button class="reflect-btn" data-q="flow"><span class="reflect-emoji">🌊</span><span class="reflect-lbl">Flow</span></button>
            <button class="reflect-btn" data-q="okay"><span class="reflect-emoji">👍</span><span class="reflect-lbl">Okay</span></button>
            <button class="reflect-btn" data-q="distracted"><span class="reflect-emoji">😵</span><span class="reflect-lbl">Distracted</span></button>
          </div>
          <input class="reflect-note" id="reflectNote" type="text" placeholder="One-line note (optional)" maxlength="120" autocomplete="off" />
          <div class="reflect-actions">
            <button class="btn btn-start reflect-save-btn" id="reflectSave">Save &amp; Continue</button>
            <button class="btn btn-reset reflect-skip-btn" id="reflectSkip">Skip</button>
          </div>
          <div class="reflect-countdown">Auto-continue in <span id="reflectSecs">15</span>s</div>
        </div>
      </div>

      <div id="break-overlay" class="break-overlay">
        <div class="break-box">
          <div class="break-check">✓</div>
          <div class="break-title" id="breakTitle">Session Complete</div>
          <div class="break-detail" id="breakDetail">Take a well-earned break!</div>
          <div class="break-actions">
            <button class="btn btn-start" id="breakNewSession">▶&ensp;New Session</button>
            <button class="btn btn-reset" id="breakDismiss">Dismiss</button>
          </div>
        </div>
      </div>
    </div>`;

  _buildTicks();

  const arcFill        = container.querySelector('#arcFill');
  const timerEl        = container.querySelector('#timerEl');
  const timerPct       = container.querySelector('#timerPct');
  const timerSub       = container.querySelector('#timerSub');
  const phaseBadge     = container.querySelector('#phaseBadge');
  const startBtn       = container.querySelector('#startBtn');
  const btnPair        = container.querySelector('#btnPair');
  const pauseResumeBtn = container.querySelector('#pauseResumeBtn');
  const stopBtn        = container.querySelector('#stopBtn');
  const resetBtn       = container.querySelector('#resetBtn');
  const taskInput      = container.querySelector('#taskInput');
  const taskDisp       = container.querySelector('#taskDisplay');
  const intensity      = container.querySelector('#intensitySelect');
  const modeRow        = container.querySelector('#modeRow');
  const customRow      = container.querySelector('#customRow');
  const customMinutes  = container.querySelector('#customMinutes');
  const customDurLabel = container.querySelector('#customDurLabel');
  const pomoConfigRow  = container.querySelector('#pomoConfigRow');
  const pomoWorkMins   = container.querySelector('#pomoWorkMins');
  const pomoBreakMins  = container.querySelector('#pomoBreakMins');
  const autoBreakTgl   = container.querySelector('#autoBreakToggle');
  const tickSoundTgl   = container.querySelector('#tickSoundToggle');
  const breakOverlay   = container.querySelector('#break-overlay');

  // ── Mode selector ──────────────────────────────────────────────────────────
  modeRow.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      const mins = mode === 'custom' ? (Number(customMinutes.value) || 60) : null;
      setTimerMode(mode, mins ? mins * 60 : undefined);
    });
  });

  customMinutes.addEventListener('change', () => {
    const mins = Math.max(5, Math.min(480, Number(customMinutes.value) || 60));
    customMinutes.value = mins;
    customDurLabel.textContent = `${mins} min`;
    setTimerMode('custom', mins * 60);
  });

  // ── Pomodoro config ────────────────────────────────────────────────────────
  container.querySelector('#preset2505').addEventListener('click', () => {
    pomoWorkMins.value = 25; pomoBreakMins.value = 5;
    setPomodoroWorkMins(25); setPomodoroBreakMins(5);
    _syncPomoPresets(container, 25, 5);
  });
  container.querySelector('#preset5010').addEventListener('click', () => {
    pomoWorkMins.value = 50; pomoBreakMins.value = 10;
    setPomodoroWorkMins(50); setPomodoroBreakMins(10);
    _syncPomoPresets(container, 50, 10);
  });
  pomoWorkMins.addEventListener('change', () => {
    const m = Math.max(5, Math.min(120, Number(pomoWorkMins.value) || 25));
    pomoWorkMins.value = m;
    setPomodoroWorkMins(m);
    _syncPomoPresets(container, m, Number(pomoBreakMins.value));
  });
  pomoBreakMins.addEventListener('change', () => {
    const m = Math.max(1, Math.min(30, Number(pomoBreakMins.value) || 5));
    pomoBreakMins.value = m;
    setPomodoroBreakMins(m);
    _syncPomoPresets(container, Number(pomoWorkMins.value), m);
  });
  autoBreakTgl.addEventListener('change', () => setAutoBreak(autoBreakTgl.checked));
  tickSoundTgl.addEventListener('change', () => setTickSound(tickSoundTgl.checked));

  // ── Timer buttons ──────────────────────────────────────────────────────────
  startBtn.addEventListener('click', () => {
    unlockAudio();
    requestNotifyPermission();
    startTimer();
  });

  pauseResumeBtn.addEventListener('click', () => {
    const s = timerStore.get();
    if (s.running) pauseTimer();
    else startTimer();
  });

  stopBtn.addEventListener('click', stopTimer);
  resetBtn.addEventListener('click', resetTimer);

  // ── Task input ─────────────────────────────────────────────────────────────
  taskInput.addEventListener('input', e => { setTask(e.target.value); _updateTaskDisplay(taskDisp, e.target.value); });
  intensity.addEventListener('change', e => setIntensity(e.target.value));

  const taskDrop = container.querySelector('#recentTasksDrop');
  taskInput.addEventListener('focus', () => {
    const sessions = timerStore.get().sessions;
    const seen = new Set();
    const recent = sessions
      .slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(s => s.task)
      .filter(t => t && !seen.has(t) && seen.add(t))
      .slice(0, 8);
    if (!recent.length) return;
    taskDrop.innerHTML = recent.map(t => `<button class="recent-task-item" type="button">${_esc(t)}</button>`).join('');
    taskDrop.classList.add('open');
    taskDrop.querySelectorAll('.recent-task-item').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        const val = btn.textContent;
        taskInput.value = val;
        setTask(val);
        _updateTaskDisplay(taskDisp, val);
        taskDrop.classList.remove('open');
      });
    });
  });
  taskInput.addEventListener('blur', () => setTimeout(() => taskDrop.classList.remove('open'), 150));

  // ── Tag input ──────────────────────────────────────────────────────────────
  const tagInput = container.querySelector('#tagInput');
  const tagDrop  = container.querySelector('#recentTagsDrop');

  const _parseTags = str => str.split(',').map(t => t.trim()).filter(Boolean);

  tagInput.addEventListener('input', e => setTags(_parseTags(e.target.value)));

  tagInput.addEventListener('focus', () => {
    const sessions = timerStore.get().sessions;
    const freq = {};
    sessions.forEach(s => (s.tags ?? []).forEach(t => { freq[t] = (freq[t] || 0) + 1; }));
    const allTags = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([t]) => t);
    if (!allTags.length) return;
    tagDrop.innerHTML = allTags.map(t => `<button class="recent-task-item" type="button">${_esc(t)}</button>`).join('');
    tagDrop.classList.add('open');
    tagDrop.querySelectorAll('.recent-task-item').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        const existing = _parseTags(tagInput.value);
        const clicked  = btn.textContent;
        if (!existing.includes(clicked)) {
          const updated = [...existing, clicked];
          tagInput.value = updated.join(', ');
          setTags(updated);
        }
        tagDrop.classList.remove('open');
      });
    });
  });

  tagInput.addEventListener('blur', () => {
    setTimeout(() => tagDrop.classList.remove('open'), 150);
    const tags = _parseTags(tagInput.value);
    tagInput.value = tags.join(', ');
    setTags(tags);
  });

  container.querySelectorAll('.range-toggle button').forEach(btn =>
    btn.addEventListener('click', () => {
      container.querySelectorAll('.range-toggle button').forEach(b => b.classList.toggle('active', b === btn));
      timerStore.set({ heatmapRange: btn.dataset.range });
    })
  );

  // ── Break overlay ──────────────────────────────────────────────────────────
  const _displayBreak = ({ mode, minutes, task }) => {
    if (mode === 'break-end') {
      document.getElementById('breakTitle').textContent  = 'Break Complete!';
      document.getElementById('breakDetail').textContent = `${minutes} min break done — ready to focus again?`;
    } else {
      const cfg = _MODE_CFG[mode] ?? _MODE_CFG.custom;
      document.getElementById('breakTitle').textContent  = `${cfg.label} complete!`;
      document.getElementById('breakDetail').textContent = `${minutes} min · ${task || 'Untitled Flow'} — ${cfg.break}`;
    }
    breakOverlay.classList.add('active');
    const _autoClose = setTimeout(() => breakOverlay.classList.remove('active'), 30000);
    const _close = () => { clearTimeout(_autoClose); breakOverlay.classList.remove('active'); };
    container.querySelector('#breakDismiss').onclick    = _close;
    container.querySelector('#breakNewSession').onclick = () => { _close(); startTimer(); };
  };

  // ── Reflection overlay ─────────────────────────────────────────────────────
  const reflectOverlay = container.querySelector('#reflect-overlay');

  const _showReflect = ({ minutes, task, timestamp }, onDone) => {
    const noteEl  = container.querySelector('#reflectNote');
    const secsEl  = container.querySelector('#reflectSecs');
    const subEl   = container.querySelector('#reflectSub');
    let selectedQ = null;
    let _secs = 15;
    let _timer;

    noteEl.value = '';
    subEl.textContent = `${minutes} min · ${task || 'Untitled Flow'}`;
    reflectOverlay.querySelectorAll('.reflect-btn').forEach(b => b.classList.remove('selected'));
    secsEl.textContent = _secs;

    const _finish = save => {
      clearInterval(_timer);
      reflectOverlay.classList.remove('active');
      if (save && selectedQ) {
        const patch = { quality: selectedQ };
        const note = noteEl.value.trim();
        if (note) patch.note = note;
        updateSession(timestamp, patch);
      }
      onDone();
    };

    reflectOverlay.querySelectorAll('.reflect-btn').forEach(btn => {
      btn.onclick = () => {
        reflectOverlay.querySelectorAll('.reflect-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedQ = btn.dataset.q;
      };
    });

    container.querySelector('#reflectSave').onclick = () => _finish(true);
    container.querySelector('#reflectSkip').onclick = () => _finish(false);

    _timer = setInterval(() => {
      _secs--;
      secsEl.textContent = _secs;
      if (_secs <= 0) _finish(false);
    }, 1000);

    reflectOverlay.classList.add('active');
  };

  const _showBreak = data => {
    if (data.mode === 'break-end') { _displayBreak(data); return; }
    _showReflect(data, () => _displayBreak(data));
  };

  onSessionComplete(_showBreak);
  onBreakStart(({ breakMins }) => {
    toast.show(`☕ Break started — ${breakMins} min. Rest up!`, 'success');
  });
  breakOverlay.addEventListener('click', e => { if (e.target === breakOverlay) breakOverlay.classList.remove('active'); });
  reflectOverlay.addEventListener('click', e => { if (e.target === reflectOverlay) { /* intentionally non-dismissable */ } });

  // ── Sync state → UI ────────────────────────────────────────────────────────
  const syncBtns = s => {
    const active = s.running || s.paused;
    startBtn.style.display  = active ? 'none' : '';
    btnPair.style.display   = active ? 'flex' : 'none';
    resetBtn.style.display  = s.paused ? '' : 'none';
    pauseResumeBtn.innerHTML = s.running
      ? '<i class="fas fa-pause"></i>&ensp;Pause'
      : '▶&ensp;Resume';

    const isBreak = s.pomodoroPhase === 'break';
    timerSub.textContent = s.paused ? (isBreak ? 'paused · break' : 'paused') : (isBreak ? 'break' : 'elapsed');
    if (phaseBadge) phaseBadge.textContent = isBreak ? '☕ Break Mode' : '';

    // Arc color reflects phase
    arcFill.style.stroke = isBreak ? 'var(--neon-green)' : '';
    arcFill.style.filter = isBreak ? 'drop-shadow(0 0 10px rgba(57,255,20,0.8))' : '';

    modeRow.querySelectorAll('.mode-btn').forEach(b => { b.disabled = active; });
    customMinutes.disabled = active;
    pomoWorkMins.disabled  = active;
    pomoBreakMins.disabled = active;

    modeRow.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === s.timerMode));

    customRow.style.display    = s.timerMode === 'custom'    ? '' : 'none';
    pomoConfigRow.style.display = s.timerMode === 'pomodoro' ? '' : 'none';
    customDurLabel.textContent = `${Math.round((s.customTarget || 3600) / 60)} min`;

    const pomodoroDurLabel = container.querySelector('#pomodoroDurLabel');
    if (pomodoroDurLabel) pomodoroDurLabel.textContent = `${s.pomodoroWorkMins || 25} min`;

    autoBreakTgl.checked = s.autoBreak;
    tickSoundTgl.checked = s.tickSound;
    _syncPomoPresets(container, s.pomodoroWorkMins || 25, s.pomodoroBreakMins || 5);
  };

  timerStore.subscribe(s => {
    timerEl.textContent = fmtTime(s.elapsedSeconds);
    const target = getTarget(s);
    const pct = Math.min(s.elapsedSeconds / target, 1);
    arcFill.style.strokeDashoffset = ARC_FULL - ARC_FULL * pct;
    timerPct.textContent = Math.round(pct * 100) + '%';
    syncBtns(s);
    _updateStats(s);
  });

  onSyncStatus(status => _updateChip(container, status));
  mountSessionEditModal();

  // ── Initial render ─────────────────────────────────────────────────────────
  const s = timerStore.get();
  taskInput.value  = s.task;
  intensity.value  = s.intensity;
  tagInput.value   = (s.tags ?? []).join(', ');
  customMinutes.value = Math.round((s.customTarget || 3600) / 60);
  pomoWorkMins.value  = s.pomodoroWorkMins || 25;
  pomoBreakMins.value = s.pomodoroBreakMins || 5;
  _updateTaskDisplay(taskDisp, s.task);
  syncBtns(s);
  timerEl.textContent = fmtTime(s.elapsedSeconds);
  const initTarget = getTarget(s);
  const initPct = Math.min(s.elapsedSeconds / initTarget, 1);
  timerPct.textContent = Math.round(initPct * 100) + '%';
  arcFill.style.strokeDashoffset = ARC_FULL - ARC_FULL * initPct;
  _updateStats(s);
}

function _syncPomoPresets(container, workMins, breakMins) {
  container.querySelector('#preset2505')?.classList.toggle('active', workMins === 25 && breakMins === 5);
  container.querySelector('#preset5010')?.classList.toggle('active', workMins === 50 && breakMins === 10);
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
  const weeklySess = sessions.filter(x => parseLocalDate(x.date) >= sw);
  const weeklyMin  = weeklySess.reduce((a, x) => a + x.minutes, 0);
  const weeklyTarget = settings.get().weeklyGoalMins;
  const pct = Math.min(weeklyMin / weeklyTarget * 100, 100);
  const allTime = sessions.reduce((m, x) => Math.max(m, x.minutes), 0);
  const streak  = calcStreak(sessions), mstreak = calcMaxStreak(sessions);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('todayMinutes', todayMin); set('todaySessions', todaySess.length);
  set('bestBlock', bestBlock);   set('streakDays', streak);
  set('weeklyAchieved', `${weeklyMin} min achieved`); set('weeklyLeft', `${Math.max(weeklyTarget - weeklyMin, 0)} min left`);
  set('weeklySessions', weeklySess.length); set('allTimeRecord', `${allTime} min`);
  set('maxStreak', `${mstreak} days`);
  set('kpiWeeklySess', weeklySess.length); set('kpiStreak', streak); set('kpiAllTime', allTime);
  set('weeklyGoalTitle', `${weeklyTarget}-Min Target`);
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
  const _Q_LABEL = { flow: '🌊 Flow', okay: '👍 Okay', distracted: '😵 Distracted' };

  list.innerHTML = sessions.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(s => `
    <li class="session-item">
      <div class="session-row">
        <span class="session-task">${s.task}</span>
        <div class="session-row-end">
          ${s.quality ? `<span class="session-quality sq-${s.quality}">${_Q_LABEL[s.quality]}</span>` : ''}
          <span class="session-dur">${s.minutes} min</span>
          <button class="session-edit-btn" data-ts="${s.timestamp}" title="Edit session">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
        </div>
      </div>
      <div class="session-meta">${s.intensity} · ${readableDate(s.date)} · ${new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      ${s.note ? `<div class="session-note">${_esc(s.note)}</div>` : ''}
      ${s.tags?.length ? `<div class="session-tags">${s.tags.map(t => `<span class="session-tag">${_esc(t)}</span>`).join('')}</div>` : ''}
    </li>`).join('');

  list.querySelectorAll('.session-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const session = sessions.find(x => x.timestamp === btn.dataset.ts);
      if (session) _openSessionEditModal(session);
    });
  });
}

function _openSessionEditModal(session) {
  const modal = document.getElementById('session-edit-modal');
  if (!modal) return;
  document.getElementById('session-ts').value             = session.timestamp;
  document.getElementById('session-edit-task').value      = session.task;
  document.getElementById('session-edit-minutes').value   = session.minutes;
  document.getElementById('session-edit-intensity').value = session.intensity;
  document.getElementById('session-edit-tags').value      = (session.tags ?? []).join(', ');
  _editOriginal = {
    task:      session.task,
    minutes:   session.minutes,
    intensity: session.intensity,
    tags:      (session.tags ?? []).join(', '),
  };
  _updateSessionDiff();
  modal.classList.add('active');
}

function _updateSessionDiff() {
  const diffEl = document.getElementById('session-edit-diff');
  if (!diffEl || !_editOriginal) return;

  const task      = (document.getElementById('session-edit-task')?.value || '').trim() || 'Untitled Flow';
  const minutes   = Math.max(1, parseInt(document.getElementById('session-edit-minutes')?.value, 10) || 1);
  const intensity = document.getElementById('session-edit-intensity')?.value || '';
  const tags      = (document.getElementById('session-edit-tags')?.value || '').trim();

  const changes = [];
  if (minutes !== _editOriginal.minutes)       changes.push(`${_editOriginal.minutes} min → ${minutes} min`);
  if (task !== _editOriginal.task)             changes.push(`"${_editOriginal.task}" → "${task}"`);
  if (intensity !== _editOriginal.intensity)   changes.push(`${_editOriginal.intensity} → ${intensity}`);
  if (tags !== _editOriginal.tags.trim())      changes.push('tags updated');

  diffEl.textContent = '';
  diffEl.classList.remove('has-changes');
  if (changes.length === 0) return;

  diffEl.classList.add('has-changes');
  const label = document.createElement('span');
  label.className = 'diff-label';
  label.textContent = 'Changes: ';
  diffEl.appendChild(label);
  changes.forEach((c, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'diff-sep';
      sep.textContent = ' · ';
      diffEl.appendChild(sep);
    }
    const item = document.createElement('span');
    item.className = 'diff-item';
    item.textContent = c;
    diffEl.appendChild(item);
  });
}

function mountSessionEditModal() {
  const modal     = document.getElementById('session-edit-modal');
  const form      = document.getElementById('session-edit-form');
  const cancelBtn = document.getElementById('session-cancel-btn');
  if (!modal || !form || !cancelBtn) return;

  const close = () => { modal.classList.remove('active'); setTimeout(() => form.reset(), 300); };
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  ['session-edit-task', 'session-edit-minutes', 'session-edit-intensity', 'session-edit-tags'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', _updateSessionDiff);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const ts        = document.getElementById('session-ts').value;
    const task      = document.getElementById('session-edit-task').value.trim() || 'Untitled Flow';
    const minutes   = Math.max(1, parseInt(document.getElementById('session-edit-minutes').value, 10));
    const intensity = document.getElementById('session-edit-intensity').value;
    const tags      = (document.getElementById('session-edit-tags').value || '')
      .split(',').map(t => t.trim()).filter(Boolean);
    updateSession(ts, { task, minutes, intensity, tags });
    toast.show('Session updated', 'success');
    close();
  });
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
