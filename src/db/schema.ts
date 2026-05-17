import Dexie, { type Table } from 'dexie';
import type { Item, Session, SavedOutfit } from '../shared/types';
import { migrateSessionRanges } from './migrations';

class WardrobeDB extends Dexie {
  items!: Table<Item, string>;
  sessions!: Table<Session, string>;
  savedOutfits!: Table<SavedOutfit, string>;

  constructor() {
    super('tinder-dlya-shmotok');
    this.version(1).stores({
      items: 'id, slot, createdAt',
      sessions: 'id, updatedAt',
      savedOutfits: 'id, sessionId, createdAt',
    });
    // v2: shape-based outfit generator changed slotRanges semantics.
    // See migrations.ts for the transform.
    this.version(2)
      .stores({
        items: 'id, slot, createdAt',
        sessions: 'id, updatedAt',
        savedOutfits: 'id, sessionId, createdAt',
      })
      .upgrade(async (tx) => {
        await tx.table<Session>('sessions').toCollection().modify((s) => {
          s.slotRanges = migrateSessionRanges(s.slotRanges);
        });
      });
  }
}

export const db = new WardrobeDB();
