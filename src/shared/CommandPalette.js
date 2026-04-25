const _esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class CommandPalette {
  constructor() {
    this._commands = [];
    this._filtered = [];
    this._focused = 0;
    this._onKeyNav = this._onKeyNav.bind(this);
    this._mount();
  }

  register(commands) {
    this._commands = commands;
  }

  _mount() {
    const el = document.createElement('div');
    el.className = 'cp-overlay';
    el.id = 'cmd-palette';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Command palette');
    el.innerHTML = `
      <div class="cp-panel">
        <div class="cp-search-row">
          <svg class="cp-search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input class="cp-input" type="text" placeholder="Search actions…" autocomplete="off" spellcheck="false" />
        </div>
        <div class="cp-list" id="cp-list" role="listbox"></div>
        <div class="cp-footer">
          <span class="cp-hint"><kbd>↑↓</kbd> navigate</span>
          <span class="cp-hint"><kbd>↵</kbd> run</span>
          <span class="cp-hint"><kbd>Esc</kbd> close</span>
        </div>
      </div>`;
    document.body.appendChild(el);

    this._el   = el;
    this._input = el.querySelector('.cp-input');
    this._list  = el.querySelector('#cp-list');

    el.addEventListener('click', e => { if (e.target === el) this.close(); });
    this._input.addEventListener('input', () => this._filter());
  }

  open() {
    this._input.value = '';
    this._filtered = [...this._commands];
    this._focused = 0;
    this._render();
    this._el.classList.add('cp-visible');
    requestAnimationFrame(() => this._input.focus());
    document.addEventListener('keydown', this._onKeyNav);
  }

  close() {
    this._el.classList.remove('cp-visible');
    document.removeEventListener('keydown', this._onKeyNav);
  }

  isOpen() {
    return this._el.classList.contains('cp-visible');
  }

  _filter() {
    const q = this._input.value.toLowerCase().trim();
    this._filtered = q
      ? this._commands.filter(c =>
          c.label.toLowerCase().includes(q) ||
          (c.group || '').toLowerCase().includes(q)
        )
      : [...this._commands];
    this._focused = 0;
    this._render();
  }

  _render() {
    const groupOrder = [];
    const groups = {};
    for (const cmd of this._filtered) {
      const g = cmd.group || '';
      if (!groups[g]) { groups[g] = []; groupOrder.push(g); }
      groups[g].push(cmd);
    }

    let html = '';
    let idx = 0;
    for (const g of groupOrder) {
      if (g) html += `<div class="cp-group">${_esc(g)}</div>`;
      for (const cmd of groups[g]) {
        const active = idx === this._focused ? ' cp-item-focused' : '';
        const kbd = cmd.shortcut ? `<kbd class="cp-kbd">${_esc(cmd.shortcut)}</kbd>` : '';
        html += `<div class="cp-item${active}" data-idx="${idx}" role="option">${_esc(cmd.label)}${kbd}</div>`;
        idx++;
      }
    }

    this._list.innerHTML = html || '<div class="cp-empty">No matching actions</div>';

    this._list.querySelectorAll('.cp-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault(); // keep input focused
        this._run(Number(item.dataset.idx));
      });
      item.addEventListener('mouseenter', () => {
        this._focused = Number(item.dataset.idx);
        this._highlightOnly();
      });
    });
  }

  _highlightOnly() {
    this._list.querySelectorAll('.cp-item').forEach((el, i) => {
      el.classList.toggle('cp-item-focused', i === this._focused);
    });
    this._list.querySelector('.cp-item-focused')?.scrollIntoView({ block: 'nearest' });
  }

  _run(idx) {
    const cmd = this._filtered[idx];
    if (!cmd) return;
    this.close();
    setTimeout(() => cmd.action(), 0);
  }

  _onKeyNav(e) {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._focused = Math.min(this._focused + 1, this._filtered.length - 1);
      this._highlightOnly();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this._focused = Math.max(this._focused - 1, 0);
      this._highlightOnly();
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); this._run(this._focused); }
  }
}
