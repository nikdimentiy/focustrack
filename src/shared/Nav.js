const _subs = new Set();

export const Nav = {
  mount(container) {
    container.innerHTML = `
      <button id="nav-dw" class="active">Deep Work Timer</button>
      <button id="nav-tr">Repetition Tracker</button>
      <button id="nav-an">Analytics</button>`;
    container.querySelector('#nav-dw').addEventListener('click', () => Nav.switchTo('dw'));
    container.querySelector('#nav-tr').addEventListener('click', () => Nav.switchTo('tr'));
    container.querySelector('#nav-an').addEventListener('click', () => Nav.switchTo('an'));
    Nav.switchTo('dw');
  },

  switchTo(view) {
    document.body.className = `theme-${view}`;
    const dwBtn = document.getElementById('nav-dw');
    const trBtn = document.getElementById('nav-tr');
    const anBtn = document.getElementById('nav-an');
    if (dwBtn) dwBtn.classList.toggle('active', view === 'dw');
    if (trBtn) trBtn.classList.toggle('active', view === 'tr');
    if (anBtn) anBtn.classList.toggle('active', view === 'an');
    _subs.forEach(fn => fn(view));
  },

  onSwitch(fn) { _subs.add(fn); return () => _subs.delete(fn); },
};
