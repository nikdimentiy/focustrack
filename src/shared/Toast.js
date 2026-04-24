let _el = null, _msgEl = null, _iconEl = null, _timer = null;

export const toast = {
  mount(container) {
    container.innerHTML = `
      <div id="toast" class="toast">
        <div class="toast-icon" id="toast-icon">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:14px;height:14px">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <span id="toast-message">Done</span>
      </div>`;
    _el     = container.querySelector('#toast');
    _msgEl  = container.querySelector('#toast-message');
    _iconEl = container.querySelector('#toast-icon');
  },

  show(message, type = 'success') {
    if (!_el) return;
    clearTimeout(_timer);
    _el.className  = `toast toast-${type}`;
    _msgEl.textContent = message;
    setTimeout(() => _el.classList.add('show'), 10);
    _timer = setTimeout(() => _el.classList.remove('show'), 3000);
  },
};
