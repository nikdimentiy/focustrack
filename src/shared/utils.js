export const fmtTime = s => {
  const h  = String(Math.floor(s / 3600)).padStart(2, '0');
  const m  = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sc = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sc}`;
};

export const fmtDate        = d => d.toISOString().slice(0, 10);
export const fmtDateInput   = d => d.toISOString().split('T')[0];
export const readableDate   = str => new Date(str + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export const readableDateLong = str => new Date(str + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export const weekStart = (d = new Date()) => {
  const c = new Date(d);
  c.setDate(c.getDate() - c.getDay());
  c.setHours(0, 0, 0, 0);
  return c;
};

export const byDate = sessions =>
  sessions.reduce((a, s) => { a[s.date] = (a[s.date] || 0) + s.minutes; return a; }, {});

export const calcStreak = sessions => {
  const map = byDate(sessions);
  let n = 0;
  const c = new Date(); c.setHours(0, 0, 0, 0);
  while (map[fmtDate(c)] > 0) { n++; c.setDate(c.getDate() - 1); }
  return n;
};

export const calcMaxStreak = sessions => {
  const keys = Object.keys(byDate(sessions)).sort();
  if (!keys.length) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < keys.length; i++) {
    const diff = Math.round((new Date(keys[i] + 'T00:00:00') - new Date(keys[i - 1] + 'T00:00:00')) / 86400000);
    if (diff === 1) { cur++; best = Math.max(best, cur); } else cur = 1;
  }
  return best;
};

export const heatDays = range => {
  if (range === 'week') {
    const s = weekStart();
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; });
  }
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
};

export const calcStatus = nextRepeat => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const parts = nextRepeat.split('-');
  const next = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(nextRepeat + 'T00:00:00');
  if (next < today) return 'Overdue';
  if (next.getTime() === today.getTime()) return 'Today';
  return 'Pending';
};

export const calcProgress = t => {
  let c = 0;
  if (t.repeat1) c++; if (t.repeat3) c++; if (t.repeat7) c++; if (t.repeat21) c++;
  return Math.round((c / 4) * 100);
};

export function adjustEase(ease, scheduledDate, completedDate) {
  if (!scheduledDate || !completedDate) return ease;
  const daysLate = Math.round(
    (new Date(completedDate + 'T00:00:00') - new Date(scheduledDate + 'T00:00:00')) / 86400000
  );
  if (daysLate <= 1) return Math.min(3.0, ease + 0.1);
  if (daysLate <= 3) return Math.max(1.3, ease - 0.15);
  return Math.max(1.3, ease - 0.3);
}

export function computeNextRepeat(repeatKey, ease, today) {
  const base = { repeat1: 3, repeat3: 7, repeat7: 14 }[repeatKey];
  if (base === undefined) {
    const d = new Date(today + 'T00:00:00');
    d.setFullYear(d.getFullYear() + 1);
    return fmtDate(d);
  }
  const d = new Date(today + 'T00:00:00');
  d.setDate(d.getDate() + Math.max(1, Math.round(base * ease)));
  return fmtDate(d);
}
