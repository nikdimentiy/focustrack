const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MONS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const _pad = n => String(n).padStart(2, '0');

// Week number with Sunday as first day of week
const _weekNum = d => {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.floor((Math.floor((d - jan1) / 86400000) + jan1.getDay()) / 7) + 1;
};

export function mountFooterWidget(container) {
  container.innerHTML = `
    <div class="fw">
      <div class="fw-corner fw-tl"></div>
      <div class="fw-corner fw-br"></div>
      <div class="fw-block">
        <div class="fw-lbl">// today</div>
        <div class="fw-val" id="fw-date"></div>
      </div>
      <div class="fw-sep"></div>
      <div class="fw-block">
        <div class="fw-lbl">// week</div>
        <div class="fw-val" id="fw-week"></div>
      </div>
      <div class="fw-sep"></div>
      <div class="fw-block">
        <div class="fw-lbl">// day ends in</div>
        <div class="fw-cd" id="fw-cd"></div>
      </div>
    </div>`;

  function _tick() {
    const now = new Date();

    const dateEl = document.getElementById('fw-date');
    if (dateEl) dateEl.textContent =
      `${DAYS[now.getDay()]} ${now.getDate()} ${MONS[now.getMonth()]} ${now.getFullYear()}`;

    const weekEl = document.getElementById('fw-week');
    if (weekEl) weekEl.textContent = `W${_weekNum(now)} · ${now.getFullYear()}`;

    const cdEl = document.getElementById('fw-cd');
    if (cdEl) {
      const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
      const rem = Math.max(0, midnight - now);
      const h = Math.floor(rem / 3600000);
      const m = Math.floor((rem % 3600000) / 60000);
      const s = Math.floor((rem % 60000) / 1000);
      cdEl.textContent = `${_pad(h)}:${_pad(m)}:${_pad(s)}`;
    }
  }

  _tick();
  setInterval(_tick, 1000);

  // Intelligent hide: dim after 3s of no mouse movement, restore on proximity
  const fw = container.querySelector('.fw');
  let _idleTimer = null;

  const _dim  = () => fw.classList.add('fw-idle');
  const _wake = () => { fw.classList.remove('fw-idle'); };

  const _resetIdle = () => {
    _wake();
    clearTimeout(_idleTimer);
    _idleTimer = setTimeout(_dim, 3000);
  };

  // Start the first idle countdown
  _idleTimer = setTimeout(_dim, 3000);

  // Any mouse movement on the page resets the timer
  document.addEventListener('mousemove', _resetIdle, { passive: true });

  // Hovering the widget itself always wakes it (CSS handles instant snap,
  // but also reset the timer so it doesn't re-dim while cursor is on it)
  fw.addEventListener('mouseenter', () => { _wake(); clearTimeout(_idleTimer); });
  fw.addEventListener('mouseleave', _resetIdle);
}

export function mountInfoButton(container) {
  container.innerHTML = `
    <button class="info-btn" id="info-open" title="Keyboard shortcuts">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2"/>
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8M6 14h.01M18 14h.01"/>
      </svg>
    </button>`;

  const modal = document.createElement('div');
  modal.id = 'info-modal';
  modal.innerHTML = `
    <div class="info-box">
      <div class="modal-corner tl"></div><div class="modal-corner tr"></div>
      <div class="modal-corner bl"></div><div class="modal-corner br"></div>
      <button class="info-close" id="info-close">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <div class="info-header">
        <div class="info-header-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2"/>
            <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8M6 14h.01M18 14h.01"/>
          </svg>
        </div>
        <div class="info-header-text">
          <div class="info-title">Shortcuts</div>
          <div class="info-subtitle">Keyboard controls</div>
        </div>
      </div>

      <div class="info-section-lbl">Navigation</div>
      <div class="info-shortcuts">
        <div class="info-row">
          <span class="info-key">1</span>
          <span class="info-desc">Deep Work Timer</span>
        </div>
        <div class="info-row">
          <span class="info-key">2</span>
          <span class="info-desc">Repetition Tracker</span>
        </div>
        <div class="info-row">
          <span class="info-key">3</span>
          <span class="info-desc">Analytics</span>
        </div>
        <div class="info-row">
          <span class="info-key">Ctrl+K</span>
          <span class="info-desc">Open shortcuts menu</span>
        </div>
      </div>

      <div class="info-section-lbl">Timer</div>
      <div class="info-shortcuts">
        <div class="info-row">
          <span class="info-key">Ctrl+Shift+S</span>
          <span class="info-desc">Start timer</span>
        </div>
        <div class="info-row">
          <span class="info-key">Ctrl+Shift+H</span>
          <span class="info-desc">Pause timer</span>
        </div>
        <div class="info-row">
          <span class="info-key">Ctrl+Shift+P</span>
          <span class="info-desc">Stop timer</span>
        </div>
        <div class="info-row">
          <span class="info-key">Ctrl+Shift+R</span>
          <span class="info-desc">Reset timer</span>
        </div>
        <div class="info-row">
          <span class="info-key">Ctrl+Shift+N</span>
          <span class="info-desc">Log note for session</span>
        </div>
        <div class="info-row">
          <span class="info-key">Space</span>
          <div class="info-desc-wrap">
            <span class="info-desc">Start / Pause timer</span>
            <span class="info-sub">Timer view only</span>
          </div>
        </div>
      </div>

      <div class="info-section-lbl">Tracker</div>
      <div class="info-shortcuts">
        <div class="info-row">
          <span class="info-key">Ctrl+Shift+T</span>
          <span class="info-desc">Add topic</span>
        </div>
        <div class="info-row">
          <span class="info-key">Ctrl+Alt+J</span>
          <span class="info-desc">Export topics (JSON)</span>
        </div>
        <div class="info-row">
          <span class="info-key">Ctrl+Alt+C</span>
          <span class="info-desc">Export sessions (CSV)</span>
        </div>
        <div class="info-row">
          <span class="info-key">Ctrl+Alt+B</span>
          <span class="info-desc">Export full backup</span>
        </div>
      </div>

      <div class="info-section-lbl">App</div>
      <div class="info-shortcuts">
        <div class="info-row">
          <span class="info-key">Esc</span>
          <span class="info-desc">Close modal</span>
        </div>
      </div>

      <div class="info-divider"></div>

      <div class="info-dev">
        <div class="info-dev-name">Nikey Studio</div>
        <a class="info-dev-email" href="mailto:nikey.dim@zohomail.com">nikey.dim@zohomail.com</a>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const open  = () => modal.classList.add('active');
  const close = () => modal.classList.remove('active');

  document.getElementById('info-open').addEventListener('click', open);
  document.getElementById('info-close').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}
