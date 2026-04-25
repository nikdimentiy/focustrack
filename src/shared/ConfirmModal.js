let _modal = null;
let _resolve = null;

function _init() {
  if (_modal) return;
  _modal = document.createElement('div');
  _modal.id = 'confirm-modal';
  _modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-corner tl"></div><div class="modal-corner tr"></div>
      <div class="modal-corner bl"></div><div class="modal-corner br"></div>
      <div class="modal-header">
        <div class="modal-icon danger">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h2 id="confirm-title"></h2>
      </div>
      <p id="confirm-body"></p>
      <div class="modal-buttons">
        <button id="confirm-cancel" type="button" class="btn btn-ghost">Cancel</button>
        <button id="confirm-ok"     type="button" class="btn btn-danger">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(_modal);

  _modal.addEventListener('click', e => { if (e.target === _modal) _dismiss(false); });
  _modal.querySelector('#confirm-cancel').addEventListener('click', () => _dismiss(false));
  _modal.querySelector('#confirm-ok').addEventListener('click', () => _dismiss(true));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _modal.classList.contains('active')) _dismiss(false);
  });
}

function _dismiss(result) {
  _modal.classList.remove('active');
  const res = _resolve;
  _resolve = null;
  res?.(result);
}

export function showConfirm({ title, body, confirmLabel = 'Confirm' }) {
  _init();
  _modal.querySelector('#confirm-title').textContent  = title;
  _modal.querySelector('#confirm-body').textContent   = body;
  _modal.querySelector('#confirm-ok').textContent     = confirmLabel;
  _modal.classList.add('active');
  _modal.querySelector('#confirm-cancel').focus();
  return new Promise(res => { _resolve = res; });
}
