import { timerStore } from '../store/timerStore.js';
import { trackerStore } from '../store/trackerStore.js';
import { Nav } from '../shared/Nav.js';
import { fmtDate, calcStreak, calcMaxStreak, weekStart, byDate, calcProgress, readableDateLong } from '../shared/utils.js';

const _esc    = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const _srBadge = ease => {
  const e = ease ?? 2.5;
  if (e < 1.6) return '<span class="sr-badge sr-weak">Weak</span>';
  if (e < 2.2) return '<span class="sr-badge sr-growing">Growing</span>';
  return '<span class="sr-badge sr-strong">Strong</span>';
};

export function mountAnalyticsView(container) {
  container.innerHTML = `
    <div class="container">
      <div class="panel">
        <div class="panel-corner tl"></div><div class="panel-corner tr"></div>
        <div class="panel-corner bl"></div><div class="panel-corner br"></div>
        <div class="app-header">
          <div class="logo">
            <div class="logo-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              </svg>
            </div>
            <h1>Analytics <span>Dashboard</span></h1>
          </div>
          <p class="subtitle">// Deep work insights and learning progress</p>
        </div>
      </div>
      <div id="an-kpis" class="an-kpi-row"></div>
      <div id="an-daily" class="an-section"></div>
      <div class="an-row">
        <div id="an-intensity" class="an-section an-half"></div>
        <div id="an-dow" class="an-section an-half"></div>
      </div>
      <div id="an-tasks" class="an-section"></div>
      <div id="an-learning" class="an-section"></div>
    </div>`;

  function _render() {
    if (!document.body.classList.contains('theme-an')) return;
    const sessions = timerStore.get().sessions || [];
    const topics   = trackerStore.get();
    _renderKPIs(sessions);
    _renderDailyChart(sessions);
    _renderIntensity(sessions);
    _renderDow(sessions);
    _renderTopTasks(sessions);
    _renderLearning(topics);
  }

  Nav.onSwitch(v => { if (v === 'an') _render(); });
  timerStore.subscribe(_render);
  trackerStore.subscribe(_render);
}

function _renderKPIs(sessions) {
  const el = document.getElementById('an-kpis');
  if (!el) return;
  const totalMin = sessions.reduce((s, x) => s + x.minutes, 0);
  const wsStr    = fmtDate(weekStart());
  const weekMin  = sessions.filter(s => s.date >= wsStr).reduce((a, s) => a + s.minutes, 0);
  const streak   = calcStreak(sessions);
  const best     = calcMaxStreak(sessions);
  const avgMin   = sessions.length ? Math.round(totalMin / sessions.length) : 0;

  el.innerHTML = `
    <div class="an-kpi-card an-kpi-cyan">
      <div class="an-kpi-val">${(totalMin / 60).toFixed(1)}<span class="an-kpi-unit">h</span></div>
      <div class="an-kpi-lbl">Total Focus Time</div>
    </div>
    <div class="an-kpi-card an-kpi-gold">
      <div class="an-kpi-val">${(weekMin / 60).toFixed(1)}<span class="an-kpi-unit">h</span></div>
      <div class="an-kpi-lbl">This Week</div>
    </div>
    <div class="an-kpi-card an-kpi-green">
      <div class="an-kpi-val">${streak}<span class="an-kpi-unit">d</span></div>
      <div class="an-kpi-lbl">Streak · Best ${best}d</div>
    </div>
    <div class="an-kpi-card an-kpi-purple">
      <div class="an-kpi-val">${avgMin}<span class="an-kpi-unit">m</span></div>
      <div class="an-kpi-lbl">Avg Session · ${sessions.length} total</div>
    </div>`;
}

function _renderDailyChart(sessions) {
  const el = document.getElementById('an-daily');
  if (!el) return;
  const map  = byDate(sessions);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return { date: fmtDate(d), day: d.getDate(), min: map[fmtDate(d)] || 0 };
  });
  const maxMin = Math.max(...days.map(d => d.min), 1);

  el.innerHTML = `
    <div class="an-section-title">// 14-Day Activity</div>
    <div class="an-bar-chart">
      ${days.map(d => `
        <div class="an-bar-col" title="${d.date}: ${d.min} min">
          <div class="an-bar-track">
            <div class="an-bar-fill${d.min > 0 ? ' an-bar-active' : ''}" style="height:${Math.max(2, Math.round((d.min / maxMin) * 100))}%"></div>
          </div>
          <div class="an-bar-lbl">${d.day}</div>
        </div>`).join('')}
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
    const dow = new Date(s.date + 'T00:00:00').getDay();
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
