/*
 * Ask the browser to opt this origin out of cache eviction.
 * Chrome grants liberally after user-initiated installs or sustained
 * engagement; Safari is stricter. We only ever call this once the user
 * has created real, durable data (i.e. their first item).
 */

export async function requestPersistence(): Promise<boolean> {
  if (!('storage' in navigator) || !('persist' in navigator.storage)) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function isPersisted(): Promise<boolean> {
  if (!('storage' in navigator) || !('persisted' in navigator.storage)) {
    return Promise.resolve(false);
  }
  return navigator.storage.persisted().catch(() => false);
}

/**
 * Heuristic for whether we're on iOS WebKit (Safari or iOS Chrome — same
 * engine). Used to decide whether to show the "Add to Home Screen" tip.
 */
export function isWebKitMobile(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1);
}
