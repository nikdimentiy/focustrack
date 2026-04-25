let _el = null, _timer = null;

const _esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const _checkIcon = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:14px;height:14px">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
</svg>`;
const _xIcon = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:14px;height:14px">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/>
</svg>`;

export const toast = {
  mount(container) {
    container.innerHTML = `<div id="toast" class="toast"></div>`;
    _el = container.querySelector('#toast');
  },

  show(message, type = 'success') {
    if (!_el) return;
    clearTimeout(_timer);
    const icon = type === 'success' ? _checkIcon : type === 'error' ? _xIcon : '';
    _el.className = `toast toast-${type}`;
    _el.innerHTML = icon
      ? `<div class="toast-icon">${icon}</div><span>${_esc(message)}</span>`
      : `<span>${_esc(message)}</span>`;
    setTimeout(() => _el.classList.add('show'), 10);
    _timer = setTimeout(() => _el.classList.remove('show'), 3000);
  },

  showUndo(message, undoFn) {
    if (!_el) return;
    clearTimeout(_timer);
    _el.className = 'toast toast-undo show';
    _el.innerHTML = `<span>${_esc(message)}</span><button class="toast-undo-btn" type="button">Undo</button>`;
    let done = false;
    const dismiss = () => { if (!done) { done = true; _el.classList.remove('show'); } };
    _el.querySelector('.toast-undo-btn').addEventListener('click', () => { undoFn(); dismiss(); });
    _timer = setTimeout(dismiss, 5000);
  },
};
