import { timerStore } from '../store/timerStore.js';
import { trackerStore } from '../store/trackerStore.js';
import { Nav } from '../shared/Nav.js';
import { fmtDate, calcStreak, calcMaxStreak, weekStart, byDate, calcProgress, readableDateLong, parseLocalDate } from '../shared/utils.js';
import { exportSessionsCSV, exportFullBackup } from '../tracker/trackerEngine.js';
import { settings } from '../shared/settings.js';

const _esc    = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const _srBadge = ease => {
  const e = ease ?? 2.5;
  if (e < 1.6) return '<span class="sr-badge sr-weak">Weak</span>';
  if (e < 2.2) return '<span class="sr-badge sr-growing">Growing</span>';
  return '<span class="sr-badge sr-strong">Strong</span>';
};

let _chartRange = '14d';

export function mountAnalyticsView(container) {
  container.innerHTML = `
    <div class="container">
      <div class="panel">
        <div class="panel-corner tl"></div><div class="panel-corner tr"></div>
        <div class="panel-corner bl"></div><div class="panel-corner br"></div>
        <div class="an-hero">
          <div class="an-hero-icon">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2"  y="18" width="5" height="12" rx="1" fill="currentColor" opacity="0.5"/>
              <rect x="9"  y="10" width="5" height="20" rx="1" fill="currentColor" opacity="0.75"/>
              <rect x="16" y="4"  width="5" height="26" rx="1" fill="currentColor"/>
              <rect x="23" y="14" width="5" height="16" rx="1" fill="currentColor" opacity="0.65"/>
            </svg>
          </div>
          <div class="an-hero-text">
            <div class="an-hero-eyebrow">// analytics</div>
            <h1 class="an-hero-title">Focus <span>Metrics</span></h1>
            <p class="an-hero-sub">Deep work insights · Adaptive learning intelligence</p>
          </div>
          <div class="an-hero-live">
            <div class="an-live-dot"></div>
            <span>live data</span>
          </div>
        </div>
      </div>
      <div id="an-controls" class="an-section"></div>
      <div id="an-kpis" class="an-kpi-row"></div>
      <div id="an-daily" class="an-section"></div>
      <div class="an-row">
        <div id="an-intensity" class="an-section an-half"></div>
        <div id="an-dow" class="an-section an-half"></div>
      </div>
      <div id="an-tasks" class="an-section"></div>
      <div id="an-learning" class="an-section"></div>
    </div>`;

  // Event delegation — persists even as controls section is re-rendered
  container.addEventListener('click', e => {
    const rangeBtn  = e.target.closest('[data-range]');
    const exportBtn = e.target.closest('[data-export]');
    if (rangeBtn) {
      _chartRange = rangeBtn.dataset.range;
      const sessions = timerStore.get().sessions || [];
      _renderControls(_chartRange);
      _renderDailyChart(sessions, _chartRange);
    }
    if (exportBtn) {
      const type = exportBtn.dataset.export;
      if (type === 'csv')  exportSessionsCSV();
      if (type === 'json') exportFullBackup();
    }
  });

  function _render() {
    if (!document.body.classList.contains('theme-an')) return;
    const sessions = timerStore.get().sessions || [];
    const topics   = trackerStore.get();
    _renderControls(_chartRange);
    _renderKPIs(sessions);
    _renderDailyChart(sessions, _chartRange);
    _renderIntensity(sessions);
    _renderDow(sessions);
    _renderTopTasks(sessions);
    _renderLearning(topics);
  }

  Nav.onSwitch(v => { if (v === 'an') _render(); });
  timerStore.subscribe(_render);
  trackerStore.subscribe(_render);
  settings.subscribe(_render);

  const _s0 = timerStore.get().sessions || [];
  const _t0 = trackerStore.get();
  _renderControls(_chartRange);
  _renderKPIs(_s0); _renderDailyChart(_s0, _chartRange); _renderIntensity(_s0);
  _renderDow(_s0);  _renderTopTasks(_s0);                _renderLearning(_t0);
}

function _renderControls(range) {
  const el = document.getElementById('an-controls');
  if (!el) return;
  const presets = [
    { key: 'thisweek',  label: 'This Week'  },
    { key: 'lastweek',  label: 'Last Week'  },
    { key: 'thismonth', label: 'This Month' },
    { key: '14d',       label: '14 Days'    },
    { key: '30d',       label: '30 Days'    },
  ];
  const csvIcon  = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`;
  const jsonIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>`;
  el.innerHTML = `
    <div class="an-controls-row">
      <div class="an-controls-group">
        <span class="an-controls-lbl">// range</span>
        ${presets.map(p => `<button class="an-preset-btn${range === p.key ? ' active' : ''}" data-range="${p.key}">${p.label}</button>`).join('')}
      </div>
      <div class="an-controls-group">
        <span class="an-controls-lbl">// export</span>
        <button class="an-export-btn" data-export="csv">${csvIcon}Sessions CSV</button>
        <button class="an-export-btn" data-export="json">${jsonIcon}Full Backup</button>
      </div>
    </div>`;
}

