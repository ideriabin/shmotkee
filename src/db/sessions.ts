import { db } from './schema';
import type { Session } from '../shared/types';
import { DEFAULT_SLOT_RANGES } from '../shared/slots';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function listSessions(): Promise<Session[]> {
  const all = await db.sessions.orderBy('updatedAt').reverse().toArray();
  return all.map(hydrateSession);
}

export async function getSession(id: string): Promise<Session | undefined> {
  const s = await db.sessions.get(id);
  return s ? hydrateSession(s) : undefined;
}

export async function createSession(name: string): Promise<Session> {
  const now = Date.now();
  const s: Session = {
    id: uid(),
    name: name.trim() || 'Без названия',
    slotRanges: { ...DEFAULT_SLOT_RANGES },
    subsetIds: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.sessions.add(s);
  return s;
}

/** Resolve missing `subsetIds` on sessions stored before that field was
    introduced. Pure — call on values read from DB. */
export function hydrateSession(s: Session): Session {
  return {
    ...s,
    subsetIds: s.subsetIds ?? null,
  };
}

export async function renameSession(id: string, name: string): Promise<void> {
  await db.sessions.update(id, { name: name.trim() || 'Без названия', updatedAt: Date.now() });
}

export async function updateSessionRanges(
  id: string,
  slotRanges: Session['slotRanges'],
): Promise<void> {
  await db.sessions.update(id, { slotRanges, updatedAt: Date.now() });
}

export async function updateSessionSubset(
  id: string,
  subsetIds: string[] | null,
): Promise<void> {
  await db.sessions.update(id, { subsetIds, updatedAt: Date.now() });
}

export async function touchSession(id: string): Promise<void> {
  await db.sessions.update(id, { updatedAt: Date.now() });
}

export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.savedOutfits, async () => {
    await db.savedOutfits.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
  });
}

export async function countOutfitsInSession(id: string): Promise<number> {
  return db.savedOutfits.where('sessionId').equals(id).count();
}
