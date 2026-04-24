let _topics = [];
const _subs = new Set();
const snap = () => [..._topics];

export const trackerStore = {
  get: snap,
  subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); },
  set(topics) { _topics = [...topics]; _subs.forEach(fn => fn(snap())); },
};
