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
}

export function mountInfoButton(container) {
  container.innerHTML = `
    <button class="info-btn" id="info-open" title="Shortcuts & developer info">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
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

      <div class="info-head-lbl">// keyboard shortcuts</div>
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
          <span class="info-key">Space</span>
          <span class="info-desc">Start / Stop timer <span class="info-sub">— Timer view</span></span>
        </div>
        <div class="info-row">
          <span class="info-key">Esc</span>
          <span class="info-desc">Close modal</span>
        </div>
      </div>

      <div class="info-divider"></div>

      <div class="info-head-lbl">// developer</div>
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
