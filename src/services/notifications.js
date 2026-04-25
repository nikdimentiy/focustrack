let _audioCtx = null;

export function unlockAudio() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  } else if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
}

export function beep() {
  try {
    const ctx = _audioCtx ?? new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(660, t + 0.18);
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.start(t); osc.stop(t + 0.55);
  } catch {}
}

export function completionChime() {
  try {
    const ctx = _audioCtx ?? new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    [[523, 0], [659, 0.2], [784, 0.4]].forEach(([freq, offset]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + offset);
      gain.gain.setValueAtTime(0.0, t + offset);
      gain.gain.linearRampToValueAtTime(0.25, t + offset + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.45);
      osc.start(t + offset); osc.stop(t + offset + 0.45);
    });
  } catch {}
}

export function tickBeep() {
  try {
    const ctx = _audioCtx ?? new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(1200, t);
    gain.gain.setValueAtTime(0.035, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
    osc.start(t); osc.stop(t + 0.018);
  } catch {}
}

export function requestNotifyPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function sendNotification(title, body) {
  completionChime();
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/icons/android-chrome-192x192.png', silent: true }); } catch {}
  }
}

export function checkReviewReminders(topics, notifyEnabled) {
  if (!notifyEnabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const overdue = topics.filter(t => t.status === 'Overdue').length;
  const today   = topics.filter(t => t.status === 'Today').length;
  if (overdue === 0 && today === 0) return;
  const parts = [];
  if (today > 0)   parts.push(`${today} review${today > 1 ? 's' : ''} due today`);
  if (overdue > 0) parts.push(`${overdue} overdue`);
  try {
    new Notification('FocusTrack — Review Time', {
      body: parts.join(' · '),
      icon: '/icons/android-chrome-192x192.png',
      tag:  'ft-review-reminder',
    });
  } catch {}
}
