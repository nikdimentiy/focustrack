// Manages Periodic Background Sync registration for review reminders.
// Periodic sync fires the SW's 'periodicsync' handler even when the app tab is closed.
// Browser support: Chromium 80+ (Chrome, Edge, Android Chrome). Safari/Firefox fall back to
// the existing on-load check in main.js.

const SYNC_TAG          = 'ft-review-check';
const MIN_INTERVAL_MS   = 12 * 60 * 60 * 1000; // 12 h — browser enforces its own minimum

/** Returns true when the current browser supports Periodic Background Sync. */
export function isPeriodicSyncSupported() {
  return (
    'serviceWorker' in navigator &&
    'periodicSync'  in ServiceWorkerRegistration.prototype
  );
}

/**
 * Register (or re-register) the periodic review-check sync.
 * Resolves to { ok: true } on success or { ok: false, reason: string } on failure.
 * Call this whenever the user enables background notifications.
 */
export async function registerBackgroundSync() {
  if (!isPeriodicSyncSupported()) return { ok: false, reason: 'not-supported' };

  try {
    const perm = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (perm.state === 'denied') return { ok: false, reason: 'denied' };

    const reg = await navigator.serviceWorker.ready;
    await reg.periodicSync.register(SYNC_TAG, { minInterval: MIN_INTERVAL_MS });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e.message ?? e) };
  }
}

/**
 * Remove the periodic sync registration.
 * Call this when the user disables background notifications.
 */
export async function unregisterBackgroundSync() {
  if (!isPeriodicSyncSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.periodicSync.unregister(SYNC_TAG);
  } catch {}
}

/**
 * Check whether the sync tag is currently registered.
 * Useful for syncing the Settings UI with real registration state.
 */
export async function isBackgroundSyncRegistered() {
  if (!isPeriodicSyncSupported()) return false;
  try {
    const reg  = await navigator.serviceWorker.ready;
    const tags = await reg.periodicSync.getTags();
    return tags.includes(SYNC_TAG);
  } catch {
    return false;
  }
}