function _getDaysForRange(range) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (range === '30d') {
    return Array.from({ length: 30 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - (29 - i)); return d; });
  }
  if (range === 'thisweek') {
    const dow = (today.getDay() + 6) % 7; // Mon = 0
    const monday = new Date(today); monday.setDate(today.getDate() - dow);
    const days = [];
    for (let d = new Date(monday); d <= today; d.setDate(d.getDate() + 1)) days.push(new Date(d));
    return days;
  }
  if (range === 'lastweek') {
    const dow = (today.getDay() + 6) % 7;
    const monday = new Date(today); monday.setDate(today.getDate() - dow - 7);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  }
  if (range === 'thismonth') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const days = [];
    for (let d = new Date(first); d <= today; d.setDate(d.getDate() + 1)) days.push(new Date(d));
    return days;
  }
  // default: '14d'
  return Array.from({ length: 14 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - (13 - i)); return d; });
}

const _RANGE_TITLES = {
  '14d': '// 14-Day Activity', '30d': '// 30-Day Activity',
  'thisweek': '// This Week', 'lastweek': '// Last Week', 'thismonth': '// This Month',
};

function _isoWeekRange(weeksAgo) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now); monday.setDate(now.getDate() - dow - weeksAgo * 7);
  const end = new Date(monday); end.setDate(monday.getDate() + 7);
  return { start: fmtDate(monday), end: fmtDate(end) };
}

function _deltaHtml(curr, prev) {
  if (prev === 0 && curr === 0) return '';
  if (prev === 0) return `<div class="an-kpi-delta an-kpi-delta-pos">↑ new data</div>`;
  const pct = Math.round((curr - prev) / prev * 100);
  const cls = pct > 0 ? 'an-kpi-delta-pos' : pct < 0 ? 'an-kpi-delta-neg' : 'an-kpi-delta-flat';
  return `<div class="an-kpi-delta ${cls}">${pct > 0 ? '+' : ''}${pct}% vs last week</div>`;
}

function _renderKPIs(sessions) {
  const el = document.getElementById('an-kpis');
  if (!el) return;
  const totalMin = sessions.reduce((s, x) => s + x.minutes, 0);

  const { start: w0Start, end: w0End } = _isoWeekRange(0);
  const { start: w1Start, end: w1End } = _isoWeekRange(1);
  const thisWeekSess = sessions.filter(s => s.date >= w0Start && s.date < w0End);
  const lastWeekSess = sessions.filter(s => s.date >= w1Start && s.date < w1End);
  const weekMin      = thisWeekSess.reduce((a, s) => a + s.minutes, 0);
  const lastWeekMin  = lastWeekSess.reduce((a, s) => a + s.minutes, 0);
  const thisWeekAvg  = thisWeekSess.length ? Math.round(weekMin / thisWeekSess.length) : 0;
  const lastWeekAvg  = lastWeekSess.length ? Math.round(lastWeekMin / lastWeekSess.length) : 0;

  const streak = calcStreak(sessions);
  const best   = calcMaxStreak(sessions);
  const avgMin = sessions.length ? Math.round(totalMin / sessions.length) : 0;

  const totalDiffMin = weekMin - lastWeekMin;
  const totalDiffH   = (Math.abs(totalDiffMin) / 60).toFixed(1);
  const totalDeltaHtml = (lastWeekMin === 0 && weekMin === 0) ? '' :
    `<div class="an-kpi-delta ${totalDiffMin >= 0 ? 'an-kpi-delta-pos' : 'an-kpi-delta-neg'}">${totalDiffMin >= 0 ? '+' : '-'}${totalDiffH}h vs last week</div>`;

  el.innerHTML = `
    <div class="an-kpi-card an-kpi-cyan">
      <div class="an-kpi-val">${(totalMin / 60).toFixed(1)}<span class="an-kpi-unit">h</span></div>
      <div class="an-kpi-lbl">Total Focus Time</div>
      ${totalDeltaHtml}
    </div>
    <div class="an-kpi-card an-kpi-gold">
      <div class="an-kpi-val">${(weekMin / 60).toFixed(1)}<span class="an-kpi-unit">h</span></div>
      <div class="an-kpi-lbl">This Week</div>
      ${_deltaHtml(weekMin, lastWeekMin)}
    </div>
    <div class="an-kpi-card an-kpi-green">
      <div class="an-kpi-val">${streak}<span class="an-kpi-unit">d</span></div>
      <div class="an-kpi-lbl">Streak · Best ${best}d</div>
      ${_deltaHtml(thisWeekSess.length, lastWeekSess.length)}
    </div>
    <div class="an-kpi-card an-kpi-purple">
      <div class="an-kpi-val">${avgMin}<span class="an-kpi-unit">m</span></div>
      <div class="an-kpi-lbl">Avg Session · ${sessions.length} total</div>
      ${_deltaHtml(thisWeekAvg, lastWeekAvg)}
    </div>`;
}

