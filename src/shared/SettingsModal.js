import { settings } from './settings.js';
import { requestNotifyPermission } from '../services/notifications.js';

const _gearSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
</svg>`;

export function mountSettingsButton(container) {
  container.innerHTML = `<button class="settings-btn" id="settings-open" title="Settings">${_gearSVG}</button>`;

  const modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.className = 'settings-modal-overlay';
  modal.innerHTML = `
    <div class="settings-box">
      <div class="modal-corner tl"></div><div class="modal-corner tr"></div>
      <div class="modal-corner bl"></div><div class="modal-corner br"></div>
      <button class="info-close" id="settings-close">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <div class="info-header">
        <div class="info-header-icon">${_gearSVG}</div>
        <div class="info-header-text">
          <div class="info-title">Settings</div>
          <div class="info-subtitle">App preferences</div>
        </div>
      </div>

      <div class="info-section-lbl">Focus Goals</div>
      <div class="settings-row">
        <label class="settings-lbl" for="setting-daily-goal">Daily goal</label>
        <div class="settings-input-wrap">
          <input type="number" id="setting-daily-goal" class="settings-input" min="15" max="480" value="90">
          <span class="settings-unit">min / day</span>
        </div>
      </div>
      <div class="settings-row">
        <label class="settings-lbl" for="setting-weekly-goal">Weekly goal</label>
        <div class="settings-input-wrap">
          <input type="number" id="setting-weekly-goal" class="settings-input" min="30" max="3000" value="300">
          <span class="settings-unit">min / week</span>
        </div>
      </div>

      <div class="info-section-lbl" style="margin-top:14px">Notifications</div>
      <div class="settings-row">
        <label class="settings-lbl" for="setting-notify-reviews">Review reminders</label>
        <label class="settings-toggle">
          <input type="checkbox" id="setting-notify-reviews">
          <span class="settings-toggle-track"></span>
        </label>
      </div>
      <div class="settings-hint" id="notify-hint"></div>
    </div>`;
  document.body.appendChild(modal);

  const _syncInputs = () => {
    const s = settings.get();
    document.getElementById('setting-daily-goal').value       = s.dailyGoalMins;
    document.getElementById('setting-weekly-goal').value      = s.weeklyGoalMins;
    document.getElementById('setting-notify-reviews').checked = s.notifyReviews;
    _updateNotifyHint();
  };

  const _updateNotifyHint = () => {
    const hint = document.getElementById('notify-hint');
    if (!hint) return;
    if (!('Notification' in window)) {
      hint.textContent = 'Browser notifications not supported';
      return;
    }
    const perm = Notification.permission;
    if (perm === 'denied') hint.textContent = 'Blocked by browser — enable in site settings';
    else if (perm === 'default') hint.textContent = 'Permission not yet granted — will prompt on first session start';
    else hint.textContent = '';
  };

  const open  = () => { _syncInputs(); modal.classList.add('active'); };
  const close = () => modal.classList.remove('active');

  document.getElementById('settings-open').addEventListener('click', open);
  document.getElementById('settings-close').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  modal.querySelector('#setting-daily-goal').addEventListener('change', e => {
    settings.set({ dailyGoalMins: Math.max(15, Math.min(480, Number(e.target.value) || 90)) });
  });
  modal.querySelector('#setting-weekly-goal').addEventListener('change', e => {
    settings.set({ weeklyGoalMins: Math.max(30, Math.min(3000, Number(e.target.value) || 300)) });
  });
  modal.querySelector('#setting-notify-reviews').addEventListener('change', e => {
    settings.set({ notifyReviews: e.target.checked });
    if (e.target.checked) requestNotifyPermission();
    _updateNotifyHint();
  });
}
