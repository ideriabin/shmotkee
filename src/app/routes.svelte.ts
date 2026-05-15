/*
 * Top-level routing — three tabs plus the active session that the
 * Compose tab works against. Persisted to localStorage so reloading
 * doesn't bounce you back to the Library tab.
 */

export type Tab = 'library' | 'compose' | 'sessions';

const KEY_TAB = 'tds.tab';
const KEY_SESSION = 'tds.activeSession';

function readTab(): Tab {
  const v = localStorage.getItem(KEY_TAB);
  if (v === 'library' || v === 'compose' || v === 'sessions') return v;
  return 'library';
}

function readActiveSession(): string | null {
  return localStorage.getItem(KEY_SESSION);
}

export const appState = $state({
  tab: readTab(),
  activeSessionId: readActiveSession(),
});

export function setTab(tab: Tab) {
  appState.tab = tab;
  localStorage.setItem(KEY_TAB, tab);
}

export function setActiveSession(id: string | null) {
  appState.activeSessionId = id;
  if (id) localStorage.setItem(KEY_SESSION, id);
  else localStorage.removeItem(KEY_SESSION);
}
