import { db } from './schema';
import type { SavedOutfit, Combination } from '../shared/types';
import { SLOT_RENDER_ORDER } from '../shared/slots';
import { touchSession } from './sessions';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function listOutfitsForSession(sessionId: string): Promise<SavedOutfit[]> {
  return db.savedOutfits.where('sessionId').equals(sessionId).reverse().sortBy('createdAt');
}

export async function saveOutfit(sessionId: string, combo: Combination): Promise<SavedOutfit> {
  const orderedIds: string[] = [];
  for (const slot of SLOT_RENDER_ORDER) {
    const items = combo.bySlot[slot] ?? [];
    for (const item of items) orderedIds.push(item.id);
  }
  const outfit: SavedOutfit = {
    id: uid(),
    sessionId,
    itemIds: orderedIds,
    createdAt: Date.now(),
  };
  await db.savedOutfits.add(outfit);
  await touchSession(sessionId);
  return outfit;
}

export async function deleteOutfit(id: string): Promise<void> {
  await db.savedOutfits.delete(id);
}

export async function getOutfit(id: string): Promise<SavedOutfit | undefined> {
  return db.savedOutfits.get(id);
}
