import { db } from './schema';
import type { Item } from '../shared/types';
import type { SlotKey } from '../shared/slots';
import { requestPersistence } from './persist';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function listItems(): Promise<Item[]> {
  return db.items.orderBy('createdAt').reverse().toArray();
}

export async function listItemsBySlot(slot: SlotKey): Promise<Item[]> {
  return db.items.where('slot').equals(slot).reverse().sortBy('createdAt');
}

export async function getItem(id: string): Promise<Item | undefined> {
  return db.items.get(id);
}

export async function createItem(input: {
  name: string;
  slot: SlotKey;
  blob: Blob;
  thumbnail: Blob;
  zPriority?: number;
}): Promise<Item> {
  const item: Item = {
    id: uid(),
    name: input.name,
    slot: input.slot,
    zPriority: input.zPriority ?? 0,
    blob: input.blob,
    thumbnail: input.thumbnail,
    createdAt: Date.now(),
  };
  await db.items.add(item);
  // First item created in this session-of-the-app: ask for durable storage.
  const count = await db.items.count();
  if (count <= 1) {
    requestPersistence();
  }
  return item;
}

export async function updateItem(
  id: string,
  patch: Partial<Pick<Item, 'name' | 'slot' | 'zPriority'>>,
): Promise<void> {
  await db.items.update(id, patch);
}

/**
 * Delete an item and cascade through saved outfits:
 * — strip the item id from each affected outfit's itemIds
 * — if that leaves the outfit empty, delete the outfit row
 */
export async function deleteItem(id: string): Promise<{ outfitsAffected: number; outfitsRemoved: number }> {
  let outfitsAffected = 0;
  let outfitsRemoved = 0;
  await db.transaction('rw', db.items, db.savedOutfits, async () => {
    const affected = await db.savedOutfits.filter((o) => o.itemIds.includes(id)).toArray();
    for (const outfit of affected) {
      outfitsAffected++;
      const remaining = outfit.itemIds.filter((iid) => iid !== id);
      if (remaining.length === 0) {
        await db.savedOutfits.delete(outfit.id);
        outfitsRemoved++;
      } else {
        await db.savedOutfits.update(outfit.id, { itemIds: remaining });
      }
    }
    await db.items.delete(id);
  });
  return { outfitsAffected, outfitsRemoved };
}

/** Count saved outfits that reference an item — for confirmation dialogs. */
export async function countOutfitsUsing(id: string): Promise<number> {
  return db.savedOutfits.filter((o) => o.itemIds.includes(id)).count();
}
