import type { SlotKey, SlotRange } from './slots';

export type Item = {
  id: string;
  name: string;
  /**
   * Slot the item lives in, or `null` when not yet classified.
   * Unclassified items are skipped by the outfit generator and shown
   * under the "Без слота" filter in the library.
   */
  slot: SlotKey | null;
  zPriority: number;
  blob: Blob;
  thumbnail: Blob;
  createdAt: number;
  /**
   * Soft-delete timestamp. When set, the item is hidden from the active
   * library / generator / pickers but remains in IndexedDB so that:
   *  (a) saved outfits referencing it still render normally,
   *  (b) the user can restore it from the trash view.
   * `null` or `undefined` means "active". A real number means "in trash."
   */
  deletedAt?: number | null;
};

export type Session = {
  id: string;
  name: string;
  slotRanges: Record<SlotKey, SlotRange>;
  /**
   * Подборка — when non-null, the generator only draws from these item IDs
   * (a "capsule" or "mood"). Null means the full active wardrobe.
   *
   * "Always include this single item" is expressed by leaving it as the
   * only item of its slot in the subset — locks used to be a separate
   * concept but turned out to be a convenience layer over this same idea.
   */
  subsetIds: string[] | null;
  createdAt: number;
  updatedAt: number;
};

export type SavedOutfit = {
  id: string;
  sessionId: string;
  itemIds: string[];
  createdAt: number;
};

export type Combination = {
  bySlot: Record<SlotKey, Item[]>;
  key: string;
};
