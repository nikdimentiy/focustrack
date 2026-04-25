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

export function requestNotifyPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function sendNotification(title, body) {
  beep();
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/icons/android-chrome-192x192.png', silent: true }); } catch {}
  }
}
