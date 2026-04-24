const _subs = new Set();

export const Nav = {
  mount(container) {
    container.innerHTML = `
      <button id="nav-dw" class="active">Deep Work Timer</button>
      <button id="nav-tr">Repetition Tracker</button>`;
    container.querySelector('#nav-dw').addEventListener('click', () => Nav.switchTo('dw'));
    container.querySelector('#nav-tr').addEventListener('click', () => Nav.switchTo('tr'));
    Nav.switchTo('dw');
  },

  switchTo(view) {
    document.body.className = `theme-${view}`;
    const dwBtn = document.getElementById('nav-dw');
    const trBtn = document.getElementById('nav-tr');
    if (dwBtn) dwBtn.classList.toggle('active', view === 'dw');
    if (trBtn) trBtn.classList.toggle('active', view === 'tr');
    _subs.forEach(fn => fn(view));
  },

  onSwitch(fn) { _subs.add(fn); return () => _subs.delete(fn); },
};
