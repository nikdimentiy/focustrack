import { sb } from '../config/supabase.js';

let _userId = null;
let _email  = null;
const _subs = new Set();

export const authState = {
  getUserId: () => _userId,
  getEmail:  () => _email,
  isAuthed:  () => !!_userId,
  subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); },
  _set(userId, email) { _userId = userId; _email = email; _subs.forEach(fn => fn({ userId, email })); },
  _clear() { _userId = null; _email = null; _subs.forEach(fn => fn({ userId: null, email: null })); },
};

export async function initAuth(onLogin) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) { authState._set(session.user.id, session.user.email); onLogin?.(); }
  } catch (e) { console.error('Auth init:', e); }

  sb.auth.onAuthStateChange((_event, session) => {
    if (session?.user) { authState._set(session.user.id, session.user.email); onLogin?.(); }
    else authState._clear();
  });
}

export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  authState._set(data.user.id, data.user.email);
}

export async function signOut() {
  await sb.auth.signOut();
  authState._clear();
}