function _renderDailyChart(sessions, range = '14d') {
  const el = document.getElementById('an-daily');
  if (!el) return;
  const map  = byDate(sessions);
  const days = _getDaysForRange(range).map(d => ({
    date: fmtDate(d), day: d.getDate(), min: map[fmtDate(d)] || 0,
  }));

  const dailyGoal = settings.get().dailyGoalMins;
  const maxMin    = Math.max(...days.map(d => d.min), dailyGoal, 1);
  const totalMin  = days.reduce((s, d) => s + d.min, 0);
  const daysHit   = days.filter(d => d.min >= dailyGoal).length;
  const title     = _RANGE_TITLES[range] || '// Activity';
  const goalPct   = Math.round((dailyGoal / maxMin) * 100);

  // 7-day rolling average (only over active days)
  const rollingAvg = days.map((_, i) => {
    const slice = days.slice(Math.max(0, i - 6), i + 1).filter(d => d.min > 0);
    return slice.length ? Math.round(slice.reduce((s, d) => s + d.min, 0) / slice.length) : null;
  });

  el.innerHTML = `
    <div class="an-section-title">
      ${title}
      <span class="an-dim" style="font-size:.75em;font-weight:400">${(totalMin / 60).toFixed(1)}h total</span>
      <span class="an-goal-hit-badge ${daysHit > 0 ? 'an-goal-hit-pos' : ''}" title="${daysHit} of ${days.length} days hit goal">
        ${daysHit}/${days.length} goal days
      </span>
    </div>
    <div class="an-bar-chart-wrap">
      <div class="an-goal-line" style="bottom:${goalPct}%" title="Daily goal: ${dailyGoal} min">
        <span class="an-goal-line-lbl">${dailyGoal}m goal</span>
      </div>
      <div class="an-bar-chart">
        ${days.map((d, i) => {
          const avg    = rollingAvg[i];
          const avgPct = avg !== null ? Math.round((avg / maxMin) * 100) : null;
          const hit    = d.min >= dailyGoal && d.min > 0;
          return `
          <div class="an-bar-col" title="${d.date}: ${d.min} min${avg !== null ? ` · 7d avg: ${avg}m` : ''}">
            <div class="an-bar-track">
              <div class="an-bar-fill${d.min > 0 ? ' an-bar-active' : ''}${hit ? ' an-bar-goal-hit' : ''}" style="height:${Math.max(2, Math.round((d.min / maxMin) * 100))}%"></div>
              ${avgPct !== null ? `<div class="an-avg-dot" style="bottom:${avgPct}%" title="7d avg: ${avg}m"></div>` : ''}
            </div>
            <div class="an-bar-lbl">${d.day}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function _renderIntensity(sessions) {
  const el     = document.getElementById('an-intensity');
  if (!el) return;
  const counts = sessions.reduce((a, s) => { const k = s.intensity || 'Focus'; a[k] = (a[k] || 0) + 1; return a; }, {});
  const total  = sessions.length || 1;
  const items  = [
    { label: '🌿 Low',   key: 'Low',   cls: 'an-hbar-low'   },
    { label: '🔥 Focus', key: 'Focus', cls: 'an-hbar-focus' },
    { label: '⚡ Ultra', key: 'Ultra', cls: 'an-hbar-ultra' },
  ];

  el.innerHTML = `
    <div class="an-section-title">// Intensity Breakdown</div>
    <div class="an-hbar-list">
      ${items.map(it => {
        const n = counts[it.key] || 0, pct = Math.round((n / total) * 100);
        return `<div class="an-hbar-row">
          <div class="an-hbar-lbl">${it.label}</div>
          <div class="an-hbar-track"><div class="an-hbar-fill ${it.cls}" style="width:${pct}%"></div></div>
          <div class="an-hbar-val">${n} <span class="an-dim">(${pct}%)</span></div>
        </div>`;
      }).join('')}
    </div>`;
}

function _renderDow(sessions) {
  const el     = document.getElementById('an-dow');
  if (!el) return;
  const ORDER  = [1, 2, 3, 4, 5, 6, 0];
  const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const buckets = Array(7).fill(null).map(() => ({ total: 0, n: 0 }));
  sessions.forEach(s => {
    const dow = parseLocalDate(s.date).getDay();
    const idx = ORDER.indexOf(dow);
    if (idx >= 0) { buckets[idx].total += s.minutes; buckets[idx].n++; }
  });
  const avgs   = buckets.map(b => b.n ? Math.round(b.total / b.n) : 0);
  const maxAvg = Math.max(...avgs, 1);

  el.innerHTML = `
    <div class="an-section-title">// Day-of-Week Pattern</div>
    <div class="an-hbar-list">
      ${LABELS.map((lbl, i) => {
        const pct = Math.round((avgs[i] / maxAvg) * 100);
        return `<div class="an-hbar-row">
          <div class="an-hbar-lbl">${lbl}</div>
          <div class="an-hbar-track"><div class="an-hbar-fill an-hbar-dow" style="width:${pct}%"></div></div>
          <div class="an-hbar-val">${avgs[i] ? avgs[i] + 'm' : '—'}</div>
        </div>`;
      }).join('')}
    </div>`;
}

function _renderTopTasks(sessions) {
  const el     = document.getElementById('an-tasks');
  if (!el) return;
  const map    = sessions.reduce((a, s) => { if (s.task) a[s.task] = (a[s.task] || 0) + s.minutes; return a; }, {});
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const maxMin = sorted.length ? sorted[0][1] : 1;

  el.innerHTML = `
    <div class="an-section-title">// Top Tasks by Time</div>
    ${sorted.length ? `<div class="an-hbar-list">
      ${sorted.map(([task, min]) => {
        const pct = Math.round((min / maxMin) * 100);
        return `<div class="an-hbar-row">
          <div class="an-hbar-lbl an-task-lbl" title="${_esc(task)}">${_esc(task)}</div>
          <div class="an-hbar-track"><div class="an-hbar-fill an-hbar-task" style="width:${pct}%"></div></div>
          <div class="an-hbar-val">${(min / 60).toFixed(1)}h</div>
        </div>`;
      }).join('')}
    </div>` : '<div class="an-empty">No sessions recorded yet.</div>'}`;
}

function _renderLearning(topics) {
  const el       = document.getElementById('an-learning');
  if (!el) return;
  const mastered = topics.filter(t => t.repeat1 && t.repeat3 && t.repeat7 && t.repeat21).length;
  const dueToday = topics.filter(t => t.status === 'Today').length;
  const overdue  = topics.filter(t => t.status === 'Overdue').length;
  const sorted   = [...topics].sort((a, b) => (a.ease ?? 2.5) - (b.ease ?? 2.5));

  el.innerHTML = `
    <div class="an-section-title">// Learning Overview</div>
    <div class="an-learn-kpis">
      <div class="an-learn-kpi"><div class="an-learn-val">${topics.length}</div><div class="an-learn-lbl">Topics</div></div>
      <div class="an-learn-kpi an-learn-gold"><div class="an-learn-val">${mastered}</div><div class="an-learn-lbl">Mastered</div></div>
      <div class="an-learn-kpi an-learn-pink"><div class="an-learn-val">${overdue}</div><div class="an-learn-lbl">Overdue</div></div>
      <div class="an-learn-kpi an-learn-cyan"><div class="an-learn-val">${dueToday}</div><div class="an-learn-lbl">Due Today</div></div>
    </div>
    ${sorted.length ? `<div class="an-topic-list">
      ${sorted.map(t => {
        const pct = calcProgress(t), sc = t.status.toLowerCase();
        return `<div class="an-topic-row">
          <div class="an-topic-name">${_esc(t.topic)}</div>
          <div class="an-topic-badges">
            <span class="status-badge status-${sc}">${t.status}</span>
            ${_srBadge(t.ease)}
          </div>
          <div class="an-topic-bar-wrap">
            <div class="an-topic-bar-track"><div class="an-topic-bar-fill" style="width:${pct}%"></div></div>
            <span class="an-topic-pct">${pct}%</span>
          </div>
        </div>`;
      }).join('')}
    </div>` : '<div class="an-empty">No topics tracked yet.</div>'}`;
}
