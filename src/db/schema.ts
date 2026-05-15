import Dexie, { type Table } from 'dexie';
import type { Item, Session, SavedOutfit } from '../shared/types';

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
  }
}

export const db = new WardrobeDB();
